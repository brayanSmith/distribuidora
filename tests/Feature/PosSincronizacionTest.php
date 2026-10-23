<?php

use App\Models\User;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Finanzas\Models\Puc;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockBodega;
use App\Modules\Ventas\Models\Cliente;
use App\Modules\Ventas\Models\Pedido;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    $this->bodega = Bodega::factory()->create();
    $this->producto = Producto::factory()->create();
    StockBodega::create(['bodega_id' => $this->bodega->id, 'producto_id' => $this->producto->id, 'stock' => 10]);
    $this->codigo = '9b2f6c1e-3d4a-4f5b-8c7d-1e2f3a4b5c6d';

    // What the POS queue sends: the form as it was at the moment of the sale.
    $this->venta = fn (array $extra = []) => $extra + [
        'codigo_sincronizacion' => $this->codigo,
        'cliente_id' => Cliente::factory()->create()->id,
        'fecha' => '2026-10-23T08:15:00.000Z',
        'bodega_id' => $this->bodega->id,
        'user_id' => $this->owner->id,
        'tipo_precio' => 'DETAL',
        'tipo_pago' => 'CONTADO',
        'aplica_turno' => '0',
        'detalles' => [['producto_id' => $this->producto->id, 'cantidad' => '2', 'precio_unitario' => '5000']],
        'abonos' => [['puc_id' => Puc::factory()->create()->id, 'monto' => '10000', 'con_cuanto_pago' => '10000']],
    ];
});

test('a sale sent in the background is created and answers with its voucher', function () {
    $this->actingAs($this->owner)
        ->postJson(route('pos.sincronizar'), ($this->venta)())
        ->assertCreated()
        ->assertJsonPath('voucher.pedido.total_a_pagar', 10000)
        ->assertJsonPath('voucher.pedido.saldo_pendiente', 0);

    $pedido = Pedido::sole();

    expect($pedido->codigo_sincronizacion)->toBe($this->codigo)
        ->and($pedido->user_id)->toBe($this->owner->id)
        ->and((float) StockBodega::sole()->stock)->toBe(8.0);
});

test('sending the same sale again does not create it twice', function () {
    $datos = ($this->venta)();

    $primera = $this->actingAs($this->owner)->postJson(route('pos.sincronizar'), $datos)->assertCreated();
    $this->actingAs($this->owner)
        ->postJson(route('pos.sincronizar'), $datos)
        ->assertOk()
        ->assertJsonPath('voucher.pedido.id', $primera->json('voucher.pedido.id'));

    expect(Pedido::count())->toBe(1)
        ->and((float) StockBodega::sole()->stock)->toBe(8.0);
});

test('a sale the server cannot take answers why, so the POS can reopen it', function () {
    $this->actingAs($this->owner)
        ->postJson(route('pos.sincronizar'), ($this->venta)(['detalles' => []]))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('detalles');

    $this->actingAs($this->owner)
        ->postJson(route('pos.sincronizar'), ($this->venta)(['codigo_sincronizacion' => 'no-es-un-codigo']))
        ->assertUnprocessable()
        ->assertJsonValidationErrors('codigo_sincronizacion');

    expect(Pedido::count())->toBe(0);
});

test('only who can sell in the POS sends sales in the background', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');

    $this->actingAs($miembro)
        ->postJson(route('pos.sincronizar'), ($this->venta)())
        ->assertForbidden();

    expect(Pedido::count())->toBe(0);
});
