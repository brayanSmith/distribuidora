<?php

namespace Database\Factories;

use App\Models\User;
use App\Modules\Compras\Models\AbonoCompra;
use App\Modules\Compras\Models\Compra;
use App\Modules\Finanzas\Models\Puc;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<AbonoCompra>
 */
class AbonoCompraFactory extends Factory
{
    protected $model = AbonoCompra::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'compra_id' => Compra::factory(),
            'fecha' => now(),
            'monto' => fake()->randomFloat(2, 10000, 100000),
            'puc_id' => Puc::factory(),
            'descripcion' => null,
            'user_id' => User::factory(),
        ];
    }
}
