<?php

use App\Models\User;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Ventas\Models\Cliente;
use App\Modules\Ventas\Models\Pedido;

test('pedidos general lists every pedido, whatever its tipo de precio', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $cliente = Cliente::factory()->create();
    $producto = Producto::factory()->create();
    $bodega = Bodega::factory()->create();

    foreach (['DETAL' => 100, 'MAYORISTA' => 80] as $tipo => $precio) {
        $this->actingAs($owner)->post(route('pedidos.store'), [
            'cliente_id' => $cliente->id,
            'fecha' => '2026-01-10 10:00:00',
            'user_id' => $owner->id,
            'bodega_id' => $bodega->id,
            'tipo_precio' => $tipo,
            'detalles' => [
                ['producto_id' => $producto->id, 'cantidad' => 1, 'precio_unitario' => $precio],
            ],
        ])->assertRedirect(route('pedidos.index'));
    }
    Pedido::factory()->create(['tipo_precio' => 'OTRO', 'bodega_id' => $bodega->id]);

    $this->actingAs($owner)->get(route('pedidos.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->has('pedidos', 3)
            ->where('pedidos', fn ($pedidos) => collect($pedidos)->pluck('tipo_precio')->sort()->values()->all() === ['DETAL', 'MAYORISTA', 'OTRO'])
            ->where('navCounts.pedidos', 3)
        );
});

test('the pedidos mayorista module no longer exists', function () {
    expect(Route::has('pedidos-mayoristas.index'))->toBeFalse();
});