<?php

namespace App\Modules\Compras\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Compras\Models\Compra;
use App\Modules\Finanzas\Models\Puc;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * What is owed to the proveedores: every compra with a balance, grouped by
 * proveedor, with what is overdue and what is due soon.
 */
class CuentasPorPagarController extends Controller
{
    /** Days ahead counted as "due soon". */
    private const DIAS_PROXIMOS = 7;

    public function index(Request $request): Response
    {
        Gate::authorize('compras.view');

        $hoy = today();
        $limiteProximas = $hoy->copy()->addDays(self::DIAS_PROXIMOS);

        $compras = Compra::query()
            ->where('saldo_pendiente', '>', 0)
            ->with('proveedor:id,nombre_proveedor,nit_proveedor,telefono_proveedor,dias_credito')
            ->orderByRaw('fecha_vencimiento is null')
            ->orderBy('fecha_vencimiento')
            ->get(['id', 'factura', 'proveedor_id', 'fecha', 'fecha_vencimiento', 'total_a_pagar', 'tipo_pago', 'abono', 'saldo_pendiente', 'estado_pago']);

        $porVencer = fn (Compra $compra): bool => ! $compra->vencida
            && $compra->fecha_vencimiento !== null
            && $compra->fecha_vencimiento->lte($limiteProximas);

        $proveedores = $compras
            ->groupBy('proveedor_id')
            ->map(fn ($deProveedor) => [
                'proveedor' => $deProveedor->first()->proveedor,
                'saldo' => round((float) $deProveedor->sum('saldo_pendiente'), 2),
                'vencido' => round((float) $deProveedor->where('vencida', true)->sum('saldo_pendiente'), 2),
                'proximo_vencimiento' => $deProveedor->pluck('fecha_vencimiento')->filter()->min()?->toDateString(),
                'compras' => $deProveedor->map(fn (Compra $compra): array => [
                    ...$compra->only(['id', 'factura', 'fecha', 'total_a_pagar', 'abono', 'saldo_pendiente', 'estado_pago', 'vencida']),
                    'fecha_vencimiento' => $compra->fecha_vencimiento?->toDateString(),
                    'proveedor' => $compra->proveedor?->only(['id', 'nombre_proveedor']),
                    // Negative: days overdue.
                    'dias_para_vencer' => $compra->fecha_vencimiento === null
                        ? null
                        : (int) $hoy->diffInDays($compra->fecha_vencimiento, false),
                ])->values()->all(),
            ])
            // Who has overdue debt first, then who owes the most.
            ->sortBy([['vencido', 'desc'], ['saldo', 'desc']])
            ->values()
            ->all();

        return Inertia::render('cuentas-por-pagar/index', [
            'proveedores' => $proveedores,
            'resumen' => [
                'total' => round((float) $compras->sum('saldo_pendiente'), 2),
                'vencido' => round((float) $compras->where('vencida', true)->sum('saldo_pendiente'), 2),
                'proximo' => round((float) $compras->filter($porVencer)->sum('saldo_pendiente'), 2),
                'diasProximos' => self::DIAS_PROXIMOS,
                'facturas' => $compras->count(),
            ],
            'pucs' => $request->user()->can('compras.create-abono')
                ? Puc::orderBy('concatenar_subcuenta_concepto')->get(['id', 'concatenar_subcuenta_concepto'])
                : [],
            'canCreateAbono' => $request->user()->can('compras.create-abono'),
        ]);
    }
}
