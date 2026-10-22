<?php

namespace App\Modules\Ventas\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Finanzas\Models\Puc;
use App\Modules\Ventas\Models\Pedido;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * What the clientes owe: every pedido with a balance (of the bodegas the user
 * may see), grouped by cliente, with what is overdue and what is due soon.
 */
class CuentasPorCobrarController extends Controller
{
    /** Days ahead counted as "due soon". */
    private const DIAS_PROXIMOS = 7;

    public function index(Request $request): Response
    {
        Gate::authorize('pedidos.view');

        $usuario = $request->user();
        $hoy = today();
        $limiteProximos = $hoy->copy()->addDays(self::DIAS_PROXIMOS);

        $pedidos = Pedido::query()
            ->where('saldo_pendiente', '>', 0)
            ->when($usuario->idsBodegasPermitidas(), fn ($query, array $bodegaIds) => $query->whereIn('bodega_id', $bodegaIds))
            ->with('cliente:id,razon_social,numero_documento,telefono,dias_credito')
            ->orderByRaw('fecha_vencimiento is null')
            ->orderBy('fecha_vencimiento')
            ->orderBy('fecha')
            ->get(['id', 'cliente_id', 'user_id', 'fecha', 'fecha_vencimiento', 'tipo_pago', 'total_a_pagar', 'abono', 'saldo_pendiente', 'estado_pago']);

        $porVencer = fn (Pedido $pedido): bool => ! $pedido->vencido
            && $pedido->fecha_vencimiento !== null
            && $pedido->fecha_vencimiento->lte($limiteProximos);

        $clientes = $pedidos
            ->groupBy('cliente_id')
            ->map(fn ($deCliente) => [
                'cliente' => $deCliente->first()->cliente,
                'saldo' => round((float) $deCliente->sum('saldo_pendiente'), 2),
                'vencido' => round((float) $deCliente->where('vencido', true)->sum('saldo_pendiente'), 2),
                'proximo_vencimiento' => $deCliente->pluck('fecha_vencimiento')->filter()->min()?->toDateString(),
                'pedidos' => $deCliente->map(fn (Pedido $pedido): array => [
                    ...$pedido->only(['id', 'cliente_id', 'user_id', 'fecha', 'tipo_pago', 'total_a_pagar', 'abono', 'saldo_pendiente', 'estado_pago', 'vencido']),
                    'fecha_vencimiento' => $pedido->fecha_vencimiento?->toDateString(),
                    // Negative: days overdue.
                    'dias_para_vencer' => $pedido->fecha_vencimiento === null
                        ? null
                        : (int) $hoy->diffInDays($pedido->fecha_vencimiento, false),
                ])->values()->all(),
            ])
            // Who has overdue debt first, then who owes the most.
            ->sortBy([['vencido', 'desc'], ['saldo', 'desc']])
            ->values()
            ->all();

        $puedeCobrar = $usuario->can('pedidos.update') && $usuario->can('pedidos.create-abono');

        return Inertia::render('cuentas-por-cobrar/index', [
            'clientes' => $clientes,
            'resumen' => [
                'total' => round((float) $pedidos->sum('saldo_pendiente'), 2),
                'vencido' => round((float) $pedidos->where('vencido', true)->sum('saldo_pendiente'), 2),
                'proximo' => round((float) $pedidos->filter($porVencer)->sum('saldo_pendiente'), 2),
                'diasProximos' => self::DIAS_PROXIMOS,
                'pedidos' => $pedidos->count(),
            ],
            'canCreateAbono' => $puedeCobrar,
            'pucs' => $puedeCobrar ? Puc::orderBy('concatenar_subcuenta_concepto')->get(['id', 'concatenar_subcuenta_concepto']) : [],
            'vendedores' => $puedeCobrar ? User::orderBy('name')->get(['id', 'name']) : [],
        ]);
    }
}
