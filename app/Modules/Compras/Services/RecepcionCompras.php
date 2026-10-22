<?php

namespace App\Modules\Compras\Services;

use App\Modules\Catalogo\Models\Producto;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\DetalleCompra;
use App\Modules\Inventario\Models\StockBodega;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;

/**
 * Receiving the goods of a compra, all at once or in parts: what arrives is
 * added to the stock of its bodega, and a line (and then the compra) is
 * received once everything it ordered arrived.
 */
class RecepcionCompras
{
    /**
     * Receive some units of some lines of a compra.
     *
     * @param  array<int, float|int|string>  $cantidades  Units that arrived, by detalle id.
     */
    public function recibir(Compra $compra, array $cantidades): void
    {
        DB::transaction(function () use ($compra, $cantidades): void {
            $detallesAntes = $compra->resumenDetalles();
            $detalles = $compra->detallesCompra()->whereKey(array_keys($cantidades))->lockForUpdate()->get()->keyBy('id');

            foreach ($cantidades as $detalleId => $cantidad) {
                $detalle = $detalles->get($detalleId);
                $cantidad = (float) $cantidad;

                if ($detalle === null || $cantidad <= 0) {
                    continue;
                }

                $pendiente = (float) $detalle->cantidad - (float) $detalle->cantidad_recibida;

                if ($cantidad > $pendiente + 0.001) {
                    throw ValidationException::withMessages([
                        "lineas.{$detalleId}" => __('Only :pendiente units of this line are still to arrive.', ['pendiente' => $pendiente]),
                    ]);
                }

                $recibida = (float) $detalle->cantidad_recibida + $cantidad;

                $detalle->update([
                    'cantidad_recibida' => $recibida,
                    'estado_entrega' => $recibida >= (float) $detalle->cantidad ? 'RECIBIDA' : 'PENDIENTE',
                ]);

                $this->moverStock($detalle, $cantidad);
            }

            $compra->update([
                'estado' => $compra->detallesCompra()->where('estado_entrega', 'PENDIENTE')->doesntExist() ? 'RECIBIDA' : 'PENDIENTE',
            ]);
            $compra->registrarCambioDetalles($detallesAntes, (float) $compra->total_a_pagar);
        });
    }

    /**
     * Add (or, negative, take back) units of a line to the stock of its bodega.
     * Servicios and productos marked as not inventariable never carry stock.
     */
    public function moverStock(DetalleCompra $detalle, float $cantidad): void
    {
        if ($cantidad == 0.0 || Producto::withTrashed()->whereKey($detalle->producto_id)->where('inventariable', false)->exists()) {
            return;
        }

        $stockBodega = StockBodega::firstOrNew([
            'bodega_id' => $detalle->bodega_id,
            'producto_id' => $detalle->producto_id,
        ]);

        $stockBodega->entradas = (float) ($stockBodega->entradas ?? 0) + $cantidad;
        $stockBodega->stock = (float) ($stockBodega->stock ?? 0) + $cantidad;
        $stockBodega->save();
    }
}
