<?php

namespace App\Modules\Inventario\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Http\Requests\StoreTrasladoRequest;
use App\Modules\Inventario\Http\Requests\UpdateTrasladoRequest;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\MovimientoStock;
use App\Modules\Inventario\Models\Traslado;
use App\Modules\Inventario\Services\Kardex;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class TrasladoController extends Controller
{
    /**
     * Display a listing of traslados.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('traslados.view');

        return Inertia::render('traslados/index', [
            'traslados' => Traslado::with(['producto', 'bodegaDonante', 'bodegaDestino'])->latest()->get(),
            'productos' => Producto::where('inventariable', true)
                ->orderBy('referencia_producto')
                ->get(['id', 'referencia_producto', 'descripcion_producto', 'marca', 'costo_producto']),
            'bodegas' => Bodega::orderBy('nombre_bodega')->get(['id', 'nombre_bodega']),
            'permissions' => [
                'canCreate' => $request->user()->can('traslados.create'),
                'canUpdate' => $request->user()->can('traslados.update'),
                'canDelete' => $request->user()->can('traslados.delete'),
            ],
        ]);
    }

    /**
     * Store a newly created traslado.
     */
    public function store(StoreTrasladoRequest $request): RedirectResponse
    {
        // Also created from the "Stock por bodega" table.
        abort_unless(Gate::any(['traslados.create', 'stock-bodegas.create-traslado']), 403);

        $data = $request->validated();

        DB::transaction(function () use ($data): void {
            $traslado = Traslado::create($data);

            $this->applyTraslado($traslado, 1);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Traslado created.')]);

        return back();
    }

    /**
     * Update the specified traslado.
     */
    public function update(UpdateTrasladoRequest $request, Traslado $traslado): RedirectResponse
    {
        Gate::authorize('traslados.update');

        $data = $request->validated();

        DB::transaction(function () use ($traslado, $data): void {
            $this->applyTraslado($traslado, -1);

            $traslado->update($data);

            $this->applyTraslado($traslado, 1);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Traslado updated.')]);

        return back();
    }

    /**
     * Remove the specified traslado.
     */
    public function destroy(Traslado $traslado): RedirectResponse
    {
        Gate::authorize('traslados.delete');

        DB::transaction(function () use ($traslado): void {
            $this->applyTraslado($traslado, -1);

            $traslado->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Traslado deleted.')]);

        return back();
    }

    /**
     * Apply (or revert, with sign -1) a traslado: out of one bodega and into
     * the other, both in the kardex.
     */
    private function applyTraslado(Traslado $traslado, int $sign): void
    {
        $cantidad = $sign * (float) $traslado->cantidad;
        $kardex = app(Kardex::class);
        $documento = ['traslado', $traslado->id];

        $kardex->mover((int) $traslado->producto_id, (int) $traslado->bodega_donante_id, -$cantidad, MovimientoStock::TRASLADO_SALIDA, $documento, reverso: $sign < 0);
        $kardex->mover((int) $traslado->producto_id, (int) $traslado->bodega_destino_id, $cantidad, MovimientoStock::TRASLADO_ENTRADA, $documento, reverso: $sign < 0);
    }
}
