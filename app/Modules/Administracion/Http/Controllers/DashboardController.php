<?php

namespace App\Modules\Administracion\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Finanzas\Models\Gasto;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Ventas\Models\Pedido;
use Illuminate\Database\Eloquent\Builder as EloquentBuilder;
use Illuminate\Database\Query\Builder;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\DB;
use Inertia\Inertia;
use Inertia\Response;

class DashboardController extends Controller
{
    public function __invoke(Request $request): Response
    {
        $filtros = $this->filtros($request);
        $acciones = ['widget-productos', 'widget-ganancia', 'widget-ajustes', 'tabla-bodegas', 'chart-categorias', 'chart-top-productos', 'chart-pedidos', 'alerta-stock'];
        // True when the user may see at least one of the given dashboard parts.
        $puede = fn (string ...$partes): bool => collect($partes)->contains(fn (string $parte) => $request->user()->can("dashboard.{$parte}"));

        return Inertia::render('dashboard', [
            'cantidadPorBodega' => $puede('tabla-bodegas') ? $this->cantidadPorBodega($filtros) : null,
            'resumen' => $puede('widget-productos', 'widget-ganancia', 'widget-ajustes') ? $this->resumen($filtros) : null,
            'graficos' => $puede('chart-categorias', 'chart-top-productos', 'chart-pedidos') ? $this->graficos($filtros) : null,
            'sinStock' => $puede('alerta-stock') ? $this->sinStock($filtros) : null,
            'permisos' => collect($acciones)->mapWithKeys(fn (string $accion) => [$accion => $puede($accion)])->all(),
            'filtros' => $filtros,
            'bodegas' => Bodega::permitidas()->orderBy('nombre_bodega')->get(['id', 'nombre_bodega']),
            // Only products that were ever sold or bought, to keep the list small.
            'productosFiltro' => Producto::query()
                ->where(fn ($query) => $query
                    ->whereIn('id', DB::table('detalle_pedidos')->select('producto_id'))
                    ->orWhereIn('id', DB::table('detalle_compras')->select('producto_id')))
                ->orderBy('referencia_producto')
                ->get(['id', 'referencia_producto', 'descripcion_producto', 'marca']),
        ]);
    }

    /**
     * @return array{bodega_ids: list<string>, desde: string, hasta: string, producto_ids: list<string>}
     */
    private function filtros(Request $request): array
    {
        $datos = $request->validate([
            'bodega_ids' => ['nullable', 'array'],
            'bodega_ids.*' => ['regex:/^(\d+|mayorista)$/'],
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date'],
            'producto_ids' => ['nullable', 'array'],
            'producto_ids.*' => ['integer'],
        ]);

        return [
            // "mayorista" is only offered to whoever may see the mayorista price.
            'bodega_ids' => array_values(array_filter(
                array_map('strval', $datos['bodega_ids'] ?? []),
                fn (string $id) => $id !== 'mayorista' || $request->user()->puedeVerPrecio('valor_mayorista'),
            )),
            'desde' => (string) ($datos['desde'] ?? ''),
            'hasta' => (string) ($datos['hasta'] ?? ''),
            'producto_ids' => array_map('strval', $datos['producto_ids'] ?? []),
        ];
    }

    /**
     * Keeps the rows of the selected bodegas. "mayorista" acts as one more
     * bodega: those orders are kept only when it is selected, and leave the
     * regular bodegas out of the count.
     *
     * @template TQuery of \Illuminate\Contracts\Database\Query\Builder
     *
     * @param  TQuery  $query
     * @param  array<string, mixed>  $filtros
     * @return TQuery
     */
    private function limitarPorBodegas($query, array $filtros, string $columnaBodega)
    {
        $ids = array_values(array_filter($filtros['bodega_ids'], fn (string $id) => $id !== 'mayorista'));
        $incluyeMayorista = in_array('mayorista', $filtros['bodega_ids'], true);

        return $query->where(function ($grupo) use ($ids, $incluyeMayorista, $columnaBodega) {
            $grupo->where(fn ($regular) => $regular
                ->where('pedidos.tipo_precio', '<>', 'MAYORISTA')
                ->whereIn(DB::raw($columnaBodega), array_map('intval', $ids)));

            if ($incluyeMayorista) {
                $grupo->orWhere('pedidos.tipo_precio', 'MAYORISTA');
            }
        });
    }

    /**
     * The day after the "hasta" date: the orders carry a time, so the last
     * day is kept by comparing against the start of the next one.
     */
    private function diaSiguiente(string $fecha): string
    {
        return Carbon::parse($fecha)->addDay()->toDateString();
    }

    /**
     * Sold lines (of non-deleted orders) narrowed by the dashboard filters.
     *
     * @param  array<string, mixed>  $filtros
     */
    private function detalles(array $filtros): Builder
    {
        return DB::table('detalle_pedidos')
            ->join('pedidos', 'pedidos.id', '=', 'detalle_pedidos.pedido_id')
            ->join('productos', 'productos.id', '=', 'detalle_pedidos.producto_id')
            ->whereNull('pedidos.deleted_at')
            ->when($filtros['bodega_ids'] !== [], fn (Builder $query) => $this->limitarPorBodegas($query, $filtros, 'COALESCE(detalle_pedidos.bodega_id, pedidos.bodega_id)'))
            ->when($filtros['desde'] !== '', fn (Builder $query) => $query->where('pedidos.fecha', '>=', $filtros['desde']))
            ->when($filtros['hasta'] !== '', fn (Builder $query) => $query->where('pedidos.fecha', '<', $this->diaSiguiente($filtros['hasta'])))
            ->when($filtros['producto_ids'] !== [], fn (Builder $query) => $query->whereIn('detalle_pedidos.producto_id', $filtros['producto_ids']));
    }

    /**
     * Expenses narrowed by the dashboard filters. They do not depend on
     * products, only on bodega and dates.
     *
     * @param  array<string, mixed>  $filtros
     * @return EloquentBuilder<Gasto>
     */
    private function gastos(array $filtros): EloquentBuilder
    {
        return Gasto::query()
            ->when($filtros['bodega_ids'] !== [], fn ($query) => $query->whereIn('bodega_id', array_filter($filtros['bodega_ids'], fn (string $id) => $id !== 'mayorista')))
            ->when($filtros['desde'] !== '', fn ($query) => $query->where('fecha_gasto', '>=', $filtros['desde']))
            ->when($filtros['hasta'] !== '', fn ($query) => $query->where('fecha_gasto', '<', $this->diaSiguiente($filtros['hasta'])));
    }

    /**
     * Units sold per bodega split by product categoria. Mayorista orders are
     * pulled out of their bodega and grouped in their own "Mayorista" row.
     *
     * @return array{categorias: list<string>, filas: list<array{almacen: string, cantidades: array<string, int>, total: int, valores: array<string, float>}>, totales: array<string, int>}
     */
    private function cantidadPorBodega(array $filtros): array
    {
        $sinCategoria = 'Sin categoría';

        $ventas = $this->detalles($filtros)
            ->leftJoin('categorias', 'categorias.id', '=', 'productos.categoria_id')
            ->selectRaw("CASE WHEN pedidos.tipo_precio = 'MAYORISTA' THEN 'mayorista' ELSE COALESCE(detalle_pedidos.bodega_id, pedidos.bodega_id) END as grupo")
            ->selectRaw('COALESCE(categorias.nombre_categoria, ?) as categoria, SUM(detalle_pedidos.cantidad) as cantidad, SUM(detalle_pedidos.subtotal) as valor', [$sinCategoria])
            ->groupBy('grupo', 'categoria')
            ->get();

        $categorias = $ventas->pluck('categoria')->unique()->sort()->values()->all();

        $vacia = fn (string $almacen): array => [
            'almacen' => $almacen,
            'cantidades' => array_fill_keys($categorias, 0),
            'total' => 0,
            'valores' => array_fill_keys([...$categorias, 'total'], 0.0),
        ];

        $filas = [];
        $bodegas = Bodega::permitidas()->orderBy('nombre_bodega')
            ->when($filtros['bodega_ids'] !== [], fn ($query) => $query->whereKey(array_filter($filtros['bodega_ids'], fn (string $id) => $id !== 'mayorista')))
            ->get(['id', 'nombre_bodega']);

        foreach ($bodegas as $bodega) {
            $filas['b'.$bodega->id] = $vacia($bodega->nombre_bodega);
        }
        if (auth()->user()->puedeVerPrecio('valor_mayorista') && ($filtros['bodega_ids'] === [] || in_array('mayorista', $filtros['bodega_ids'], true))) {
            $filas['mayorista'] = $vacia('Mayorista');
        }

        foreach ($ventas as $venta) {
            $clave = $venta->grupo === 'mayorista' ? 'mayorista' : 'b'.$venta->grupo;

            if (! isset($filas[$clave])) {
                continue;
            }

            $filas[$clave]['cantidades'][$venta->categoria] += (int) $venta->cantidad;
            $filas[$clave]['total'] += (int) $venta->cantidad;
            $filas[$clave]['valores'][$venta->categoria] += (float) $venta->valor;
            $filas[$clave]['valores']['total'] += (float) $venta->valor;
        }

        $totales = array_fill_keys([...$categorias, 'total'], 0);
        foreach ($filas as $fila) {
            foreach ($categorias as $categoria) {
                $totales[$categoria] += $fila['cantidades'][$categoria];
            }
            $totales['total'] += $fila['total'];
        }

        return ['categorias' => $categorias, 'filas' => array_values($filas), 'totales' => $totales];
    }

    /**
     * The orders the "valor de pedidos" widget adds up. With a product
     * filter an order's total can't be split by line, so the orders
     * that contain those lines are the ones counted.
     *
     * @param  array<string, mixed>  $filtros
     * @return EloquentBuilder<Pedido>
     */
    private function pedidos(array $filtros, Builder $detalles, bool $filtraPorProducto): EloquentBuilder
    {
        return Pedido::query()
            ->when($filtraPorProducto,
                fn ($query) => $query->whereIn('id', (clone $detalles)->select('pedidos.id')),
                fn ($query) => $query
                    ->when($filtros['bodega_ids'] !== [], fn ($query) => $this->limitarPorBodegas($query, $filtros, 'pedidos.bodega_id'))
                    ->when($filtros['desde'] !== '', fn ($query) => $query->where('fecha', '>=', $filtros['desde']))
                    ->when($filtros['hasta'] !== '', fn ($query) => $query->where('fecha', '<', $this->diaSiguiente($filtros['hasta']))));
    }

    /**
     * Data behind the dashboard charts: units by product category, the ten
     * best sellers and the orders per day (count, sales value and cost) plus the
     * expenses per day (the client regroups the days into weeks, months or
     * years and derives the profit line).
     *
     * @param  array<string, mixed>  $filtros
     * @return array{categorias: list<array{categoria: string, cantidad: int, valor: float}>, topProductos: list<array{producto: string, cantidad: int, valor: float}>, pedidosPorFecha: list<array{fecha: string, pedidos: int, cantidad: int, valor: float, inversion: float}>, gastosPorFecha: list<array{fecha: string, gastos: float}>}
     */
    private function graficos(array $filtros): array
    {
        $detalles = $this->detalles($filtros);

        $categorias = (clone $detalles)
            ->leftJoin('categorias', 'categorias.id', '=', 'productos.categoria_id')
            ->selectRaw("COALESCE(categorias.nombre_categoria, 'SIN CATEGORÍA') as categoria, SUM(detalle_pedidos.cantidad) as cantidad, SUM(detalle_pedidos.subtotal) as valor")
            ->groupBy('categorias.nombre_categoria')
            ->orderByDesc('cantidad')
            ->get()
            ->map(fn ($fila) => ['categoria' => $fila->categoria, 'cantidad' => (int) $fila->cantidad, 'valor' => (float) $fila->valor])
            ->all();

        $topFilas = (clone $detalles)
            ->selectRaw('detalle_pedidos.producto_id, SUM(detalle_pedidos.cantidad) as cantidad, SUM(detalle_pedidos.subtotal) as valor')
            ->groupBy('detalle_pedidos.producto_id')
            ->orderByDesc('cantidad')
            ->limit(10)
            ->get();
        $nombres = $this->nombresDeProductos($topFilas->pluck('producto_id')->all());

        $topProductos = $topFilas
            ->map(fn ($fila) => ['producto' => $nombres[$fila->producto_id] ?? 'Producto '.$fila->producto_id, 'cantidad' => (int) $fila->cantidad, 'valor' => (float) $fila->valor])
            ->all();

        $filtraPorProducto = $filtros['producto_ids'] !== [];

        $lineasPorFecha = (clone $detalles)
            ->selectRaw('substr(pedidos.fecha, 1, 10) as dia, COUNT(DISTINCT pedidos.id) as pedidos, SUM(detalle_pedidos.cantidad) as cantidad, SUM(detalle_pedidos.subtotal) as valor, SUM(detalle_pedidos.costo_total) as inversion')
            ->groupBy('dia')
            ->get()
            ->keyBy('dia');

        // The sales value per day is valued exactly like the "valor de
        // pedidos" widget (order totals, or the lines when filtering by
        // product), so the chart adds up to the same figures.
        $valorPorFecha = $filtraPorProducto
            ? $lineasPorFecha->map(fn ($fila) => (float) $fila->valor)
            : $this->pedidos($filtros, $detalles, false)
                ->selectRaw('substr(fecha, 1, 10) as dia, COALESCE(SUM(total_a_pagar), 0) as valor')
                ->groupBy('dia')
                ->get()
                ->mapWithKeys(fn ($fila) => [$fila->dia => (float) $fila->valor]);

        $pedidosPorFecha = $lineasPorFecha->keys()
            ->merge($valorPorFecha->keys())
            ->unique()
            ->sort()
            ->values()
            ->map(fn (string $dia) => [
                'fecha' => $dia,
                'pedidos' => (int) ($lineasPorFecha[$dia]->pedidos ?? 0),
                'cantidad' => (int) ($lineasPorFecha[$dia]->cantidad ?? 0),
                'valor' => (float) ($valorPorFecha[$dia] ?? 0),
                'inversion' => (float) ($lineasPorFecha[$dia]->inversion ?? 0),
            ])
            ->all();

        $gastosPorFecha = $this->gastos($filtros)
            ->selectRaw('fecha_gasto as fecha, SUM(monto) as gastos')
            ->groupBy('fecha_gasto')
            ->orderBy('fecha_gasto')
            ->get()
            ->map(fn ($fila) => [
                'fecha' => substr((string) $fila->getRawOriginal('fecha'), 0, 10),
                'gastos' => (float) $fila->gastos,
            ])
            ->all();

        return compact('categorias', 'topProductos', 'pedidosPorFecha', 'gastosPorFecha');
    }

    /**
     * The five products that ran out of stock and still sell the most (in the
     * filtered period): an alert of what needs restocking first.
     *
     * @param  array<string, mixed>  $filtros
     * @return list<array{id: int, producto: string, vendidas: int, stock: float}>
     */
    private function sinStock(array $filtros): array
    {
        $filas = $this->detalles($filtros)
            ->where('productos.inventariable', true)
            ->whereRaw('(select coalesce(sum(stock), 0) from stock_bodegas where stock_bodegas.producto_id = detalle_pedidos.producto_id) <= 0')
            ->selectRaw('detalle_pedidos.producto_id, SUM(detalle_pedidos.cantidad) as vendidas, (select coalesce(sum(stock), 0) from stock_bodegas where stock_bodegas.producto_id = detalle_pedidos.producto_id) as stock')
            ->groupBy('detalle_pedidos.producto_id')
            ->orderByDesc('vendidas')
            ->limit(5)
            ->get();
        $nombres = $this->nombresDeProductos($filas->pluck('producto_id')->all());

        return $filas
            ->map(fn ($fila) => [
                'id' => (int) $fila->producto_id,
                'producto' => $nombres[$fila->producto_id] ?? 'Producto '.$fila->producto_id,
                'vendidas' => (int) $fila->vendidas,
                'stock' => (float) $fila->stock,
            ])
            ->all();
    }

    /**
     * The display name of each producto, by id.
     *
     * @param  list<int|string>  $ids
     * @return array<int, string>
     */
    private function nombresDeProductos(array $ids): array
    {
        return Producto::withTrashed()
            ->whereIn('id', $ids)
            ->get(['id', 'referencia_producto', 'descripcion_producto', 'marca'])
            ->mapWithKeys(fn (Producto $producto): array => [$producto->id => $producto->concatenar_codigo_nombre])
            ->all();
    }

    /**
     * Headline figures for the dashboard widgets.
     *
     * @param  array<string, mixed>  $filtros
     * @return array<string, mixed>
     */
    private function resumen(array $filtros): array
    {
        $detalles = $this->detalles($filtros);
        $filtraPorProducto = $filtros['producto_ids'] !== [];

        $productos = (clone $detalles)
            ->selectRaw('COALESCE(SUM(detalle_pedidos.cantidad), 0) as cantidad, COALESCE(SUM(detalle_pedidos.subtotal), 0) as valor, COALESCE(SUM(detalle_pedidos.costo_total), 0) as inversion')
            ->first();

        $serie = (clone $detalles)
            ->when($filtros['desde'] === '' && $filtros['hasta'] === '', fn (Builder $query) => $query
                ->where('pedidos.fecha', '>=', now()->subDays(29)->toDateString()))
            ->selectRaw('pedidos.fecha as fecha, SUM(detalle_pedidos.cantidad) as cantidad, SUM(detalle_pedidos.subtotal) as valor')
            ->groupBy('pedidos.fecha')
            ->orderBy('pedidos.fecha')
            ->get()
            ->map(fn ($fila) => [
                'fecha' => substr((string) $fila->fecha, 0, 10),
                'cantidad' => (int) $fila->cantidad,
                'valor' => (float) $fila->valor,
            ])
            ->all();

        // With a product filter an order's total can't be split by
        // line, so the orders that contain those lines are valued by their lines.
        $pedidos = $this->pedidos($filtros, $detalles, $filtraPorProducto)
            ->selectRaw('COUNT(*) as cantidad, COALESCE(SUM(total_a_pagar), 0) as valor, COALESCE(SUM(descuento), 0) as descuento, COALESCE(SUM(reteica), 0) as reteica, COALESCE(SUM(retefuente), 0) as retefuente')
            ->first();

        // Expenses do not depend on products, only on bodega and dates.
        $gastos = (float) $this->gastos($filtros)->sum('monto');
        $inversion = (float) $productos->inversion;
        $valorPedidos = $filtraPorProducto ? (float) $productos->valor : (float) $pedidos->valor;

        return [
            'productosVendidos' => [
                'cantidad' => (int) $productos->cantidad,
                'valor' => (float) $productos->valor,
                'serie' => $serie,
            ],
            'valorPedidos' => ['valor' => $valorPedidos, 'cantidad' => (int) $pedidos->cantidad],
            'inversion' => $inversion,
            'gastos' => $gastos,
            'ganancia' => $valorPedidos - ($inversion + $gastos),
            'ajustes' => [
                'reteica' => (float) $pedidos->reteica,
                'retefuente' => (float) $pedidos->retefuente,
                'descuento' => (float) $pedidos->descuento,
            ],
        ];
    }
}
