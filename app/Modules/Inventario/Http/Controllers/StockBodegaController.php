<?php

namespace App\Modules\Inventario\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockBodega;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class StockBodegaController extends Controller
{
    /**
     * Display a listing of stock por bodega.
     *
     * The payload is kept small on purpose (the table has thousands of
     * product/bodega pairs): products and bodegas are sent once and rows
     * reference them by id, and pairs with nothing in them are left out —
     * the table treats a missing pair as zero.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('stock-bodegas.view');

        $puedeVerInversion = $request->user()->can('stock-bodegas.view-inversion');
        $puedeTrasladar = $request->user()->can('stock-bodegas.create-traslado');

        // Stock rows whose product no longer exists (or is a servicio, which
        // never carries stock) are orphans: not listed.
        $productosVigentes = Producto::where('inventariable', true)
            ->select('id');

        $conStock = StockBodega::query()
            ->whereIn('producto_id', $productosVigentes)
            ->where(fn ($query) => $query
                ->where('stock_inicial', '<>', 0)
                ->orWhere('entradas', '<>', 0)
                ->orWhere('salidas', '<>', 0)
                ->orWhere('stock', '<>', 0))
            ->orderBy('bodega_id')
            ->orderBy('producto_id')
            ->get(['id', 'producto_id', 'bodega_id', 'stock_inicial', 'entradas', 'salidas', 'stock']);

        $productoIds = StockBodega::query()->whereIn('producto_id', $productosVigentes)->distinct()->pluck('producto_id');
        $bodegaIds = StockBodega::query()->whereIn('producto_id', $productosVigentes)->distinct()->pluck('bodega_id');

        return Inertia::render('stock-bodegas/index', [
            'stockBodegas' => $conStock,
            // Costs and prices are only sent to whoever may see the "Inversión" view.
            'productos' => Producto::whereIn('id', $productoIds)
                ->get($puedeVerInversion
                    ? ['id', 'referencia_producto', 'descripcion_producto', 'marca', 'costo_producto', 'valor_detal', 'valor_mayorista']
                    : ['id', 'referencia_producto', 'descripcion_producto', 'marca']),
            'canViewInversion' => $puedeVerInversion,
            'bodegas' => Bodega::whereIn('id', $bodegaIds)->get(['id', 'nombre_bodega']),
            'canCreateTraslado' => $puedeTrasladar,
            // A traslado may go to any bodega, not only those that already have stock.
            'bodegasTraslado' => $puedeTrasladar ? Bodega::orderBy('nombre_bodega')->get(['id', 'nombre_bodega']) : [],
        ]);
    }
}
