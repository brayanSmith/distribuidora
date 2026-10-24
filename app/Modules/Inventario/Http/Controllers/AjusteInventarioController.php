<?php

namespace App\Modules\Inventario\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\AjusteInventario;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\MovimientoStock;
use App\Modules\Inventario\Models\StockBodega;
use App\Modules\Inventario\Services\Kardex;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Manual corrections of the stock (a physical count, damaged or lost
 * goods...), each with its reason and its line in the kardex.
 */
class AjusteInventarioController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('ajustes-inventario.view');

        $bodegaIds = $request->user()->idsBodegasPermitidas();
        $puedeCrear = $request->user()->can('ajustes-inventario.create');

        return Inertia::render('ajustes-inventario/index', [
            'ajustes' => AjusteInventario::query()
                ->when($bodegaIds, fn ($query, array $ids) => $query->whereIn('bodega_id', $ids))
                ->with(['producto', 'bodega:id,nombre_bodega', 'user:id,name'])
                ->latest('id')
                ->limit(300)
                ->get(),
            'productos' => $puedeCrear
                ? Producto::where('inventariable', true)->orderBy('referencia_producto')->get(['id', 'referencia_producto', 'descripcion_producto', 'marca', 'costo_producto'])
                : [],
            'bodegas' => Bodega::permitidas()->orderBy('nombre_bodega')->get(['id', 'nombre_bodega']),
            // What the system says there is, so a count shows the difference before saving.
            'stocks' => $puedeCrear
                ? StockBodega::query()
                    ->when($bodegaIds, fn ($query, array $ids) => $query->whereIn('bodega_id', $ids))
                    ->where('stock', '!=', 0)
                    ->get(['producto_id', 'bodega_id', 'stock'])
                : [],
            'motivos' => AjusteInventario::MOTIVOS,
            'canCreate' => $puedeCrear,
        ]);
    }

    public function store(Request $request, Kardex $kardex): RedirectResponse
    {
        Gate::authorize('ajustes-inventario.create');

        $datos = $request->validate([
            'producto_id' => ['required', 'integer', Rule::exists('productos', 'id')->where('inventariable', true)->whereNull('deleted_at')],
            'bodega_id' => ['required', 'integer', Rule::exists('bodegas', 'id')],
            'tipo' => ['required', Rule::in([AjusteInventario::ENTRADA, AjusteInventario::SALIDA, AjusteInventario::CONTEO])],
            'cantidad' => ['required', 'numeric', 'min:0', 'max:9999999'],
            'motivo' => ['required', 'string', 'max:100'],
            'nota' => ['nullable', 'string', 'max:255'],
        ], [
            'producto_id.exists' => 'Elige un producto que lleve inventario.',
            'motivo.required' => 'Indica el motivo del ajuste.',
        ]);

        $permitidas = $request->user()->idsBodegasPermitidas();

        if ($permitidas !== null && ! in_array((int) $datos['bodega_id'], $permitidas, true)) {
            throw ValidationException::withMessages(['bodega_id' => 'No puedes ajustar el stock de esta bodega.']);
        }

        if ($datos['tipo'] !== AjusteInventario::CONTEO && (float) $datos['cantidad'] <= 0) {
            throw ValidationException::withMessages(['cantidad' => 'Indica cuántas unidades entran o salen.']);
        }

        DB::transaction(function () use ($datos, $kardex, $request): void {
            $stockAnterior = (float) StockBodega::where('producto_id', $datos['producto_id'])
                ->where('bodega_id', $datos['bodega_id'])
                ->lockForUpdate()
                ->value('stock');

            $cantidad = (float) $datos['cantidad'];
            $diferencia = match ($datos['tipo']) {
                AjusteInventario::ENTRADA => $cantidad,
                AjusteInventario::SALIDA => -$cantidad,
                AjusteInventario::CONTEO => round($cantidad - $stockAnterior, 2),
            };

            if (abs($diferencia) < 0.005) {
                throw ValidationException::withMessages(['cantidad' => 'El conteo coincide con el stock: no hay nada que ajustar.']);
            }

            $ajuste = AjusteInventario::create([
                ...$datos,
                'stock_anterior' => $stockAnterior,
                'diferencia' => $diferencia,
                'user_id' => $request->user()->id,
            ]);

            $kardex->mover(
                (int) $datos['producto_id'],
                (int) $datos['bodega_id'],
                $diferencia,
                $diferencia > 0 ? MovimientoStock::AJUSTE_ENTRADA : MovimientoStock::AJUSTE_SALIDA,
                ['ajuste', $ajuste->id],
                nota: $datos['motivo'].(filled($datos['nota'] ?? null) ? ' — '.$datos['nota'] : ''),
            );
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Inventory adjusted.')]);

        return back();
    }
}
