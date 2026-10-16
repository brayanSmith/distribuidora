<?php

namespace Database\Factories;

use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockInicial;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<StockInicial>
 */
class StockInicialFactory extends Factory
{
    protected $model = StockInicial::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'producto_id' => Producto::factory(),
            'bodega_id' => Bodega::factory(),
            'cantidad' => fake()->numberBetween(0, 500),
        ];
    }
}
