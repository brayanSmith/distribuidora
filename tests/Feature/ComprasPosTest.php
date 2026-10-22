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
});

test('the compras POS lists the products that carry stock with their last cost', function () {
    $llanta = Producto::factory()->create(['inventariable' => true, 'costo_producto' => 120000]);
    Producto::factory()->servicio()->create();
    StockBodega::factory()->create(['producto_id' => $llanta->id, 'stock' => 4]);
    Proveedor::factory()->create();

    $this->actingAs($this->owner)->get(route('compras.pos'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('compras-pos/index')
            ->has('productos', 1)
            ->where('productos.0.id', $llanta->id)
            ->where('productos.0.costo_producto', 120000)
            ->where('productos.0.stock_total', 4)
            ->has('proveedores', 1)
            ->has('proveedores.0.nit_proveedor')
            ->has('proveedores.0.telefono_proveedor')
            ->has('proveedores.0.ciudad_proveedor')
            ->has('bodegas')
            ->where('canCreateProveedor', true)
        );
});

test('the cost is not sent to whoever may not see it', function () {
    Producto::factory()->create(['inventariable' => true, 'costo_producto' => 120000]);
    $this->owner->update(['tipos_precio_permitidos' => ['valor_detal']]);

    $this->actingAs($this->owner)->get(route('compras.pos'))
        ->assertInertia(fn ($page) => $page->where('productos.0.costo_producto', null));
});

test('a compra registered from the POS keeps the user there and adds the received stock', function () {
    $producto = Producto::factory()->create(['inventariable' => true]);
    $bodega = Bodega::factory()->create();

    $this->actingAs($this->owner)->from(route('compras.pos'))->post(route('compras.store'), [
        'stay_on_page' => true,
        'proveedor_id' => Proveedor::factory()->create()->id,
        'factura' => 'FAC-POS-1',
        'fecha' => '2026-10-21T10:00:00Z',
        'descuento' => 0,
        'detalles' => [
            ['producto_id' => $producto->id, 'bodega_id' => $bodega->id, 'cantidad' => 3, 'precio_unitario' => 100000, 'recibido' => true],
        ],
    ])->assertSessionHasNoErrors()->assertRedirect(route('compras.pos'));

    $compra = Compra::where('factura', 'FAC-POS-1')->firstOrFail();

    expect((float) $compra->total_a_pagar)->toBe(300000.0)
        ->and($compra->estado)->toBe('RECIBIDA')
        ->and((float) StockBodega::where('producto_id', $producto->id)->where('bodega_id', $bodega->id)->value('stock'))->toBe(3.0);
});

test('members without compras.create cannot open the compras POS', function () {
    $member = User::factory()->create();
    asignarRol($member, 'Member');
    $member->givePermissionTo('compras.view');

    $this->actingAs($member)->get(route('compras.pos'))->assertForbidden();
});

test('the catalog brings the sale prices, the images and the stock of each bodega', function () {
    $producto = Producto::factory()->create(['inventariable' => true, 'valor_detal' => 150000, 'valor_mayorista' => 130000]);
    $stock = StockBodega::factory()->create(['producto_id' => $producto->id, 'stock' => 6]);

    $this->actingAs($this->owner)->get(route('compras.pos'))
        ->assertInertia(fn ($page) => $page
            ->where('productos.0.valor_detal', 150000)
            ->where('productos.0.valor_mayorista', 130000)
            ->has('productos.0.imagenes')
            ->where("productos.0.stock_por_bodega.{$stock->bodega_id}", 6)
            ->where('canUpdatePrecios', true)
        );
});

test('the sale prices of a producto can be changed while buying it', function () {
    $producto = Producto::factory()->create(['valor_detal' => 150000, 'valor_mayorista' => 130000, 'costo_producto' => 100000]);

    $this->actingAs($this->owner)->from(route('compras.pos'))
        ->patch(route('productos.precios', [$producto]), ['valor_detal' => 165000, 'valor_mayorista' => 140000, 'costo_producto' => 1])
        ->assertRedirect(route('compras.pos'));

    $producto->refresh();
    expect((float) $producto->valor_detal)->toBe(165000.0)
        ->and((float) $producto->valor_mayorista)->toBe(140000.0)
        ->and((float) $producto->costo_producto)->toBe(100000.0);
});

test('only the prices the user may see are changed, and only with productos.update', function () {
    $producto = Producto::factory()->create(['valor_detal' => 150000, 'valor_mayorista' => 130000]);
    $this->owner->update(['tipos_precio_permitidos' => ['valor_detal']]);

    $this->actingAs($this->owner)
        ->patch(route('productos.precios', [$producto]), ['valor_detal' => 160000, 'valor_mayorista' => 1])
        ->assertRedirect();

    expect((float) $producto->fresh()->valor_detal)->toBe(160000.0)
        ->and((float) $producto->fresh()->valor_mayorista)->toBe(130000.0);

    $member = User::factory()->create();
    asignarRol($member, 'Member');
    $member->givePermissionTo('compras.create');

    $this->actingAs($member)
        ->patch(route('productos.precios', [$producto]), ['valor_detal' => 1])
        ->assertForbidden();
});

test('a producto can be created from the compras POS without leaving it', function () {
    $this->actingAs($this->owner)->get(route('compras.pos'))
        ->assertInertia(fn ($page) => $page->where('canCreateProducto', true)->has('categorias'));

    $this->actingAs($this->owner)->from(route('compras.pos'))
        ->post(route('productos.store'), ['referencia_producto' => 'NUEVA-1', 'inventariable' => true, 'stay_on_page' => 1])
        ->assertRedirect(route('compras.pos'));

    $this->actingAs($this->owner)->get(route('compras.pos'))
        ->assertInertia(fn ($page) => $page->where('productos', fn ($productos) => collect($productos)->contains('nombre', 'NUEVA-1')));
});
