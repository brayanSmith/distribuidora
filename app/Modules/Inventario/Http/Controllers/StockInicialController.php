<?php

namespace App\Modules\Inventario\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Http\Requests\StoreStockInicialRequest;
use App\Modules\Inventario\Http\Requests\UpdateStockInicialRequest;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\MovimientoStock;
use App\Modules\Inventario\Models\StockInicial;
use App\Modules\Inventario\Services\Kardex;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class StockInicialController extends Controller
{
    /**
     * Display a listing of stock iniciales.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('stock-iniciales.view');

        return Inertia::render('stock-iniciales/index', [
            'stockIniciales' => StockInicial::with(['producto', 'bodega'])->latest()->get(),
            'productos' => Producto::where('inventariable', true)
                ->orderBy('referencia_producto')
                ->get(['id', 'referencia_producto', 'descripcion_producto', 'marca', 'costo_producto']),
            'bodegas' => Bodega::orderBy('nombre_bodega')->get(['id', 'nombre_bodega']),
            'permissions' => [
                'canCreate' => $request->user()->can('stock-iniciales.create'),
                'canUpdate' => $request->user()->can('stock-iniciales.update'),
                'canDelete' => $request->user()->can('stock-iniciales.delete'),
            ],
        ]);
    }

    /**
     * Store a newly created stock inicial.
     */
    public function store(StoreStockInicialRequest $request): RedirectResponse
    {
        Gate::authorize('stock-iniciales.create');

        $data = $request->validated();

        DB::transaction(function () use ($data): void {
            $stockInicial = StockInicial::create($data);

            $this->aplicar($stockInicial, 1);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Stock inicial created.')]);

        return back();
    }

    /**
     * Update the specified stock inicial.
     */
    public function update(UpdateStockInicialRequest $request, StockInicial $stock_inicial): RedirectResponse
    {
        Gate::authorize('stock-iniciales.update');

        $data = $request->validated();

        DB::transaction(function () use ($stock_inicial, $data): void {
            $this->aplicar($stock_inicial, -1);

            $stock_inicial->update($data);

            $this->aplicar($stock_inicial, 1);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Stock inicial updated.')]);

        return back();
    }

    /**
     * Remove the specified stock inicial.
     */
    public function destroy(StockInicial $stock_inicial): RedirectResponse
    {
        Gate::authorize('stock-iniciales.delete');

        DB::transaction(function () use ($stock_inicial): void {
            $this->aplicar($stock_inicial, -1);

            $stock_inicial->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Stock inicial deleted.')]);

        return back();
    }

    /**
     * Apply (or revert, with sign -1) a stock inicial to its bodega, in the kardex.
     */
    private function aplicar(StockInicial $stockInicial, int $sign): void
    {
        app(Kardex::class)->mover(
            (int) $stockInicial->producto_id,
            (int) $stockInicial->bodega_id,
            $sign * (float) $stockInicial->cantidad,
            MovimientoStock::STOCK_INICIAL,
            ['stock_inicial', $stockInicial->id],
            reverso: $sign < 0,
        );
    }
}
