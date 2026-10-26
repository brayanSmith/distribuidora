<?php

namespace Database\Factories;

use App\Modules\Catalogo\Models\CatalogoPlantilla;
use Illuminate\Database\Eloquent\Factories\Factory;
use Illuminate\Support\Str;

/**
 * @extends Factory<CatalogoPlantilla>
 */
class CatalogoPlantillaFactory extends Factory
{
    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'nombre' => 'Catálogo '.fake()->word(),
            'bloques' => [
                ['id' => (string) Str::uuid(), 'tipo' => 'portada', 'visible' => true],
            ],
            'columnas' => 4,
            'encabezado' => true,
            'pie' => true,
        ];
    }
}
