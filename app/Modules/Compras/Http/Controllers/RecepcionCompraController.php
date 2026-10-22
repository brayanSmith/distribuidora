<?php

namespace App\Modules\Compras\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\DetalleCompra;
use App\Modules\Compras\Services\RecepcionCompras;
use App\Modules\Inventario\Models\Bodega;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The goods still to arrive (the lines of the compras not fully received,
 * of the bodegas the user may use) and receiving them, whole or in parts.
 */
class RecepcionCompraController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('compras.recibir');

        $hoy = today();
        $bodegaIds = $request->user()->idsBodegasPermitidas();

        $lineas = DetalleCompra::query()
            ->where('estado_entrega', 'PENDIENTE')
            ->whereHas('compra')
            ->when($bodegaIds, fn ($query, array $ids) => $query->whereIn('bodega_id', $ids))
            ->with([
                'compra:id,factura,fecha,proveedor_id',
                'compra.proveedor:id,nombre_proveedor',
                'producto:id,referencia_producto,descripcion_producto,marca',
                'bodega:id,nombre_bodega',
            ])
            ->orderBy('compra_id')
            ->orderBy('id')
            ->get();

        $compras = $lineas
            ->groupBy('compra_id')
            ->map(function ($deCompra) use ($hoy): array {
                $compra = $deCompra->first()->compra;

                return [
                    'id' => $compra->id,
                    'factura' => $compra->factura,
                    'fecha' => $compra->fecha?->toDateString(),
                    'proveedor' => $compra->proveedor?->nombre_proveedor,
                    'dias_espera' => $compra->fecha ? (int) $compra->fecha->startOfDay()->diffInDays($hoy) : null,
                    'lineas' => $deCompra->map(fn (DetalleCompra $detalle): array => [
                        'id' => $detalle->id,
                        'producto' => $detalle->producto?->concatenar_codigo_nombre ?? 'Producto '.$detalle->producto_id,
                        'bodega_id' => $detalle->bodega_id,
                        'bodega' => $detalle->bodega?->nombre_bodega,
                        'cantidad' => (float) $detalle->cantidad,
                        'recibida' => (float) $detalle->cantidad_recibida,
                        'pendiente' => (float) $detalle->cantidad - (float) $detalle->cantidad_recibida,
                    ])->values()->all(),
                ];
            })
            // Who has been waiting the longest first.
            ->sortByDesc('dias_espera')
            ->values()
            ->all();

        return Inertia::render('compras-pendientes/index', [
            'compras' => $compras,
            'resumen' => [
                'compras' => count($compras),
                'unidades' => round($lineas->sum(fn (DetalleCompra $detalle): float => (float) $detalle->cantidad - (float) $detalle->cantidad_recibida), 2),
                'valor' => round($lineas->sum(fn (DetalleCompra $detalle): float => ((float) $detalle->cantidad - (float) $detalle->cantidad_recibida) * (float) $detalle->precio_unitario), 2),
            ],
            'bodegas' => Bodega::permitidas()->orderBy('nombre_bodega')->get(['id', 'nombre_bodega']),
        ]);
    }

    /**
     * Receive what arrived of some lines of a compra.
     */
    public function store(Request $request, Compra $compra, RecepcionCompras $recepcion): RedirectResponse
    {
        Gate::authorize('compras.recibir');

        $datos = $request->validate([
            'lineas' => ['required', 'array', 'min:1'],
            'lineas.*' => ['numeric', 'min:0'],
        ]);

        // Only lines of this compra, going to a bodega the user may use.
        $bodegaIds = $request->user()->idsBodegasPermitidas();

        if ($bodegaIds) {
            abort_if($compra->detallesCompra()
                ->whereKey(array_keys($datos['lineas']))
                ->whereNotIn('bodega_id', $bodegaIds)
                ->exists(), 403);
        }

        $recepcion->recibir($compra, $datos['lineas']);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Goods received.')]);

        return back();
    }
}
