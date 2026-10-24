<?php

namespace Database\Factories;

use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\AjusteInventario;
use App\Modules\Inventario\Models\Bodega;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AjusteInventario>
 */
class AjusteInventarioFactory extends Factory
{
    protected $model = AjusteInventario::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $cantidad = fake()->numberBetween(1, 10);

        return [
            'producto_id' => Producto::factory(),
            'bodega_id' => Bodega::factory(),
            'tipo' => AjusteInventario::SALIDA,
            'cantidad' => $cantidad,
            'stock_anterior' => 20,
            'diferencia' => -$cantidad,
            'motivo' => 'Mercancía dañada',
            'nota' => null,
            'user_id' => null,
        ];
    }
}
