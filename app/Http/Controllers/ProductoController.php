<?php

namespace App\Http\Controllers;

use App\Http\Controllers\Concerns\HandlesTrash;
use App\Http\Requests\Productos\StoreProductoRequest;
use App\Http\Requests\Productos\UpdateProductoRequest;
use App\Models\Bodega;
use App\Models\DetalleCompra;
use App\Models\DetallePedido;
use App\Models\Marca;
use App\Models\Producto;
use App\Models\Proveedor;
use App\Models\StockBodega;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class ProductoController extends Controller
{
    use HandlesTrash;

    /**
     * Display a listing of productos.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('productos.view');

        $eliminados = $this->verEliminados($request, 'productos');

        return Inertia::render('productos/index', [
            'productos' => $this->listado($eliminados),
            'eliminados' => $eliminados,
            'bodegas' => Bodega::orderBy('nombre_bodega')->get(['id', 'nombre_bodega']),
            'marcas' => Marca::orderBy('marca')->get(['id', 'marca']),
            'permissions' => $this->permissions($request),
        ]);
    }

    /**
     * Show the form for creating a new producto.
     */
    public function create(Request $request): Response
    {
        Gate::authorize('productos.create');

        return Inertia::render('productos/create', [
            'marcas' => Marca::orderBy('marca')->get(['id', 'marca']),
            'permissions' => $this->permissions($request),
        ]);
    }

    /**
     * Store a newly created producto.
     */
    public function store(StoreProductoRequest $request): RedirectResponse
    {
        // From the POS (`stay_on_page`) `pos.create-producto` is enough.
        abort_unless(
            $request->user()->can('productos.create')
                || ($request->boolean('stay_on_page') && $request->user()->can('pos.create-producto')),
            403,
        );

        // A price the user cannot see is left at its default.
        $data = $request->safe()->except($this->preciosOcultos($request));

        if ($request->hasFile('imagen_producto')) {
            $data['imagen_producto'] = $request->file('imagen_producto')->store('productos', 'public');
        }

        $data['concatenar_codigo_nombre'] = $this->buildConcatenacion($data);

        Producto::create($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Producto created.')]);

        // Created from another screen (the POS): stay there.
        if ($request->boolean('stay_on_page')) {
            return back();
        }

        return to_route('productos.index');
    }

    /**
     * Display the specified producto.
     */
    public function show(Request $request, Producto $producto): Response
    {
        Gate::authorize('productos.view');

        $producto->makeHidden($this->preciosOcultos($request));

        return Inertia::render('productos/show', [
            'producto' => $producto->load('marca'),
            'permissions' => $this->permissions($request),
        ]);
    }

    /**
     * List the pedido and compra detail history for the specified producto,
     * paginated independently so a product with a long history doesn't
     * require loading every record at once.
     */
    public function detalles(Request $request, Producto $producto): JsonResponse
    {
        Gate::authorize('productos.view');

        $detallePedidosQuery = DetallePedido::query()->where('producto_id', $producto->id);
        $detalleComprasQuery = DetalleCompra::query()->where('producto_id', $producto->id);

        $totalVendido = (clone $detallePedidosQuery)->sum('cantidad');
        $totalComprado = (clone $detalleComprasQuery)->sum('cantidad');

        $detallePedidos = $detallePedidosQuery
            ->with([
                'pedido:id,fecha,estado,cliente_id',
                'pedido.cliente:id,razon_social',
            ])
            ->orderByDesc('id')
            ->paginate(10, ['*'], 'pedidos_page');

        $detalleCompras = $detalleComprasQuery
            ->with([
                'compra:id,factura,fecha,estado,proveedor_id',
                'compra.proveedor:id,nombre_proveedor',
                'bodega:id,nombre_bodega',
            ])
            ->orderByDesc('id')
            ->paginate(10, ['*'], 'compras_page');

        return response()->json([
            'detallePedidos' => $detallePedidos,
            'detalleCompras' => $detalleCompras,
            'totalComprado' => (float) $totalComprado,
            'totalVendido' => (float) $totalVendido,
        ]);
    }

    /**
     * Show the form for editing the specified producto.
     */
    public function edit(Request $request, Producto $producto): Response
    {
        Gate::authorize('productos.update');

        $producto->makeHidden($this->preciosOcultos($request));

        return Inertia::render('productos/edit', [
            'producto' => $producto->load('marca'),
            'marcas' => Marca::orderBy('marca')->get(['id', 'marca']),
            'permissions' => $this->permissions($request),
        ]);
    }

    /**
     * Update the specified producto.
     */
    public function update(UpdateProductoRequest $request, Producto $producto): RedirectResponse
    {
        Gate::authorize('productos.update');

        // A price the user cannot see is not overwritten from the form.
        $data = $request->safe()->except(['imagen_producto', 'remove_imagen_producto', ...$this->preciosOcultos($request)]);

        if ($request->hasFile('imagen_producto')) {
            if ($producto->imagen_producto) {
                Storage::disk('public')->delete($producto->imagen_producto);
            }

            $data['imagen_producto'] = $request->file('imagen_producto')->store('productos', 'public');
        } elseif ($request->boolean('remove_imagen_producto') && $producto->imagen_producto) {
            Storage::disk('public')->delete($producto->imagen_producto);
            $data['imagen_producto'] = null;
        }

        $data['concatenar_codigo_nombre'] = $this->buildConcatenacion($data);

        $producto->update($data);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Producto updated.')]);

        return to_route('productos.index');
    }

    /**
     * Remove the specified producto.
     */
    public function destroy(Producto $producto): RedirectResponse
    {
        Gate::authorize('productos.delete');

        $producto->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Producto deleted.')]);

        return to_route('productos.index');
    }

    /**
     * Build the display concatenation of reference, brand and description.
     *
     * @param  array<string, mixed>  $data
     */
    /**
     * The price columns this user may not see: they are neither sent to them
     * nor taken from their forms.
     *
     * @return list<string>
     */
    private function preciosOcultos(Request $request): array
    {
        $usuario = $request->user();

        return array_values(array_filter([
            $usuario->puedeVerPrecio('costo') ? null : 'costo_producto',
            $usuario->puedeVerPrecio('valor_detal') ? null : 'valor_detal',
            $usuario->puedeVerPrecio('valor_mayorista') ? null : 'valor_mayorista',
            $usuario->can('productos.view-sin-instalacion') ? null : 'valor_sin_instalacion',
        ]));
    }

    private function buildConcatenacion(array $data): string
    {
        $marca = Marca::whereKey($data['marca_id'] ?? null)->first();

        return implode('-', array_filter([
            $data['referencia_producto'] ?? null,
            $marca?->marca,
            $data['descripcion_producto'] ?? null,
        ]));
    }

    /**
     * The productos listing with its stock per bodega and pending purchases.
     *
     * Built from plain rows plus three small queries instead of hydrating
     * every model with its relations (which took seconds and megabytes): the
     * listing has thousands of products and only needs a handful of numbers
     * from each.
     *
     * @return list<array<string, mixed>>
     */
    private function listado(bool $eliminados): array
    {
        $productos = Producto::query()
            ->when($eliminados, fn ($query) => $query->onlyTrashed())
            ->orderBy('referencia_producto')
            ->toBase()
            ->get([
                'id', 'categoria', 'tipo', 'inventariable', 'sku', 'ancho', 'perfil', 'construccion', 'rin',
                'tipo_vehiculo', 'diametro', 'marca_id', 'referencia_producto', 'descripcion_producto',
                'costo_producto', 'valor_detal', 'valor_mayorista', 'valor_sin_instalacion',
                'imagen_producto', 'concatenar_codigo_nombre',
            ]);

        $marcas = Marca::pluck('marca', 'id');

        $stock = StockBodega::query()
            ->whereIn('producto_id', $productos->pluck('id'))
            ->get(['producto_id', 'bodega_id', 'stock'])
            ->groupBy('producto_id');

        // Pending (not yet received) purchase lines, with their proveedor.
        $proveedores = (new Proveedor)->getTable();

        $pendientes = DB::table('detalle_compras')
            ->join('compras', 'compras.id', '=', 'detalle_compras.compra_id')
            ->leftJoin($proveedores, "{$proveedores}.id", '=', 'compras.proveedor_id')
            ->where('detalle_compras.estado_entrega', 'PENDIENTE')
            ->whereNull('detalle_compras.deleted_at')
            ->whereNull('compras.deleted_at')
            ->get(['detalle_compras.producto_id', 'detalle_compras.cantidad', "{$proveedores}.nombre_proveedor"])
            ->groupBy('producto_id');

        $usuario = auth()->user();
        $dinero = fn (mixed $valor): ?string => $valor === null ? null : number_format((float) $valor, 2, '.', '');

        $puede = fn (string $accion): bool => $usuario->can("productos.{$accion}");
        $verStockTotal = $puede('view-stock-total');
        $verPendiente = $puede('view-pendiente');
        $verAlmacenP = $puede('view-almacen-p');
        $verSinInstalacion = $puede('view-sin-instalacion');
        $verStockBodegas = $puede('view-stock-bodegas');

        // Without `productos.view-sin-stock`, inventoried products with no stock
        // and no pending purchase are left out: nothing says they will come back.
        if (! $puede('view-sin-stock')) {
            $productos = $productos->reject(fn (object $producto): bool => $producto->inventariable
                && $stock->get($producto->id, collect())->sum('stock') <= 0
                && ! $pendientes->has($producto->id))->values();
        }

        return $productos->map(function (object $producto) use ($marcas, $stock, $pendientes, $dinero, $usuario, $verStockTotal, $verPendiente, $verAlmacenP, $verSinInstalacion, $verStockBodegas): array {
            $filasStock = $stock->get($producto->id, collect());
            $filasPendientes = $pendientes->get($producto->id, collect());
            $proveedores = $filasPendientes->pluck('nombre_proveedor')->filter()->unique()->values();

            return [
                'id' => $producto->id,
                'categoria' => $producto->categoria,
                'tipo' => $producto->tipo,
                'inventariable' => (bool) $producto->inventariable,
                'sku' => $producto->sku,
                'ancho' => $producto->ancho,
                'perfil' => $producto->perfil,
                'construccion' => $producto->construccion,
                'rin' => $producto->rin,
                'tipo_vehiculo' => $producto->tipo_vehiculo,
                'diametro' => $producto->diametro,
                'marca_id' => $producto->marca_id,
                'marca' => isset($marcas[$producto->marca_id])
                    ? ['id' => $producto->marca_id, 'marca' => $marcas[$producto->marca_id]]
                    : null,
                'referencia_producto' => $producto->referencia_producto,
                'descripcion_producto' => $producto->descripcion_producto,
                'costo_producto' => $usuario->puedeVerPrecio('costo') ? $dinero($producto->costo_producto) : null,
                'valor_detal' => $usuario->puedeVerPrecio('valor_detal') ? $dinero($producto->valor_detal) : null,
                'valor_mayorista' => $usuario->puedeVerPrecio('valor_mayorista') ? $dinero($producto->valor_mayorista) : null,
                'valor_sin_instalacion' => $verSinInstalacion ? $dinero($producto->valor_sin_instalacion) : null,
                'imagen_producto_url' => $producto->imagen_producto ? Storage::disk('public')->url($producto->imagen_producto) : null,
                'concatenar_codigo_nombre' => $producto->concatenar_codigo_nombre,
                'stock_total' => $verStockTotal ? (float) $filasStock->sum('stock') : null,
                // Units still to arrive: the quantity of every pending purchase line.
                'pendiente' => $verPendiente ? (float) $filasPendientes->sum('cantidad') : null,
                'proveedor_pendiente' => $verAlmacenP && $proveedores->isNotEmpty() ? $proveedores->implode(', ') : null,
                'stock_por_bodega' => $verStockBodegas ? $filasStock->pluck('stock', 'bodega_id') : null,
            ];
        })->all();
    }

    /**
     * @return array<string, bool>
     */
    private function permissions(Request $request): array
    {
        return [
            'canCreate' => $request->user()->can('productos.create'),
            'canUpdate' => $request->user()->can('productos.update'),
            'canDelete' => $request->user()->can('productos.delete'),
            'canViewDeleted' => $request->user()->can('productos.view-deleted'),
            'canRestore' => $request->user()->can('productos.restore'),
            'canViewStockTotal' => $request->user()->can('productos.view-stock-total'),
            'canViewPendiente' => $request->user()->can('productos.view-pendiente'),
            'canViewAlmacenP' => $request->user()->can('productos.view-almacen-p'),
            'canViewSinInstalacion' => $request->user()->can('productos.view-sin-instalacion'),
            'canViewStockBodegas' => $request->user()->can('productos.view-stock-bodegas'),
            // The same permissions the traslado store accepts.
            'canCreateTraslado' => $request->user()->canAny(['traslados.create', 'stock-bodegas.create-traslado']),
        ];
    }

    /**
     * Restore a deleted producto.
     */
    public function restore(Producto $producto): RedirectResponse
    {
        return $this->restaurarRegistro('productos', $producto, __('Producto restored.'));
    }
}
