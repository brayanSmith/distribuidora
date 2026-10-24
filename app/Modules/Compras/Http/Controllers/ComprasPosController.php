<?php

namespace App\Modules\Compras\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\Proveedor;
use App\Modules\Finanzas\Models\Puc;
use App\Modules\Inventario\Models\Bodega;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

/**
 * A point-of-sale-like screen to register purchases quickly: a catalog of the
 * products that carry stock on the left, the compra being built on the right.
 * It saves through CompraController::store, so the stock and costs follow the
 * same rules as the regular form.
 */
class ComprasPosController extends Controller
{
    public function index(Request $request): Response
    {
        Gate::authorize('compras.create');

        $usuario = $request->user();

        return Inertia::render('compras-pos/index', [
            'productos' => $this->catalogo($usuario),
            'categorias' => Categoria::with('subCategorias:id,categoria_id,nombre_sub_categoria')
                ->orderBy('nombre_categoria')
                ->get(['id', 'nombre_categoria']),
            'proveedores' => $this->proveedores(),
            'bodegas' => Bodega::permitidas()->orderBy('nombre_bodega')->get(['id', 'nombre_bodega']),
            'canCreateProveedor' => $usuario->can('proveedores.create'),
            'canUpdatePrecios' => $usuario->can('productos.update'),
            'canCreateProducto' => $usuario->can('productos.create'),
            // To pay the proveedor while registering the compra.
            'canCreateAbono' => $usuario->can('compras.create-abono'),
            'pucs' => $usuario->can('compras.create-abono')
                ? Puc::orderBy('concatenar_subcuenta_concepto')->get(['id', 'concatenar_subcuenta_concepto'])
                : [],
        ]);
    }

    /**
     * The Compras POS in edit mode: a saved compra loaded in the cart, to
     * change it with the same screen it was registered with.
     */
    public function editar(Request $request, Compra $compra): Response
    {
        Gate::authorize('compras.update');

        $usuario = $request->user();
        $compra->load(['detallesCompra:id,compra_id,producto_id,bodega_id,cantidad,cantidad_recibida,precio_unitario', 'proveedor', 'abonos.puc', 'abonos.user:id,name']);

        return Inertia::render('compras/editar', [
            'compra' => $compra,
            // Its lines show their productos even if they were deleted since.
            'productos' => $this->catalogo($usuario, $compra->detallesCompra->pluck('producto_id')->all()),
            'categorias' => Categoria::with('subCategorias:id,categoria_id,nombre_sub_categoria')
                ->orderBy('nombre_categoria')
                ->get(['id', 'nombre_categoria']),
            'proveedores' => $this->proveedores(),
            // The authorized bodegas, and those the compra already uses.
            'bodegas' => Bodega::query()
                ->where(fn ($query) => $query
                    ->whereIn('id', Bodega::permitidas()->select('id'))
                    ->orWhereIn('id', $compra->detallesCompra->pluck('bodega_id')))
                ->orderBy('nombre_bodega')
                ->get(['id', 'nombre_bodega']),
            'canCreateProveedor' => $usuario->can('proveedores.create'),
            'canUpdatePrecios' => $usuario->can('productos.update'),
            'canCreateProducto' => $usuario->can('productos.create'),
            'canCreateAbono' => $usuario->can('compras.create-abono'),
            'canDeleteAbono' => $usuario->can('compras.delete-abono'),
            'canDelete' => $usuario->can('compras.delete'),
            'pucs' => $usuario->can('compras.create-abono')
                ? Puc::orderBy('concatenar_subcuenta_concepto')->get(['id', 'concatenar_subcuenta_concepto'])
                : [],
        ]);
    }

    /**
     * The productos that can be bought, as the catalog cards need them.
     *
     * @param  list<int>  $tambienEliminados  Deleted productos to list anyway (the lines of an edited compra).
     * @return array<int, array<string, mixed>>
     */
    private function catalogo(User $usuario, array $tambienEliminados = []): array
    {
        return Producto::query()
            ->when($tambienEliminados !== [], fn ($query) => $query->withTrashed()->where(fn ($query) => $query
                ->whereNull('deleted_at')
                ->orWhereIn('id', $tambienEliminados)))
            ->where('inventariable', true)
            ->select(['id', 'categoria_id', 'sub_categoria_id', 'sku', 'referencia_producto', 'descripcion_producto', 'marca', 'costo_producto', 'valor_detal', 'valor_mayorista'])
            ->with([
                'subCategoria:id,nombre_sub_categoria',
                'imagenes:id,producto_id,imagen_producto',
            ])
            ->with('stockBodegas:id,producto_id,bodega_id,stock')
            ->orderBy('referencia_producto')
            ->get()
            ->map(fn (Producto $producto): array => [
                'id' => $producto->id,
                'nombre' => $producto->concatenar_codigo_nombre,
                'sku' => $producto->sku,
                'categoria_id' => $producto->categoria_id,
                'sub_categoria' => $producto->subCategoria?->nombre_sub_categoria,
                // The last cost is the starting price of a line; hidden from
                // whoever may not see costs (they type it).
                'costo_producto' => $usuario->puedeVerPrecio('costo') ? (float) $producto->costo_producto : null,
                'valor_detal' => $usuario->puedeVerPrecio('valor_detal') ? (float) $producto->valor_detal : null,
                'valor_mayorista' => $usuario->puedeVerPrecio('valor_mayorista') ? (float) $producto->valor_mayorista : null,
                'imagen_producto_url' => $producto->imagenes->first()?->url,
                'imagenes' => $producto->imagenes->map->url->values()->all(),
                'stock_total' => (float) $producto->stockBodegas->sum('stock'),
                'stock_por_bodega' => $producto->stockBodegas->mapWithKeys(fn ($stock): array => [$stock->bodega_id => (float) $stock->stock])->all(),
            ])
            ->all();
    }

    /**
     * @return Collection<int, Proveedor>
     */
    private function proveedores(): Collection
    {
        return Proveedor::orderBy('nombre_proveedor')->get([
            'id', 'nombre_proveedor', 'razon_social_proveedor', 'nit_proveedor', 'telefono_proveedor',
            'ciudad_proveedor', 'direccion_proveedor', 'tipo_proveedor', 'dias_credito',
        ]);
    }
}
