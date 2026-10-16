<?php

namespace Database\Factories;

use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\Traslado;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Traslado>
 */
class TrasladoFactory extends Factory
{
    protected $model = Traslado::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'bodega_donante_id' => Bodega::factory(),
            'bodega_destino_id' => Bodega::factory(),
            'producto_id' => Producto::factory(),
            'cantidad' => fake()->numberBetween(1, 50),
            'observaciones' => fake()->optional()->sentence(),
        ];
    }
}
