<?php

use App\Models\User;
use App\Modules\Administracion\Models\Role;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockBodega;
use App\Modules\Ventas\Models\Cliente;
use App\Modules\Ventas\Models\Entrega;
use App\Modules\Ventas\Models\Pedido;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    $this->bodega = Bodega::factory()->create();
    $this->producto = Producto::factory()->create();
    StockBodega::create(['producto_id' => $this->producto->id, 'bodega_id' => $this->bodega->id, 'stock' => 10]);

    // A sale of 3 units: 7 left in the bodega.
    $this->actingAs($this->owner)->post(route('pos.store'), [
        'cliente_id' => Cliente::factory()->create()->id,
        'fecha' => '2026-10-23 10:00:00',
        'user_id' => $this->owner->id,
        'bodega_id' => $this->bodega->id,
        'tipo_precio' => 'DETAL',
        'detalles' => [['producto_id' => $this->producto->id, 'cantidad' => 3, 'precio_unitario' => 1000, 'tipo_precio' => 'MAYORISTA']],
    ])->assertSessionHasNoErrors();

    $this->pedido = Pedido::sole();
});

test('editing a pedido opens the POS with its cart, and its units count as available', function () {
    $this->actingAs($this->owner)->get(route('pedidos.edit', $this->pedido))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('pedidos/editar')
            ->where('pedido.id', $this->pedido->id)
            ->has('pedido.detalles', 1)
            ->where('pedido.detalles.0.tipo_precio', 'MAYORISTA')
            ->where('productos', fn ($productos) => collect($productos)->firstWhere('id', $this->producto->id)['stock_por_bodega'][$this->bodega->id] == 10)
            ->where('permissions.canUpdateDatos', true)
        );
});

test('a pedido already on its way, delivered or picked up can no longer change', function () {
    $entrega = Entrega::factory()->for($this->pedido)->create(['estado' => Entrega::EN_CAMINO]);

    $this->actingAs($this->owner)->get(route('pedidos.edit', $this->pedido))
        ->assertRedirect(route('pedidos.index'));

    $this->actingAs($this->owner)->patch(route('pedidos.update', $this->pedido), [
        'cliente_id' => $this->pedido->cliente_id,
        'fecha' => '2026-10-23 10:00:00',
        'user_id' => $this->owner->id,
        'bodega_id' => $this->bodega->id,
        'tipo_precio' => 'DETAL',
        'detalles' => [['producto_id' => $this->producto->id, 'cantidad' => 1, 'precio_unitario' => 1000]],
    ])->assertSessionHasErrors(['pedido' => 'La entrega va en camino: no se puede modificar el pedido.']);

    expect((float) $this->pedido->fresh()->detalles->sole()->cantidad)->toBe(3.0);

    $entrega->delete();
    $this->pedido->update(['tipo_pago' => 'SEPARADO', 'recogido_at' => now()]);

    expect($this->pedido->fresh()->motivoNoEditable())->toBe('El cliente ya recogió este separado.');
});

test('a pedido of a bodega the user may not use is not opened', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $rol = Role::create(['name' => 'Otra']);
    $rol->bodegas()->sync([Bodega::factory()->create()->id]);
    $miembro->assignRole($rol);
    $miembro->givePermissionTo(['pedidos.view', 'pedidos.update']);

    $this->actingAs($miembro)->get(route('pedidos.edit', $this->pedido))->assertForbidden();
});

test('without permission to change lines, each line is kept whole, in its own bodega and price', function () {
    $otraBodega = Bodega::factory()->create();
    $this->pedido->detalles()->create([
        'producto_id' => $this->producto->id,
        'bodega_id' => $otraBodega->id,
        'cantidad' => 2,
        'tipo_precio' => 'DETAL',
        'precio_unitario' => 1500,
        'subtotal' => 3000,
    ]);

    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $miembro->givePermissionTo(['pedidos.view', 'pedidos.update']);

    // Tries to change both lines of the same producto: neither may change.
    $this->actingAs($miembro)->patch(route('pedidos.update', $this->pedido), [
        'cliente_id' => $this->pedido->cliente_id,
        'fecha' => '2026-10-23 10:00:00',
        'user_id' => $this->owner->id,
        'bodega_id' => $this->bodega->id,
        'tipo_precio' => 'DETAL',
        'detalles' => [
            ['producto_id' => $this->producto->id, 'bodega_id' => $this->bodega->id, 'cantidad' => 9, 'precio_unitario' => 1],
            ['producto_id' => $this->producto->id, 'bodega_id' => $otraBodega->id, 'cantidad' => 9, 'precio_unitario' => 1],
        ],
    ])->assertSessionHasNoErrors();

    $lineas = $this->pedido->fresh()->detalles->sortBy('bodega_id')->values();

    expect($lineas)->toHaveCount(2)
        ->and($lineas->map(fn ($linea) => [(float) $linea->cantidad, (float) $linea->precio_unitario, $linea->tipo_precio])->all())
        ->toBe([[3.0, 1000.0, 'MAYORISTA'], [2.0, 1500.0, 'DETAL']]);
});
