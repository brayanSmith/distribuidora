<?php

use App\Models\User;
use App\Modules\Administracion\Models\Role;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\Proveedor;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\MovimientoStock;
use App\Modules\Inventario\Models\StockBodega;
use App\Modules\Inventario\Models\Traslado;
use App\Modules\Inventario\Services\Kardex;
use App\Modules\Ventas\Models\Cliente;
use App\Modules\Ventas\Models\Pedido;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    $this->bodega = Bodega::factory()->create();
    $this->producto = Producto::factory()->create(['costo_producto' => 1000]);
});

/** The producto's movements in a bodega, oldest first. */
function movimientosDe(Producto $producto, Bodega $bodega): array
{
    return MovimientoStock::where('producto_id', $producto->id)
        ->where('bodega_id', $bodega->id)
        ->orderBy('id')
        ->get()
        ->map(fn (MovimientoStock $movimiento): array => [
            $movimiento->concepto,
            $movimiento->reverso,
            (float) $movimiento->cantidad,
            (float) $movimiento->saldo,
            $movimiento->documento_tipo,
        ])
        ->all();
}

test('every stock movement leaves its trace: stock inicial, compra, venta and its reverse', function () {
    $this->actingAs($this->owner)->post(route('stock-iniciales.store'), [
        'producto_id' => $this->producto->id,
        'bodega_id' => $this->bodega->id,
        'cantidad' => 10,
    ])->assertSessionHasNoErrors();

    $this->actingAs($this->owner)->post(route('compras.store'), [
        'proveedor_id' => Proveedor::factory()->create()->id,
        'factura' => 'FAC-55',
        'fecha' => '2026-10-23 10:00:00',
        'detalles' => [['producto_id' => $this->producto->id, 'bodega_id' => $this->bodega->id, 'cantidad' => 5, 'precio_unitario' => 1200, 'recibido' => true]],
    ])->assertSessionHasNoErrors();

    $this->actingAs($this->owner)->post(route('pos.store'), [
        'cliente_id' => Cliente::factory()->create()->id,
        'fecha' => '2026-10-23 11:00:00',
        'user_id' => $this->owner->id,
        'bodega_id' => $this->bodega->id,
        'tipo_precio' => 'DETAL',
        'detalles' => [['producto_id' => $this->producto->id, 'cantidad' => 3, 'precio_unitario' => 2000]],
    ])->assertSessionHasNoErrors();

    $pedido = Pedido::sole();
    $this->actingAs($this->owner)->delete(route('pedidos.destroy', $pedido))->assertSessionHasNoErrors();

    expect(movimientosDe($this->producto, $this->bodega))->toBe([
        [MovimientoStock::STOCK_INICIAL, false, 10.0, 10.0, 'stock_inicial'],
        [MovimientoStock::COMPRA, false, 5.0, 15.0, 'compra'],
        [MovimientoStock::VENTA, false, -3.0, 12.0, 'pedido'],
        [MovimientoStock::VENTA, true, 3.0, 15.0, 'pedido'],
    ]);

    $venta = MovimientoStock::where('concepto', MovimientoStock::VENTA)->first();
    expect($venta->documento_id)->toBe($pedido->id)
        ->and($venta->user_id)->toBe($this->owner->id)
        ->and((float) $venta->costo_unitario)->toBe(1200.0);

    // The balance keeps the counters: what came in, and what left net of the reverse.
    expect(StockBodega::sole())
        ->stock_inicial->toEqual(10)
        ->entradas->toEqual(5)
        ->salidas->toEqual(0)
        ->stock->toEqual(15);
});

test('a traslado leaves the bodega it comes from and enters the other', function () {
    $destino = Bodega::factory()->create();

    $this->actingAs($this->owner)->post(route('traslados.store'), [
        'producto_id' => $this->producto->id,
        'bodega_donante_id' => $this->bodega->id,
        'bodega_destino_id' => $destino->id,
        'cantidad' => 4,
    ])->assertSessionHasNoErrors();

    $this->actingAs($this->owner)->delete(route('traslados.destroy', Traslado::sole()))->assertSessionHasNoErrors();

    expect(movimientosDe($this->producto, $this->bodega))->toBe([
        [MovimientoStock::TRASLADO_SALIDA, false, -4.0, -4.0, 'traslado'],
        [MovimientoStock::TRASLADO_SALIDA, true, 4.0, 0.0, 'traslado'],
    ])->and(movimientosDe($this->producto, $destino))->toBe([
        [MovimientoStock::TRASLADO_ENTRADA, false, 4.0, 4.0, 'traslado'],
        [MovimientoStock::TRASLADO_ENTRADA, true, -4.0, 0.0, 'traslado'],
    ]);
});

test('servicios carry no stock, so they leave no movements', function () {
    $servicio = Producto::factory()->create(['inventariable' => false]);

    app(Kardex::class)->mover($servicio->id, $this->bodega->id, -2, MovimientoStock::VENTA);

    expect(MovimientoStock::count())->toBe(0)
        ->and(StockBodega::count())->toBe(0);
});

test('the kardex starts from the stock there is and rebuilds a balance that does not match', function () {
    $stock = StockBodega::create(['producto_id' => $this->producto->id, 'bodega_id' => $this->bodega->id, 'stock' => 7]);
    $kardex = app(Kardex::class);

    expect($kardex->iniciar())->toBe(1)
        ->and($kardex->iniciar())->toBe(0)
        ->and(movimientosDe($this->producto, $this->bodega))->toBe([[MovimientoStock::SALDO_INICIAL, false, 7.0, 7.0, null]]);

    $kardex->mover($this->producto->id, $this->bodega->id, -2, MovimientoStock::VENTA);
    $stock->refresh()->update(['stock' => 99]);

    $this->artisan('kardex:recalcular', ['--revisar' => true])->assertSuccessful();
    expect((float) $stock->fresh()->stock)->toBe(99.0);

    $this->artisan('kardex:recalcular')->assertSuccessful();
    expect((float) $stock->fresh()->stock)->toBe(5.0);
});

test('the kardex lists the movements newest first with the document that made them', function () {
    $compra = Compra::factory()->create(['factura' => 'FAC-99']);
    $kardex = app(Kardex::class);
    $kardex->mover($this->producto->id, $this->bodega->id, 8, MovimientoStock::COMPRA, ['compra', $compra->id]);
    $kardex->mover($this->producto->id, $this->bodega->id, -3, MovimientoStock::VENTA, ['pedido', 42]);

    $this->actingAs($this->owner)
        ->getJson(route('kardex.index', ['producto_id' => $this->producto->id]))
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonPath('data.0.concepto', MovimientoStock::VENTA)
        ->assertJsonPath('data.0.cantidad', -3)
        ->assertJsonPath('data.0.saldo', 5)
        ->assertJsonPath('data.0.documento.nombre', 'Pedido #42')
        ->assertJsonPath('data.1.documento.nombre', 'Compra FAC-99')
        ->assertJsonPath('data.1.documento.url', '/compras/'.$compra->id.'/editar');
});

test('the kardex only shows the bodegas the user may see', function () {
    $otra = Bodega::factory()->create();
    $kardex = app(Kardex::class);
    $kardex->mover($this->producto->id, $this->bodega->id, 5, MovimientoStock::COMPRA);
    $kardex->mover($this->producto->id, $otra->id, 9, MovimientoStock::COMPRA);

    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $rol = Role::create(['name' => 'Norte']);
    $rol->bodegas()->sync([$this->bodega->id]);
    $miembro->assignRole($rol);
    $miembro->givePermissionTo('stock-bodegas.view');

    $this->actingAs($miembro)
        ->getJson(route('kardex.index', ['producto_id' => $this->producto->id]))
        ->assertJsonCount(1, 'data')
        ->assertJsonPath('data.0.cantidad', 5);

    $sinPermiso = User::factory()->create();
    asignarRol($sinPermiso, 'Member');

    $this->actingAs($sinPermiso)
        ->getJson(route('kardex.index', ['producto_id' => $this->producto->id]))
        ->assertForbidden();
});
