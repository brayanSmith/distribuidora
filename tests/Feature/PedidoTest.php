<?php

use App\Models\Bodega;
use App\Models\Cliente;
use App\Models\Compra;
use App\Models\DetalleCompra;
use App\Models\DetallePedido;
use App\Models\Pedido;
use App\Models\Producto;
use App\Models\Proveedor;
use App\Models\Puc;
use App\Models\Role;
use App\Models\StockBodega;
use App\Models\User;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate('pedidos.view');
    Permission::findOrCreate('pedidos.create');
    Permission::findOrCreate('pedidos.update');
    Permission::findOrCreate('pedidos.delete');
});

test('owners can view and create pedidos, deducting stock from the bodega', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $cliente = Cliente::factory()->create();
    $vendedor = User::factory()->create();
    $producto = Producto::factory()->create();
    $bodega = Bodega::factory()->create();

    StockBodega::create([
        'bodega_id' => $bodega->id,
        'producto_id' => $producto->id,
        'stock_inicial' => 20,
        'entradas' => 0,
        'salidas' => 0,
        'stock' => 20,
    ]);

    $this->actingAs($owner)->get(route('pedidos.index'))->assertOk();
    $this->actingAs($owner)->get(route('pedidos.create'))->assertOk();

    $response = $this->actingAs($owner)->post(route('pedidos.store'), [
        'cliente_id' => $cliente->id,
        'fecha' => '2026-01-10 10:00:00',
        'user_id' => $vendedor->id,
        'bodega_id' => $bodega->id,
        'tipo_precio' => 'DETAL',
        'flete' => 0,
        'descuento' => 10,
        'detalles' => [
            [
                'producto_id' => $producto->id,
                'cantidad' => 2,
                'precio_unitario' => 100,
            ],
        ],
    ]);

    $response->assertRedirect();

    $pedido = Pedido::firstOrFail();
    expect((float) $pedido->subtotal)->toBe(200.0);
    expect((float) $pedido->total_a_pagar)->toBe(190.0);
    expect((float) $pedido->saldo_pendiente)->toBe(190.0);
    expect($pedido->estado)->toBe('PENDIENTE');
    expect($pedido->estado_pago)->toBe('EN_CARTERA');
    expect($pedido->detalles()->count())->toBe(1);

    $stock = StockBodega::where('bodega_id', $bodega->id)->where('producto_id', $producto->id)->first();
    expect((float) $stock->stock)->toBe(18.0);
});

test('registering a payment updates totals and marks the pedido as completed once fully paid', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $cliente = Cliente::factory()->create();
    $vendedor = User::factory()->create();
    $producto = Producto::factory()->create();
    $bodega = Bodega::factory()->create();
    $puc = Puc::factory()->create();

    $this->actingAs($owner)->post(route('pedidos.store'), [
        'cliente_id' => $cliente->id,
        'fecha' => '2026-01-10 10:00:00',
        'user_id' => $vendedor->id,
        'bodega_id' => $bodega->id,
        'tipo_precio' => 'DETAL',
        'detalles' => [
            [
                'producto_id' => $producto->id,
                'cantidad' => 2,
                'precio_unitario' => 100,
            ],
        ],
    ]);

    $pedido = Pedido::firstOrFail();

    $this->actingAs($owner)->post(route('pedidos.abonos.store', [$pedido]), [
        'puc_id' => $puc->id,
        'monto' => 200,
        'con_cuanto_pago' => 200,
    ])->assertRedirect();

    $pedido->refresh();
    expect((float) $pedido->abono)->toBe(200.0);
    expect((float) $pedido->saldo_pendiente)->toBe(0.0);
    expect($pedido->estado_pago)->toBe('SALDADO');
    expect($pedido->estado)->toBe('COMPLETADO');

    $abono = $pedido->abonos()->firstOrFail();

    $this->actingAs($owner)->delete(route('pedidos.abonos.destroy', [$pedido, $abono]))
        ->assertRedirect();

    $pedido->refresh();
    expect((float) $pedido->abono)->toBe(0.0);
    expect((float) $pedido->saldo_pendiente)->toBe(200.0);
    expect($pedido->estado)->toBe('PENDIENTE');
});

test('deleting a pedido reverts deducted stock', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $cliente = Cliente::factory()->create();
    $vendedor = User::factory()->create();
    $producto = Producto::factory()->create();
    $bodega = Bodega::factory()->create();

    $this->actingAs($owner)->post(route('pedidos.store'), [
        'cliente_id' => $cliente->id,
        'fecha' => '2026-01-10 10:00:00',
        'user_id' => $vendedor->id,
        'bodega_id' => $bodega->id,
        'tipo_precio' => 'DETAL',
        'detalles' => [
            [
                'producto_id' => $producto->id,
                'cantidad' => 4,
                'precio_unitario' => 25,
            ],
        ],
    ]);

    $pedido = Pedido::firstOrFail();

    $this->actingAs($owner)->delete(route('pedidos.destroy', [$pedido]))
        ->assertRedirect();

    expect(Pedido::find($pedido->id))->toBeNull();

    $stock = StockBodega::where('bodega_id', $bodega->id)->where('producto_id', $producto->id)->first();
    expect((float) $stock->stock)->toBe(0.0);
});

test('members without permission cannot view pedidos', function () {
    $member = User::factory()->create();
    asignarRol($member, 'Member');

    $this->actingAs($member)->get(route('pedidos.index'))->assertForbidden();
});

test('storing a pedido snapshots the product cost and computes profit per detalle', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $cliente = Cliente::factory()->create();
    $vendedor = User::factory()->create();
    $producto = Producto::factory()->create(['costo_producto' => 60]);
    $bodega = Bodega::factory()->create();

    $this->actingAs($owner)->post(route('pedidos.store'), [
        'cliente_id' => $cliente->id,
        'fecha' => '2026-01-10 10:00:00',
        'user_id' => $vendedor->id,
        'bodega_id' => $bodega->id,
        'tipo_precio' => 'DETAL',
        'detalles' => [
            [
                'producto_id' => $producto->id,
                'cantidad' => 3,
                'precio_unitario' => 100,
            ],
        ],
    ])->assertRedirect();

    $detalle = Pedido::firstOrFail()->detalles()->firstOrFail();

    expect((float) $detalle->costo_unitario)->toBe(60.0);
    expect((float) $detalle->costo_total)->toBe(180.0);
    expect((float) $detalle->ganancia_total)->toBe(120.0);
});

test('detalles are required to store a pedido', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $cliente = Cliente::factory()->create();
    $vendedor = User::factory()->create();
    $bodega = Bodega::factory()->create();

    $this->actingAs($owner)->post(route('pedidos.store'), [
        'cliente_id' => $cliente->id,
        'fecha' => '2026-01-10 10:00:00',
        'user_id' => $vendedor->id,
        'bodega_id' => $bodega->id,
        'tipo_precio' => 'DETAL',
    ])->assertSessionHasErrors('detalles');
});

test('the pedidos listing sends each abono with its monto and método de pago', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $pedido = Pedido::factory()->create(['tipo_precio' => 'DETAL']);
    $puc = Puc::factory()->create();
    $pedido->abonos()->create(['user_id' => $owner->id, 'puc_id' => $puc->id, 'monto' => 1500, 'con_cuanto_pago' => 2000, 'cambio' => 500, 'fecha' => now()]);

    $this->actingAs($owner)->get(route('pedidos.index'))
        ->assertInertia(fn ($page) => $page
            ->where('pedidos.0.abonos.0.monto', '1500.00')
            ->where('pedidos.0.abonos.0.puc.id', $puc->id)
        );
});

test('every producto can be put on a pedido, and editing one lists those of its lines even when deleted', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $sinControl = Producto::factory()->create(['inventariable' => false, 'categoria' => 'LLANTA']);
    $servicio = Producto::factory()->create(['inventariable' => false, 'categoria' => 'SERVICIO', 'tipo' => 'SERVICIO']);
    $eliminado = Producto::factory()->create();
    $pedido = Pedido::factory()->create(['tipo_precio' => 'DETAL']);
    DetallePedido::factory()->create(['pedido_id' => $pedido->id, 'producto_id' => $eliminado->id]);
    $eliminado->delete();

    $this->actingAs($owner)->get(route('pedidos.create'))
        ->assertInertia(fn ($page) => $page
            ->where('productos', fn ($productos) => collect($productos)->pluck('id')->contains($sinControl->id)
                && collect($productos)->pluck('id')->contains($servicio->id)
                && ! collect($productos)->pluck('id')->contains($eliminado->id))
        );

    $this->actingAs($owner)->get(route('pedidos.edit', [$pedido]))
        ->assertInertia(fn ($page) => $page
            ->where('productos', fn ($productos) => collect($productos)->pluck('id')->contains($eliminado->id))
        );
});

test('the pedidos listing shows each detalle producto pending purchases when permitted', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $cliente = Cliente::factory()->create();
    $vendedor = User::factory()->create();
    $producto = Producto::factory()->create();
    $bodega = Bodega::factory()->create();
    $proveedor = Proveedor::factory()->create(['nombre_proveedor' => 'Proveedor Pendiente']);

    DetalleCompra::factory()->create([
        'producto_id' => $producto->id,
        'estado_entrega' => 'PENDIENTE',
        'cantidad' => 7,
        'compra_id' => Compra::factory()->create(['proveedor_id' => $proveedor->id])->id,
    ]);

    $this->actingAs($owner)->post(route('pedidos.store'), [
        'cliente_id' => $cliente->id,
        'fecha' => '2026-01-10 10:00:00',
        'user_id' => $vendedor->id,
        'bodega_id' => $bodega->id,
        'tipo_precio' => 'DETAL',
        'detalles' => [
            ['producto_id' => $producto->id, 'cantidad' => 1, 'precio_unitario' => 50],
        ],
    ]);

    $this->actingAs($owner)->get(route('pedidos.index'))
        ->assertInertia(fn ($page) => $page
            ->where('pedidos.0.detalles.0.producto.pendiente', 7)
            ->where('pedidos.0.detalles.0.producto.proveedor_pendiente', 'Proveedor Pendiente')
        );
});

test('a user without productos.view-pendiente does not see pending purchases on the pedidos listing', function () {
    $rol = Role::create(['name' => 'SinPendiente']);
    $rol->givePermissionTo(['pedidos.view']);

    $usuario = User::factory()->create();
    $usuario->assignRole($rol);

    $producto = Producto::factory()->create();
    DetalleCompra::factory()->create([
        'producto_id' => $producto->id,
        'estado_entrega' => 'PENDIENTE',
        'cantidad' => 5,
    ]);

    $pedido = Pedido::factory()->create(['tipo_precio' => 'DETAL']);
    DetallePedido::factory()->create(['pedido_id' => $pedido->id, 'producto_id' => $producto->id]);

    $this->actingAs($usuario)->get(route('pedidos.index'))
        ->assertInertia(fn ($page) => $page
            ->where('pedidos.0.detalles.0.producto.pendiente', null)
            ->where('pedidos.0.detalles.0.producto.proveedor_pendiente', null)
        );
});

test('selling a producto without stock control does not move stock', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');
    $producto = Producto::factory()->create(['inventariable' => false, 'categoria' => 'LLANTA']);
    $bodega = Bodega::factory()->create();

    $this->actingAs($owner)->post(route('pedidos.store'), [
        'cliente_id' => Cliente::factory()->create()->id,
        'fecha' => '2026-01-10 10:00:00',
        'user_id' => User::factory()->create()->id,
        'bodega_id' => $bodega->id,
        'tipo_precio' => 'DETAL',
        'detalles' => [['producto_id' => $producto->id, 'cantidad' => 2, 'precio_unitario' => 50]],
    ])->assertSessionHasNoErrors();

    expect(StockBodega::where('producto_id', $producto->id)->exists())->toBeFalse();
});
