<?php

namespace Database\Factories;

use App\Modules\Catalogo\Models\Importacion;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Importacion>
 */
class ImportacionFactory extends Factory
{
    protected $model = Importacion::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'tipo' => 'productos',
            'archivo' => 'importaciones/'.fake()->uuid().'.csv',
            'nombre_original' => 'productos.csv',
            'estado' => Importacion::PENDIENTE,
        ];
    }
}
