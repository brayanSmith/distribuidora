<?php

use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Rules\ProductoInventariable;

function validarProductoInventariable(int $productoId): ?string
{
    $mensaje = null;

    (new ProductoInventariable)->validate('producto_id', $productoId, function (string $message) use (&$mensaje) {
        $mensaje = $message;
    });

    return $mensaje;
}

test('a regular, inventariable producto passes', function () {
    $producto = Producto::factory()->create();

    expect(validarProductoInventariable($producto->id))->toBeNull();
});

test('a servicio producto fails', function () {
    $producto = Producto::factory()->servicio()->create();

    expect(validarProductoInventariable($producto->id))
        ->toBe('El producto seleccionado es un servicio y no maneja stock.');
});

test('a non-servicio producto marked as not inventariable fails too', function () {
    $producto = Producto::factory()->create(['inventariable' => false]);

    expect(validarProductoInventariable($producto->id))
        ->toBe('El producto seleccionado es un servicio y no maneja stock.');
});
