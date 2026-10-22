<?php

namespace App\Modules\Ventas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Finanzas\Models\Puc;
use App\Modules\Ventas\Models\Entrega;
use App\Modules\Ventas\Services\PedidoService;
use App\Modules\Ventas\Services\PedidoVoucher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The pedidos to deliver (contra entrega): dispatch them, mark them
 * delivered — collecting the money as an abono —, returned, rescheduled
 * or, when given up on, cancelled.
 */
class EntregaController extends Controller
{
    /** How far back the delivered and cancelled ones are listed. */
    private const DIAS_FINALIZADAS = 30;

    /**
     * Every pending delivery (to dispatch, on its way or returned) plus the
     * ones finished lately, all at once: the screen filters them by estado
     * without asking the server again.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('entregas.view');

        $usuario = $request->user();

        $entregas = Entrega::query()
            ->visiblesPara($usuario)
            ->where(fn ($query) => $query
                ->whereIn('estado', Entrega::PENDIENTES)
                ->orWhere('updated_at', '>=', now()->subDays(self::DIAS_FINALIZADAS)))
            ->with([
                'pedido' => fn ($query) => $query->withTrashed()->select(['id', 'cliente_id', 'user_id', 'bodega_id', 'fecha', 'tipo_pago', 'total_a_pagar', 'abono', 'saldo_pendiente', 'estado_pago']),
                'pedido.cliente:id,razon_social',
                'pedido.bodega:id,nombre_bodega',
            ])
            ->orderByRaw("case estado when 'DEVUELTO' then 0 when 'POR_DESPACHAR' then 1 when 'EN_CAMINO' then 2 else 3 end")
            ->orderByRaw('fecha_programada is null, fecha_programada')
            ->latest('id')
            ->get();

        $puedeCobrar = $usuario->can('pedidos.update') && $usuario->can('pedidos.create-abono');

        return Inertia::render('entregas/index', [
            'entregas' => $entregas,
            'diasFinalizadas' => self::DIAS_FINALIZADAS,
            'canUpdate' => $usuario->can('entregas.update'),
            'canCobrar' => $puedeCobrar,
            'canAnular' => $usuario->can('entregas.update') && $usuario->can('pedidos.delete'),
            'pucs' => $puedeCobrar ? Puc::orderBy('concatenar_subcuenta_concepto')->get(['id', 'concatenar_subcuenta_concepto']) : [],
            'vendedores' => $puedeCobrar ? User::orderBy('name')->get(['id', 'name']) : [],
        ]);
    }

    /**
     * The pedido's voucher, with where it goes and what to collect, to print
     * it for the messenger without opening the pedido.
     */
    public function voucher(Entrega $entrega, PedidoVoucher $voucher): JsonResponse
    {
        Gate::authorize('entregas.view');

        return response()->json($voucher->toArray($entrega->pedido()->withTrashed()->firstOrFail()));
    }

    /**
     * Move the delivery along: dispatched (with who takes it), delivered,
     * returned (saying why) or rescheduled for another day.
     */
    public function update(Request $request, Entrega $entrega): RedirectResponse
    {
        Gate::authorize('entregas.update');

        $datos = $request->validate([
            'estado' => ['required', Rule::in([Entrega::POR_DESPACHAR, Entrega::EN_CAMINO, Entrega::ENTREGADO, Entrega::DEVUELTO])],
            'mensajero' => ['nullable', 'string', 'max:255'],
            'motivo' => ['required_if:estado,'.Entrega::DEVUELTO, 'nullable', 'string', 'max:255'],
            // Back to por despachar means rescheduled: it needs the new day.
            'fecha_programada' => ['required_if:estado,'.Entrega::POR_DESPACHAR, 'nullable', 'date', 'after_or_equal:today'],
        ], [
            'motivo.required_if' => 'Indica el motivo de la devolución.',
            'fecha_programada.required_if' => 'Indica la nueva fecha de entrega.',
            'fecha_programada.after_or_equal' => 'La fecha de entrega no puede ser anterior a hoy.',
        ]);

        $this->asegurarOrden($entrega, $datos['estado']);

        $cambios = match ($datos['estado']) {
            Entrega::EN_CAMINO => [
                'mensajero' => $datos['mensajero'] ?? $entrega->mensajero,
                'despachada_at' => $entrega->despachada_at ?? now(),
            ],
            Entrega::ENTREGADO => ['entregada_at' => now()],
            Entrega::DEVUELTO => ['motivo' => $datos['motivo'], 'entregada_at' => null],
            Entrega::POR_DESPACHAR => [
                'fecha_programada' => $datos['fecha_programada'],
                'motivo' => $datos['motivo'] ?? $entrega->motivo,
                'reagendamientos' => $entrega->reagendamientos + 1,
                'despachada_at' => null,
                'entregada_at' => null,
            ],
        };

        $entrega->update(['estado' => $datos['estado'], ...$cambios]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Delivery updated.')]);

        return back();
    }

    /**
     * Give up on a returned delivery: the pedido is cancelled, its productos
     * go back to the bodega and the cliente no longer owes it.
     */
    public function anular(Entrega $entrega, PedidoService $pedidoService): RedirectResponse
    {
        Gate::authorize('entregas.update');
        Gate::authorize('pedidos.delete');

        if ($entrega->estado !== Entrega::DEVUELTO) {
            throw ValidationException::withMessages(['estado' => 'Solo se puede anular un pedido devuelto.']);
        }

        DB::transaction(function () use ($entrega, $pedidoService): void {
            $entrega->update(['estado' => Entrega::ANULADO]);
            $pedidoService->eliminar($entrega->pedido);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Pedido cancelled. Its products went back to stock.')]);

        return back();
    }

    /**
     * Keep the steps in order: it is dispatched first, and it is only
     * delivered once it is on its way and fully paid.
     */
    private function asegurarOrden(Entrega $entrega, string $estado): void
    {
        if (! in_array($entrega->estado, Entrega::DESDE[$estado], true)) {
            $mensaje = match (true) {
                $entrega->estado === Entrega::ANULADO => 'La entrega está anulada.',
                $estado === Entrega::ENTREGADO && $entrega->estado === Entrega::POR_DESPACHAR => 'Primero despacha el pedido.',
                default => 'La entrega no puede pasar de '.$entrega->estado.' a '.$estado.'.',
            };

            throw ValidationException::withMessages(['estado' => $mensaje]);
        }

        $saldo = (float) $entrega->pedido()->withTrashed()->value('saldo_pendiente');

        if ($estado === Entrega::ENTREGADO && $saldo > 0) {
            throw ValidationException::withMessages([
                'estado' => 'Primero cobra el pedido: faltan $'.number_format($saldo, 0, ',', '.').'.',
            ]);
        }

        // Collected on its way: the only step left is delivering it.
        $cobradoEnCamino = $entrega->estado === Entrega::EN_CAMINO && $saldo <= 0;

        if ($cobradoEnCamino && $estado !== Entrega::ENTREGADO) {
            throw ValidationException::withMessages([
                'estado' => 'El pedido ya está cobrado: solo falta marcarlo entregado.',
            ]);
        }
    }
}
