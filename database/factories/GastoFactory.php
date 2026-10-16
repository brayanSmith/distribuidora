<?php

namespace Database\Factories;

use App\Models\Bodega;
use App\Models\User;
use App\Modules\Finanzas\Models\Gasto;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Gasto>
 */
class GastoFactory extends Factory
{
    protected $model = Gasto::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'bodega_id' => Bodega::factory(),
            'user_id' => User::factory(),
            'descripcion' => fake()->sentence(4),
            'monto' => fake()->randomFloat(2, 10, 5000),
            'fecha_gasto' => fake()->date(),
        ];
    }
}
