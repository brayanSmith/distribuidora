<?php

namespace App\Modules\Compras\Http\Controllers;

use App\Http\Controllers\Concerns\HandlesTrash;
use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Compras\Http\Requests\StoreCompraRequest;
use App\Modules\Compras\Http\Requests\UpdateCompraRequest;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\DetalleCompra;
use App\Modules\Compras\Models\Proveedor;
use App\Modules\Compras\Services\RecepcionCompras;
use App\Modules\Finanzas\Models\Puc;
use App\Modules\Inventario\Models\Bodega;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class CompraController extends Controller
{
    use HandlesTrash;

    /**
     * Display a listing of compras.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('compras.view');

        $eliminados = $this->verEliminados($request, 'compras');

        return Inertia::render('compras/index', [
            'compras' => Compra::select(['id', 'factura', 'proveedor_id', 'fecha', 'estado', 'subtotal', 'descuento', 'total_a_pagar', 'tipo_pago', 'abono', 'saldo_pendiente', 'estado_pago', 'fecha_vencimiento', 'deleted_at'])
                ->with([
                    'proveedor:id,nombre_proveedor',
                    // Only what the listing shows: the table has a column per bodega with its products.
                    'detallesCompra' => fn ($query) => $query->withTrashed()
                        ->select(['id', 'compra_id', 'producto_id', 'bodega_id'])
                        ->with(['producto:id,referencia_producto,descripcion_producto,marca', 'bodega:id,nombre_bodega']),
                ])
                ->when($eliminados, fn ($query) => $query->onlyTrashed())
                ->orderByDesc('fecha')
                ->get(),
            'eliminados' => $eliminados,
            'permissions' => $this->permissions($request),
            // For paying a compra right from the listing.
            'pucs' => $request->user()->can('compras.create-abono')
                ? Puc::orderBy('concatenar_subcuenta_concepto')->get(['id', 'concatenar_subcuenta_concepto'])
                : [],
        ]);
    }

    /**
     * Show the form for creating a new compra.
     */
    public function create(Request $request): Response
    {
        Gate::authorize('compras.create');

        return Inertia::render('compras/create', $this->formData());
    }

    /**
     * Store a newly created compra.
     */
    public function store(StoreCompraRequest $request): RedirectResponse
    {
        Gate::authorize('compras.create');

        $data = $request->validated();

        DB::transaction(function () use ($data, $request): void {
            $compra = Compra::create([
                'factura' => $data['factura'],
                'proveedor_id' => $data['proveedor_id'],
                'fecha' => $data['fecha'],
                'observaciones' => $data['observaciones'] ?? null,
                'descuento' => $data['descuento'] ?? 0,
                'subtotal' => 0,
                'total_a_pagar' => 0,
                'fecha_vencimiento' => $data['fecha_vencimiento']
                    ?? Compra::vencimientoPorDefecto(Proveedor::find($data['proveedor_id']), $data['fecha']),
            ]);

            $this->syncDetalles($compra, $data['detalles']);
            $compra->registrarCambioDetalles(null);
            $this->registrarAbonos($compra, $data['abonos'] ?? [], $request->user()->id);
            $this->fijarTipoPago($compra->fresh(), $data['tipo_pago'] ?? null);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Compra created.')]);

        if ($request->boolean('stay_on_page')) {
            return back();
        }

        return to_route('compras.index');
    }

    /**
     * The full detail of a compra (header and lines) as JSON, for the
     * read-only "ver" modal. Loaded on demand so the listing stays light.
     */
    public function show(Compra $compra): JsonResponse
    {
        Gate::authorize('compras.view');

        return response()->json($compra->load([
            'proveedor:id,nombre_proveedor,nit_proveedor,telefono_proveedor',
            'abonos' => fn ($query) => $query->with(['puc:id,concatenar_subcuenta_concepto', 'user:id,name'])->orderBy('fecha'),
            'detallesCompra' => fn ($query) => $query->withTrashed()
                ->with(['producto:id,referencia_producto,descripcion_producto,marca', 'bodega:id,nombre_bodega']),
        ]));
    }

    /**
     * Show the form for editing the specified compra.
     */
    public function edit(Request $request, Compra $compra): Response
    {
        Gate::authorize('compras.update');

        return Inertia::render('compras/edit', [
            'compra' => $compra->load(['proveedor', 'detallesCompra.producto', 'detallesCompra.bodega']),
            ...$this->formData(),
            'permissions' => ['canDelete' => $request->user()->can('compras.delete')],
        ]);
    }

    /**
     * Update the specified compra.
     */
    public function update(UpdateCompraRequest $request, Compra $compra): RedirectResponse
    {
        Gate::authorize('compras.update');

        $data = $request->validated();

        DB::transaction(function () use ($compra, $data): void {
            $detallesAntes = $compra->resumenDetalles();
            $totalAntes = (float) $compra->total_a_pagar;

            foreach ($compra->detallesCompra as $detalle) {
                $this->adjustStock($detalle, -1);
            }

            $compra->detallesCompra()->forceDelete();

            $compra->update([
                'factura' => $data['factura'],
                'proveedor_id' => $data['proveedor_id'],
                'fecha' => $data['fecha'],
                'observaciones' => $data['observaciones'] ?? null,
                'descuento' => $data['descuento'] ?? 0,
                'fecha_vencimiento' => $data['fecha_vencimiento']
                    ?? $compra->fecha_vencimiento?->toDateString()
                    ?? Compra::vencimientoPorDefecto(Proveedor::find($data['proveedor_id']), $data['fecha']),
            ]);

            $this->syncDetalles($compra, $data['detalles']);
            $compra->registrarCambioDetalles($detallesAntes, $totalAntes);
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Compra updated.')]);

        return to_route('compras.edit', ['compra' => $compra]);
    }

    /**
     * Remove the specified compra.
     */
    public function destroy(Compra $compra): RedirectResponse
    {
        Gate::authorize('compras.delete');

        DB::transaction(function () use ($compra): void {
            foreach ($compra->detallesCompra as $detalle) {
                $this->adjustStock($detalle, -1);
            }

            $compra->detallesCompra()->delete();
            $compra->delete();
        });

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Compra deleted.')]);

        return to_route('compras.index');
    }

    /**
     * Replace the compra's detalles, recomputing totals, estado and warehouse stock.
     *
     * @param  array<int, array{producto_id: int, bodega_id: int, cantidad: float|string, precio_unitario: float|string, recibido?: bool}>  $detalles
     */
    private function syncDetalles(Compra $compra, array $detalles): void
    {
        $subtotal = 0;

        foreach ($detalles as $item) {
            $cantidad = (float) $item['cantidad'];
            $precioUnitario = (float) $item['precio_unitario'];
            $itemSubtotal = $cantidad * $precioUnitario;
            $subtotal += $itemSubtotal;

            // Received: all of it; otherwise what had already arrived (partial receipts).
            $recibida = ! empty($item['recibido'])
                ? $cantidad
                : min(max((float) ($item['cantidad_recibida'] ?? 0), 0), $cantidad);

            $detalle = $compra->detallesCompra()->create([
                'producto_id' => $item['producto_id'],
                'bodega_id' => $item['bodega_id'],
                'cantidad' => $cantidad,
                'cantidad_recibida' => $recibida,
                'precio_unitario' => $precioUnitario,
                'subtotal' => $itemSubtotal,
                'estado_entrega' => $recibida >= $cantidad ? 'RECIBIDA' : 'PENDIENTE',
            ]);

            $this->adjustStock($detalle, 1);
            $this->actualizarCostoProducto($compra, $item['producto_id'], $precioUnitario);
        }

        $descuento = (float) $compra->descuento;

        $compra->update([
            'subtotal' => $subtotal,
            'total_a_pagar' => max($subtotal - $descuento, 0),
            'estado' => $compra->detallesCompra()->where('estado_entrega', 'PENDIENTE')->doesntExist() ? 'RECIBIDA' : 'PENDIENTE',
        ]);

        // The total may have changed: what is owed follows it.
        $compra->recalcularPagos();
    }

    /**
     * CONTADO must be paid in full right away, so it is never due later;
     * without a tipo it is CONTADO when the payments cover the total.
     */
    private function fijarTipoPago(Compra $compra, ?string $tipoPago): void
    {
        $pagada = (float) $compra->saldo_pendiente <= 0;
        $tipoPago ??= $pagada ? 'CONTADO' : 'CREDITO';

        if ($tipoPago === 'CONTADO' && ! $pagada) {
            throw ValidationException::withMessages(['abonos' => __('A cash compra must be paid in full.')]);
        }

        $compra->update([
            'tipo_pago' => $tipoPago,
            'fecha_vencimiento' => $tipoPago === 'CONTADO' ? null : $compra->fecha_vencimiento,
        ]);
    }

    /**
     * The payments made to the proveedor while registering the compra.
     *
     * @param  list<array{puc_id: int, monto: float|string, descripcion?: string|null}>  $abonos
     */
    private function registrarAbonos(Compra $compra, array $abonos, int $userId): void
    {
        $total = (float) $compra->fresh()->total_a_pagar;

        if (array_sum(array_column($abonos, 'monto')) > $total + 0.001) {
            throw ValidationException::withMessages(['abonos' => __('The payments are more than the total of the compra.')]);
        }

        foreach ($abonos as $abono) {
            $compra->abonos()->create([
                'fecha' => now(),
                'monto' => $abono['monto'],
                'puc_id' => $abono['puc_id'],
                'descripcion' => $abono['descripcion'] ?? null,
                'user_id' => $userId,
            ]);
        }

        $compra->recalcularPagos();
    }

    /**
     * Update the producto's costo_producto to this compra's unit price, but
     * only when this compra is the most recent purchase of that producto.
     * Editing an older compra must never overwrite a cost set by a newer one.
     */
    private function actualizarCostoProducto(Compra $compra, int $productoId, float $precioUnitario): void
    {
        $hayCompraMasReciente = DetalleCompra::query()
            ->where('producto_id', $productoId)
            ->where('compra_id', '!=', $compra->id)
            ->whereHas('compra', fn ($query) => $query
                ->where('fecha', '>', $compra->fecha)
                ->orWhere(fn ($query) => $query->where('fecha', $compra->fecha)->where('id', '>', $compra->id)))
            ->exists();

        if ($hayCompraMasReciente) {
            return;
        }

        Producto::find($productoId)?->update(['costo_producto' => $precioUnitario]);
    }

    /**
     * Apply (or revert) what arrived of a detalle to the warehouse stock.
     */
    private function adjustStock(DetalleCompra $detalle, int $sign): void
    {
        app(RecepcionCompras::class)->moverStock($detalle, $sign * (float) $detalle->cantidad_recibida);
    }

    /**
     * @return array{proveedores: Collection, productos: Collection, bodegas: Collection}
     */
    private function formData(): array
    {
        return [
            'proveedores' => Proveedor::orderBy('nombre_proveedor')->get(['id', 'nombre_proveedor']),
            'productos' => Producto::where('inventariable', true)
                ->orderBy('referencia_producto')
                ->get(['id', 'referencia_producto', 'descripcion_producto', 'marca', 'costo_producto']),
            'bodegas' => Bodega::orderBy('nombre_bodega')->get(['id', 'nombre_bodega']),
        ];
    }

    /**
     * @return array{canCreate: bool, canUpdate: bool, canDelete: bool}
     */
    private function permissions(Request $request): array
    {
        return [
            'canCreate' => $request->user()->can('compras.create'),
            'canUpdate' => $request->user()->can('compras.update'),
            'canDelete' => $request->user()->can('compras.delete'),
            'canViewDeleted' => $request->user()->can('compras.view-deleted'),
            'canRestore' => $request->user()->can('compras.restore'),
            'canCreateAbono' => $request->user()->can('compras.create-abono'),
            'canDeleteAbono' => $request->user()->can('compras.delete-abono'),
        ];
    }

    /**
     * Restore a deleted compra with its lines, receiving again the stock
     * of the lines that had been received.
     */
    public function restore(Compra $compra): RedirectResponse
    {
        return $this->restaurarRegistro('compras', $compra, __('Compra restored.'), function (Compra $compra): void {
            DB::transaction(function () use ($compra): void {
                $compra->detallesCompra()->onlyTrashed()->get()->each(function (DetalleCompra $detalle): void {
                    $detalle->restore();
                    $this->adjustStock($detalle, 1);
                });
            });
        });
    }
}
