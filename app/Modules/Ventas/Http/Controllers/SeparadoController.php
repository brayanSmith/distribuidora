<?php

namespace App\Modules\Ventas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Finanzas\Models\Puc;
use App\Modules\Ventas\Models\DetallePedido;
use App\Modules\Ventas\Models\Pedido;
use App\Modules\Ventas\Services\PedidoService;
use App\Modules\Ventas\Services\PedidoVoucher;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The separados: pedidos the cliente reserved to pick up in the store later.
 * They are collected and then handed over, rescheduled or, if the cliente
 * never comes, cancelled.
 */
class SeparadoController extends Controller
{
    /** How far back the ones already picked up are listed. */
    private const DIAS_RECOGIDOS = 30;

    /**
     * Every separado still to pick up plus the ones picked up lately, all at
     * once: the screen filters them without asking the server again.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('separados.view');

        $usuario = $request->user();

        $separados = Pedido::query()
            ->where('tipo_pago', 'SEPARADO')
            ->where(fn ($query) => $query
                ->whereNull('recogido_at')
                ->orWhere('recogido_at', '>=', now()->subDays(self::DIAS_RECOGIDOS)))
            ->when($usuario->idsBodegasPermitidas(), fn ($query, array $bodegaIds) => $query->whereIn('bodega_id', $bodegaIds))
            ->with([
                'cliente:id,razon_social,telefono',
                'bodega:id,nombre_bodega',
                'detalles.producto' => fn ($query) => $query->withTrashed(),
            ])
            ->orderByRaw('recogido_at is not null')
            ->orderBy('fecha_recogida')
            ->latest('id')
            ->get()
            ->map(fn (Pedido $pedido): array => [
                ...$pedido->only(['id', 'fecha', 'total_a_pagar', 'abono', 'saldo_pendiente', 'estado_pago', 'recogido_at']),
                'fecha_recogida' => $pedido->fecha_recogida?->toDateString(),
                'cliente' => $pedido->cliente?->only(['id', 'razon_social', 'telefono']),
                'bodega' => $pedido->bodega?->only(['id', 'nombre_bodega']),
                'productos' => $pedido->detalles->map(fn (DetallePedido $detalle): array => [
                    'nombre' => $detalle->producto?->concatenar_codigo_nombre ?? 'Producto '.$detalle->producto_id,
                    'cantidad' => (float) $detalle->cantidad,
                ])->all(),
            ]);

        $puedeCobrar = $usuario->can('pedidos.update') && $usuario->can('pedidos.create-abono');

        return Inertia::render('separados/index', [
            'separados' => $separados,
            'diasRecogidos' => self::DIAS_RECOGIDOS,
            'canUpdate' => $usuario->can('separados.update'),
            'canCobrar' => $puedeCobrar,
            'canAnular' => $usuario->can('separados.update') && $usuario->can('pedidos.delete'),
            'pucs' => $puedeCobrar ? Puc::orderBy('concatenar_subcuenta_concepto')->get(['id', 'concatenar_subcuenta_concepto']) : [],
            'vendedores' => $puedeCobrar ? User::orderBy('name')->get(['id', 'name']) : [],
        ]);
    }

    /**
     * Another day for the cliente to come.
     */
    public function update(Request $request, Pedido $pedido): RedirectResponse
    {
        Gate::authorize('separados.update');
        $this->asegurarPorRecoger($pedido);

        $datos = $request->validate([
            'fecha_recogida' => ['required', 'date', 'after_or_equal:today'],
        ], [
            'fecha_recogida.required' => 'Indica la nueva fecha de recogida.',
            'fecha_recogida.after_or_equal' => 'La fecha de recogida no puede ser anterior a hoy.',
        ]);

        $pedido->update($datos);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Pickup date updated.')]);

        return back();
    }

    /**
     * The cliente took it: only once it is fully paid.
     */
    public function entregar(Pedido $pedido): RedirectResponse
    {
        Gate::authorize('separados.update');
        $this->asegurarPorRecoger($pedido);

        $saldo = (float) $pedido->saldo_pendiente;

        if ($saldo > 0) {
            throw ValidationException::withMessages([
                'pedido' => 'Primero cobra el pedido: faltan $'.number_format($saldo, 0, ',', '.').'.',
            ]);
        }

        $pedido->update(['recogido_at' => now()]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Separado handed over.')]);

        return back();
    }

    /**
     * The cliente never came: the pedido is cancelled, its productos go back
     * to the bodega and it is no longer owed.
     */
    public function anular(Pedido $pedido, PedidoService $pedidoService): RedirectResponse
    {
        Gate::authorize('separados.update');
        Gate::authorize('pedidos.delete');
        $this->asegurarPorRecoger($pedido);

        $pedidoService->eliminar($pedido);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Pedido cancelled. Its products went back to stock.')]);

        return back();
    }

    /**
     * The voucher, to print it without opening the pedido.
     */
    public function voucher(Pedido $pedido, PedidoVoucher $voucher): JsonResponse
    {
        Gate::authorize('separados.view');
        abort_unless($pedido->tipo_pago === 'SEPARADO', 404);

        return response()->json($voucher->toArray($pedido));
    }

    /**
     * Only a separado still waiting for the cliente can change.
     */
    private function asegurarPorRecoger(Pedido $pedido): void
    {
        abort_unless($pedido->tipo_pago === 'SEPARADO', 404);

        if ($pedido->recogido_at !== null) {
            throw ValidationException::withMessages(['pedido' => 'El cliente ya recogió este pedido.']);
        }
    }
}
