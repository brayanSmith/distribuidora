<?php

namespace Database\Factories;

use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\MovimientoStock;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<MovimientoStock>
 */
class MovimientoStockFactory extends Factory
{
    protected $model = MovimientoStock::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $cantidad = fake()->numberBetween(1, 20);

        return [
            'producto_id' => Producto::factory(),
            'bodega_id' => Bodega::factory(),
            'concepto' => MovimientoStock::COMPRA,
            'reverso' => false,
            'cantidad' => $cantidad,
            'saldo' => $cantidad,
            'costo_unitario' => null,
            'documento_tipo' => null,
            'documento_id' => null,
            'user_id' => null,
            'nota' => null,
        ];
    }
}
