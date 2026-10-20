<?php

namespace App\Modules\Catalogo\Http\Controllers;

use App\Http\Controllers\Concerns\HandlesTrash;
use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Http\Requests\StoreProductoRequest;
use App\Modules\Catalogo\Http\Requests\UpdateProductoRequest;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\ImagenProducto;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Models\SubCategoria;
use App\Modules\Compras\Models\DetalleCompra;
use App\Modules\Compras\Models\Proveedor;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockBodega;
use App\Modules\Ventas\Models\DetallePedido;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
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
            'categorias' => $this->categorias(),
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
            'categorias' => $this->categorias(),
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
        $data = $request->safe()->except(['imagenes', 'orden_imagenes', ...$this->preciosOcultos($request)]);

        $producto = Producto::create($data);

        $nuevas = $this->guardarImagenes($producto, $request->file('imagenes', []));
        $this->ordenarImagenes($producto, $request->input('orden_imagenes', []), $nuevas);

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
            'producto' => $producto->load(['categoria', 'subCategoria', 'imagenes']),
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
            'producto' => $producto->load('imagenes'),
            'categorias' => $this->categorias(),
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
        $data = $request->safe()->except(['imagenes', 'orden_imagenes', 'remove_imagen_ids', ...$this->preciosOcultos($request)]);

        $producto->update($data);

        $producto->imagenes()->whereKey($request->input('remove_imagen_ids', []))->get()->each(function (ImagenProducto $imagen): void {
            Storage::disk('public')->delete($imagen->imagen_producto);
            $imagen->delete();
        });

        $nuevas = $this->guardarImagenes($producto, $request->file('imagenes', []));
        $this->ordenarImagenes($producto, $request->input('orden_imagenes', []), $nuevas);

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
        ]));
    }

    /**
     * Categorias with their subcategorias, for the form selects.
     *
     * @return Collection<int, Categoria>
     */
    private function categorias()
    {
        return Categoria::with('subCategorias:id,categoria_id,nombre_sub_categoria')
            ->orderBy('nombre_categoria')
            ->get(['id', 'nombre_categoria']);
    }

    /**
     * Store the uploaded files as imagenes of the producto, after the ones it has.
     *
     * @param  list<UploadedFile>  $archivos
     * @return list<ImagenProducto> In the order of the files.
     */
    private function guardarImagenes(Producto $producto, array $archivos): array
    {
        $orden = (int) $producto->imagenes()->max('orden');
        $creadas = [];

        foreach ($archivos as $archivo) {
            $creadas[] = $producto->imagenes()->create([
                'imagen_producto' => $archivo->store('productos', 'public'),
                'orden' => ++$orden,
            ]);
        }

        return $creadas;
    }

    /**
     * Apply the order the user chose to the imagenes (the first one is the cover).
     * Imagenes left out of the list keep their place after the listed ones.
     *
     * @param  list<string>  $orden  `e<id>` for a saved imagen, `n<index>` for the n-th uploaded one.
     * @param  list<ImagenProducto>  $nuevas
     */
    private function ordenarImagenes(Producto $producto, array $orden, array $nuevas): void
    {
        if ($orden === []) {
            return;
        }

        $propias = $producto->imagenes()->pluck('id')->all();

        $ids = collect($orden)
            ->map(fn (string $ficha): ?int => str_starts_with($ficha, 'e')
                ? (int) substr($ficha, 1)
                : ($nuevas[(int) substr($ficha, 1)]->id ?? null))
            ->filter(fn (?int $id): bool => $id !== null && in_array($id, $propias, true))
            ->unique();

        $ids = $ids->merge(array_diff($propias, $ids->all()))->values();

        foreach ($ids as $posicion => $id) {
            ImagenProducto::whereKey($id)->update(['orden' => $posicion + 1]);
        }
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
                'id', 'categoria_id', 'sub_categoria_id', 'inventariable', 'sku', 'marca', 'referencia_producto',
                'descripcion_producto', 'costo_producto', 'valor_detal', 'valor_mayorista',
            ]);

        $categorias = Categoria::pluck('nombre_categoria', 'id');
        $subCategorias = SubCategoria::pluck('nombre_sub_categoria', 'id');
        $imagenes = ImagenProducto::query()
            ->whereIn('producto_id', $productos->pluck('id'))
            ->orderBy('orden')
            ->orderBy('id')
            ->get(['id', 'producto_id', 'imagen_producto'])
            ->groupBy('producto_id');

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
        $verStockBodegas = $puede('view-stock-bodegas');

        // Without `productos.view-sin-stock`, inventoried products with no stock
        // and no pending purchase are left out: nothing says they will come back.
        if (! $puede('view-sin-stock')) {
            $productos = $productos->reject(fn (object $producto): bool => $producto->inventariable
                && $stock->get($producto->id, collect())->sum('stock') <= 0
                && ! $pendientes->has($producto->id))->values();
        }

        return $productos->map(function (object $producto) use ($stock, $pendientes, $dinero, $usuario, $verStockTotal, $verPendiente, $verAlmacenP, $verStockBodegas, $categorias, $subCategorias, $imagenes): array {
            $filasStock = $stock->get($producto->id, collect());
            $filasImagenes = $imagenes->get($producto->id, collect());
            $filasPendientes = $pendientes->get($producto->id, collect());
            $proveedores = $filasPendientes->pluck('nombre_proveedor')->filter()->unique()->values();

            return [
                'id' => $producto->id,
                'categoria_id' => $producto->categoria_id,
                'categoria' => $categorias[$producto->categoria_id] ?? null,
                'sub_categoria_id' => $producto->sub_categoria_id,
                'sub_categoria' => $subCategorias[$producto->sub_categoria_id] ?? null,
                'inventariable' => (bool) $producto->inventariable,
                'sku' => $producto->sku,
                'marca' => $producto->marca,
                'referencia_producto' => $producto->referencia_producto,
                'descripcion_producto' => $producto->descripcion_producto,
                'costo_producto' => $usuario->puedeVerPrecio('costo') ? $dinero($producto->costo_producto) : null,
                'valor_detal' => $usuario->puedeVerPrecio('valor_detal') ? $dinero($producto->valor_detal) : null,
                'valor_mayorista' => $usuario->puedeVerPrecio('valor_mayorista') ? $dinero($producto->valor_mayorista) : null,
                'imagenes' => $filasImagenes->map(fn (ImagenProducto $imagen): array => ['id' => $imagen->id, 'url' => $imagen->url])->values()->all(),
                'imagen_producto_url' => $filasImagenes->first()?->url,
                'concatenar_codigo_nombre' => Producto::nombreDe($producto->referencia_producto, $producto->marca, $producto->descripcion_producto),
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
            'canViewStockBodegas' => $request->user()->can('productos.view-stock-bodegas'),
            'canExport' => $request->user()->can('productos.export'),
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
