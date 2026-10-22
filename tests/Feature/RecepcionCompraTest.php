<?php

use App\Models\User;
use App\Modules\Administracion\Models\Role;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\DetalleCompra;
use App\Modules\Compras\Models\Proveedor;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockBodega;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    $this->bodega = Bodega::factory()->create();
    $this->producto = Producto::factory()->create(['inventariable' => true]);
});

/** A compra of 10 units not received yet. */
function compraPorRecibir(Bodega $bodega, Producto $producto): Compra
{
    test()->actingAs(test()->owner)->post(route('compras.store'), [
        'proveedor_id' => Proveedor::factory()->create()->id,
        'factura' => 'FAC-'.fake()->unique()->numerify('####'),
        'fecha' => '2026-10-21 10:00:00',
        'descuento' => 0,
        'detalles' => [
            ['producto_id' => $producto->id, 'bodega_id' => $bodega->id, 'cantidad' => 10, 'precio_unitario' => 1000, 'recibido' => false],
        ],
    ])->assertSessionHasNoErrors();

    return Compra::latest('id')->firstOrFail();
}

function stockDe(Bodega $bodega, Producto $producto): float
{
    return (float) StockBodega::where('bodega_id', $bodega->id)->where('producto_id', $producto->id)->value('stock');
}

test('the goods are received in parts and only what arrived adds stock', function () {
    $compra = compraPorRecibir($this->bodega, $this->producto);
    $detalle = $compra->detallesCompra()->firstOrFail();

    expect(stockDe($this->bodega, $this->producto))->toBe(0.0);

    $this->actingAs($this->owner)->post(route('compras.recepciones.store', [$compra]), ['lineas' => [$detalle->id => 8]])
        ->assertSessionHasNoErrors();

    expect(stockDe($this->bodega, $this->producto))->toBe(8.0)
        ->and((float) $detalle->fresh()->cantidad_recibida)->toBe(8.0)
        ->and($detalle->fresh()->estado_entrega)->toBe('PENDIENTE')
        ->and($compra->fresh()->estado)->toBe('PENDIENTE');

    $this->actingAs($this->owner)->post(route('compras.recepciones.store', [$compra]), ['lineas' => [$detalle->id => 2]])
        ->assertSessionHasNoErrors();

    expect(stockDe($this->bodega, $this->producto))->toBe(10.0)
        ->and($detalle->fresh()->estado_entrega)->toBe('RECIBIDA')
        ->and($compra->fresh()->estado)->toBe('RECIBIDA');
});

test('more than what is still to arrive cannot be received', function () {
    $compra = compraPorRecibir($this->bodega, $this->producto);
    $detalle = $compra->detallesCompra()->firstOrFail();

    $this->actingAs($this->owner)->post(route('compras.recepciones.store', [$compra]), ['lineas' => [$detalle->id => 11]])
        ->assertSessionHasErrors("lineas.{$detalle->id}");

    expect(stockDe($this->bodega, $this->producto))->toBe(0.0);
});

test('a partial receipt survives editing the compra and deleting it takes back only what arrived', function () {
    $compra = compraPorRecibir($this->bodega, $this->producto);
    $detalle = $compra->detallesCompra()->firstOrFail();
    $this->actingAs($this->owner)->post(route('compras.recepciones.store', [$compra]), ['lineas' => [$detalle->id => 4]]);

    $this->actingAs($this->owner)->patch(route('compras.update', [$compra]), [
        'proveedor_id' => $compra->proveedor_id,
        'factura' => $compra->factura,
        'fecha' => '2026-10-21 10:00:00',
        'descuento' => 0,
        'detalles' => [
            ['producto_id' => $this->producto->id, 'bodega_id' => $this->bodega->id, 'cantidad' => 10, 'precio_unitario' => 1200, 'recibido' => false, 'cantidad_recibida' => 4],
        ],
    ])->assertSessionHasNoErrors();

    expect(stockDe($this->bodega, $this->producto))->toBe(4.0)
        ->and((float) $compra->detallesCompra()->first()->cantidad_recibida)->toBe(4.0);

    $this->actingAs($this->owner)->delete(route('compras.destroy', [$compra]))->assertRedirect();

    expect(stockDe($this->bodega, $this->producto))->toBe(0.0);
});

test('the pending list shows what is still to arrive, only of the authorized bodegas', function () {
    $otra = Bodega::factory()->create();
    $compra = compraPorRecibir($this->bodega, $this->producto);
    compraPorRecibir($otra, $this->producto);
    $detalle = $compra->detallesCompra()->firstOrFail();
    $this->actingAs($this->owner)->post(route('compras.recepciones.store', [$compra]), ['lineas' => [$detalle->id => 3]]);

    $bodeguero = User::factory()->create();
    asignarRol($bodeguero, 'Member');
    $rol = Role::create(['name' => 'Bodega uno']);
    $rol->bodegas()->sync([$this->bodega->id]);
    $bodeguero->assignRole($rol);
    $bodeguero->givePermissionTo('compras.recibir');

    $this->actingAs($bodeguero)->get(route('compras.pendientes'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('compras-pendientes/index')
            ->has('compras', 1)
            ->where('compras.0.lineas.0.recibida', 3)
            ->where('compras.0.lineas.0.pendiente', 7)
            ->where('resumen.unidades', 7)
        );

    $otraDetalle = DetalleCompra::where('bodega_id', $otra->id)->firstOrFail();
    $this->actingAs($bodeguero)
        ->post(route('compras.recepciones.store', [$otraDetalle->compra_id]), ['lineas' => [$otraDetalle->id => 1]])
        ->assertForbidden();
});

test('what is still to arrive is what the productos listing counts as pending', function () {
    $compra = compraPorRecibir($this->bodega, $this->producto);
    $detalle = $compra->detallesCompra()->firstOrFail();
    $this->actingAs($this->owner)->post(route('compras.recepciones.store', [$compra]), ['lineas' => [$detalle->id => 6]]);

    $this->actingAs($this->owner)->get(route('productos.index'))
        ->assertInertia(fn ($page) => $page->where('productos', fn ($productos) => (float) collect($productos)->firstWhere('id', $this->producto->id)['pendiente'] === 4.0));
});
