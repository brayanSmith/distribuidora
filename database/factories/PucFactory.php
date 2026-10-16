<?php

namespace Database\Factories;

use App\Modules\Finanzas\Models\Puc;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Puc>
 */
class PucFactory extends Factory
{
    protected $model = Puc::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $subcuenta = fake()->unique()->numerify('####');
        $concepto = rtrim(fake()->sentence(3), '.');

        return [
            'tipo' => '1',
            'cuenta' => fake()->numerify('##'),
            'subcuenta' => $subcuenta,
            'concepto' => $concepto,
            'descripcion' => fake()->sentence(),
            'concatenar_subcuenta_concepto' => "{$subcuenta} - {$concepto}",
        ];
    }
}
