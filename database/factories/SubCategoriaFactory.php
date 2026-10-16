<?php

namespace Database\Factories;

use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\SubCategoria;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<SubCategoria>
 */
class SubCategoriaFactory extends Factory
{
    protected $model = SubCategoria::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'categoria_id' => Categoria::factory(),
            'nombre_sub_categoria' => fake()->unique()->word(),
        ];
    }
}
