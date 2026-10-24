<?php

namespace App\Modules\Compras\Services;

use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\DetalleCompra;
use App\Modules\Inventario\Models\MovimientoStock;
use App\Modules\Inventario\Services\Kardex;
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
     * Add (or, negative, take back) units of a line to the stock of its
     * bodega, leaving it in the kardex.
     */
    public function moverStock(DetalleCompra $detalle, float $cantidad): void
    {
        app(Kardex::class)->mover(
            $detalle->producto_id,
            $detalle->bodega_id,
            $cantidad,
            MovimientoStock::COMPRA,
            ['compra', $detalle->compra_id],
            reverso: $cantidad < 0,
            costoUnitario: (float) $detalle->precio_unitario,
        );
    }
}
