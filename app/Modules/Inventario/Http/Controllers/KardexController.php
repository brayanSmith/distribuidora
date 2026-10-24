<?php

namespace App\Modules\Inventario\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Compras\Models\Compra;
use App\Modules\Inventario\Models\MovimientoStock;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;

/**
 * The kardex of a producto: where each unit came in or went out, newest
 * first, in the bodegas the user can see.
 */
class KardexController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('stock-bodegas.view');

        $filtros = $request->validate([
            'producto_id' => ['required', 'integer'],
            'bodega_id' => ['nullable', 'integer'],
            'desde' => ['nullable', 'date'],
            'hasta' => ['nullable', 'date'],
        ]);

        $movimientos = MovimientoStock::query()
            ->where('producto_id', $filtros['producto_id'])
            ->when($request->user()->idsBodegasPermitidas(), fn ($query, array $bodegaIds) => $query->whereIn('bodega_id', $bodegaIds))
            ->when($filtros['bodega_id'] ?? null, fn ($query, int $bodegaId) => $query->where('bodega_id', $bodegaId))
            ->when($filtros['desde'] ?? null, fn ($query, string $desde) => $query->whereDate('created_at', '>=', $desde))
            ->when($filtros['hasta'] ?? null, fn ($query, string $hasta) => $query->whereDate('created_at', '<=', $hasta))
            ->with(['bodega:id,nombre_bodega', 'user:id,name'])
            ->latest('id')
            ->paginate(50)
            ->withQueryString();

        $facturas = Compra::withTrashed()
            ->whereIn('id', $movimientos->getCollection()->where('documento_tipo', 'compra')->pluck('documento_id'))
            ->pluck('factura', 'id');

        $movimientos->through(fn (MovimientoStock $movimiento): array => [
            'id' => $movimiento->id,
            'fecha' => $movimiento->created_at?->toIso8601String(),
            'bodega' => $movimiento->bodega?->nombre_bodega,
            'concepto' => $movimiento->concepto,
            'reverso' => $movimiento->reverso,
            'cantidad' => (float) $movimiento->cantidad,
            'saldo' => (float) $movimiento->saldo,
            'costo_unitario' => $movimiento->costo_unitario === null ? null : (float) $movimiento->costo_unitario,
            'documento' => $this->documento($movimiento, $facturas->all()),
            'usuario' => $movimiento->user?->name,
            'nota' => $movimiento->nota,
        ]);

        return response()->json($movimientos);
    }

    /**
     * What moved it, as the user reads it, and where to open it.
     *
     * @param  array<int, string>  $facturas
     * @return array{nombre: string, url: string|null}|null
     */
    private function documento(MovimientoStock $movimiento, array $facturas): ?array
    {
        $id = $movimiento->documento_id;

        return match ($movimiento->documento_tipo) {
            'pedido' => ['nombre' => "Pedido #{$id}", 'url' => route('pedidos.edit', $id, absolute: false)],
            'compra' => ['nombre' => 'Compra '.($facturas[$id] ?? "#{$id}"), 'url' => route('compras.edit', $id, absolute: false)],
            'traslado' => ['nombre' => "Traslado #{$id}", 'url' => route('traslados.index', absolute: false)],
            'stock_inicial' => ['nombre' => "Stock inicial #{$id}", 'url' => route('stock-iniciales.index', absolute: false)],
            'ajuste' => ['nombre' => "Ajuste #{$id}", 'url' => route('ajustes-inventario.index', absolute: false)],
            default => null,
        };
    }
}
