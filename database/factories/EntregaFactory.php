<?php

namespace Database\Factories;

use App\Modules\Ventas\Models\Entrega;
use App\Modules\Ventas\Models\Pedido;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Entrega>
 */
class EntregaFactory extends Factory
{
    protected $model = Entrega::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'pedido_id' => Pedido::factory(),
            'direccion' => fake()->streetAddress(),
            'ciudad' => fake()->city(),
            'telefono' => fake()->numerify('3#########'),
            'recibe' => fake()->name(),
            'nota' => null,
            'estado' => Entrega::POR_DESPACHAR,
        ];
    }
}
