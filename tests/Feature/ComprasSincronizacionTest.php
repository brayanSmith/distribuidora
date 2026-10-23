<?php

use App\Models\User;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\Proveedor;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockBodega;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    $this->producto = Producto::factory()->create();
    $this->bodega = Bodega::factory()->create();

    // What the Compras POS queue sends: the compra as it was when it was registered.
    $this->compra = fn (array $extra = []) => $extra + [
        'codigo_sincronizacion' => '4c1d2e3f-5a6b-4c7d-9e8f-0a1b2c3d4e5f',
        'proveedor_id' => Proveedor::factory()->create()->id,
        'factura' => 'FAC-OFF-1',
        'fecha' => '2026-10-23T09:00:00.000Z',
        'descuento' => 0,
        'tipo_pago' => 'CREDITO',
        'detalles' => [
            ['producto_id' => $this->producto->id, 'bodega_id' => $this->bodega->id, 'cantidad' => 3, 'precio_unitario' => 100000, 'recibido' => true],
        ],
    ];
});

test('a compra sent in the background is created and received', function () {
    $this->actingAs($this->owner)
        ->postJson(route('compras.sincronizar'), ($this->compra)())
        ->assertCreated()
        ->assertJsonPath('compra.factura', 'FAC-OFF-1');

    $compra = Compra::sole();

    expect($compra->codigo_sincronizacion)->toBe('4c1d2e3f-5a6b-4c7d-9e8f-0a1b2c3d4e5f')
        ->and((float) $compra->total_a_pagar)->toBe(300000.0)
        ->and((float) StockBodega::sole()->stock)->toBe(3.0);
});

test('sending the same compra again does not create it twice nor move stock twice', function () {
    $datos = ($this->compra)();

    $primera = $this->actingAs($this->owner)->postJson(route('compras.sincronizar'), $datos)->assertCreated();
    $this->actingAs($this->owner)
        ->postJson(route('compras.sincronizar'), $datos)
        ->assertOk()
        ->assertJsonPath('compra.id', $primera->json('compra.id'));

    expect(Compra::count())->toBe(1)
        ->and((float) StockBodega::sole()->stock)->toBe(3.0);
});

test('a compra the server cannot take answers why', function () {
    $this->actingAs($this->owner)
        ->postJson(route('compras.sincronizar'), ($this->compra)(['factura' => '']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('factura');

    $this->actingAs($this->owner)
        ->postJson(route('compras.sincronizar'), ($this->compra)(['codigo_sincronizacion' => null]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('codigo_sincronizacion');

    expect(Compra::count())->toBe(0);
});

test('only who can register compras sends them in the background', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');

    $this->actingAs($miembro)
        ->postJson(route('compras.sincronizar'), ($this->compra)())
        ->assertForbidden();

    expect(Compra::count())->toBe(0);
});
