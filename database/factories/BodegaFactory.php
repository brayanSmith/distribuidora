<?php

namespace Database\Factories;

use App\Modules\Inventario\Models\Bodega;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Bodega>
 */
class BodegaFactory extends Factory
{
    protected $model = Bodega::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nombre_bodega' => fake()->unique()->company().' Bodega',
            'ubicacion_bodega' => fake()->address(),
        ];
    }
}
