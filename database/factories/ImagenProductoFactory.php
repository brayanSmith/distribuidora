<?php

namespace Database\Factories;

use App\Modules\Catalogo\Models\ImagenProducto;
use App\Modules\Catalogo\Models\Producto;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<ImagenProducto>
 */
class ImagenProductoFactory extends Factory
{
    protected $model = ImagenProducto::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'producto_id' => Producto::factory(),
            'imagen_producto' => 'productos/'.fake()->uuid().'.jpg',
        ];
    }
}
