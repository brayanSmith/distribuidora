<?php

namespace App\Modules\Inventario\Services;

use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\MovimientoStock;
use App\Modules\Inventario\Models\StockBodega;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;

/**
 * The only way stock moves: each movement is written to the kardex and
 * applied to the bodega's balance (stock_bodegas) together, so no unit
 * goes in or out without a trace of where from, why and who.
 */
class Kardex
{
    /**
     * Move units of a producto in (positive) or out (negative) of a bodega.
     * Servicios and productos without stock control carry no stock: nothing
     * is moved nor written for them.
     *
     * @param  array{0: string, 1: int|null}|null  $documento  What moved it: [tipo, id] (pedido, compra, traslado, stock_inicial).
     */
    public function mover(
        int $productoId,
        int $bodegaId,
        float $cantidad,
        string $concepto,
        ?array $documento = null,
        bool $reverso = false,
        ?float $costoUnitario = null,
        ?string $nota = null,
    ): ?MovimientoStock {
        if ($cantidad == 0.0 || ! $this->llevaStock($productoId)) {
            return null;
        }

        return DB::transaction(function () use ($productoId, $bodegaId, $cantidad, $concepto, $documento, $reverso, $costoUnitario, $nota): MovimientoStock {
            // Locked, so two sales of the same producto never read the same balance.
            $stockBodega = StockBodega::where('producto_id', $productoId)
                ->where('bodega_id', $bodegaId)
                ->lockForUpdate()
                ->first()
                ?? new StockBodega(['producto_id' => $productoId, 'bodega_id' => $bodegaId]);

            $columna = MovimientoStock::COLUMNAS[$concepto] ?? null;

            if ($columna !== null) {
                // What left counts up on salidas; everything else on its own counter.
                $stockBodega->{$columna} = (float) ($stockBodega->{$columna} ?? 0)
                    + ($columna === 'salidas' ? -$cantidad : $cantidad);
            }

            $stockBodega->stock = (float) ($stockBodega->stock ?? 0) + $cantidad;
            $stockBodega->save();

            return MovimientoStock::create([
                'producto_id' => $productoId,
                'bodega_id' => $bodegaId,
                'concepto' => $concepto,
                'reverso' => $reverso,
                'cantidad' => $cantidad,
                'saldo' => $stockBodega->stock,
                'costo_unitario' => $costoUnitario,
                'documento_tipo' => $documento[0] ?? null,
                'documento_id' => $documento[1] ?? null,
                'user_id' => Auth::id(),
                'nota' => $nota,
            ]);
        });
    }

    /**
     * Puts each balance back to what its movements add up to, for the ones
     * that don't match.
     *
     * @return list<array{producto_id: int, bodega_id: int, antes: float, despues: float}>
     */
    public function recalcular(bool $corregir = true): array
    {
        $sumas = MovimientoStock::query()
            ->selectRaw('producto_id, bodega_id, SUM(cantidad) as total')
            ->groupBy('producto_id', 'bodega_id')
            ->get()
            ->keyBy(fn ($fila): string => $fila->producto_id.'-'.$fila->bodega_id);

        $diferencias = [];

        StockBodega::query()->each(function (StockBodega $stockBodega) use ($sumas, $corregir, &$diferencias): void {
            $total = round((float) ($sumas[$stockBodega->producto_id.'-'.$stockBodega->bodega_id]->total ?? 0), 2);

            if (abs($total - (float) $stockBodega->stock) < 0.005) {
                return;
            }

            $diferencias[] = [
                'producto_id' => $stockBodega->producto_id,
                'bodega_id' => $stockBodega->bodega_id,
                'antes' => (float) $stockBodega->stock,
                'despues' => $total,
            ];

            if ($corregir) {
                $stockBodega->update(['stock' => $total]);
            }
        });

        return $diferencias;
    }

    /**
     * The kardex starts from what each bodega has today: one starting
     * movement per balance that has none yet. Safe to run again.
     */
    public function iniciar(): int
    {
        $creados = 0;

        StockBodega::query()
            ->whereNotExists(fn ($query) => $query->selectRaw('1')
                ->from('movimientos_stock')
                ->whereColumn('movimientos_stock.producto_id', 'stock_bodegas.producto_id')
                ->whereColumn('movimientos_stock.bodega_id', 'stock_bodegas.bodega_id'))
            ->where('stock', '!=', 0)
            ->each(function (StockBodega $stockBodega) use (&$creados): void {
                MovimientoStock::create([
                    'producto_id' => $stockBodega->producto_id,
                    'bodega_id' => $stockBodega->bodega_id,
                    'concepto' => MovimientoStock::SALDO_INICIAL,
                    'cantidad' => $stockBodega->stock,
                    'saldo' => $stockBodega->stock,
                    'nota' => 'Stock que había al empezar el registro de movimientos.',
                ]);
                $creados++;
            });

        return $creados;
    }

    private function llevaStock(int $productoId): bool
    {
        return ! Producto::withTrashed()->whereKey($productoId)->where('inventariable', false)->exists();
    }
}
