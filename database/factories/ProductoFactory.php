<?php

namespace Database\Factories;

use App\Modules\Catalogo\Models\Producto;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Producto>
 */
class ProductoFactory extends Factory
{
    protected $model = Producto::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $referencia = fake()->bothify('REF-####');
        $descripcion = fake()->bothify('#PR/WR0##/##/##N');

        return [
            'categoria_id' => null,
            'sub_categoria_id' => null,
            'inventariable' => true,
            'marca' => null,
            'referencia_producto' => $referencia,
            'descripcion_producto' => $descripcion,
            'costo_producto' => fake()->randomFloat(2, 50000, 200000),
            'valor_detal' => fake()->randomFloat(2, 100000, 300000),
            'valor_mayorista' => fake()->randomFloat(2, 80000, 250000),
            'codigo_appsheet' => null,
            'sku' => fake()->unique()->numerify('########'),
        ];
    }

    /**
     * Indicate that the producto has a brand.
     */
    public function withMarca(): static
    {
        return $this->state(fn () => ['marca' => fake()->company()]);
    }

    /**
     * A servicio: sold like a producto, but never carries stock.
     */
    public function servicio(): static
    {
        return $this->state(fn () => [
            'inventariable' => false,
        ]);
    }
}
