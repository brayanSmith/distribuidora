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
    $this->bodega = Bodega::factory()->create();
    $this->producto = Producto::factory()->create(['costo_producto' => 1000]);

    // 10 bought, 4 arrived.
    $this->actingAs($this->owner)->post(route('compras.store'), [
        'proveedor_id' => Proveedor::factory()->create()->id,
        'factura' => 'FAC-55',
        'fecha' => '2026-10-23 09:30:00',
        'detalles' => [['producto_id' => $this->producto->id, 'bodega_id' => $this->bodega->id, 'cantidad' => 10, 'precio_unitario' => 1000, 'recibido' => false]],
    ])->assertSessionHasNoErrors();

    $this->compra = Compra::sole();
    $detalle = $this->compra->detallesCompra()->sole();
    $this->actingAs($this->owner)->post(route('compras.recepciones.store', [$this->compra]), ['lineas' => [$detalle->id => 4]]);
});

/** The form the edit screen sends: the lines it had keep what arrived. */
function guardarCompraEditada(Compra $compra, array $detalles, array $extra = []): array
{
    return $extra + [
        'factura' => $compra->factura,
        'proveedor_id' => $compra->proveedor_id,
        'fecha' => $compra->fecha,
        'fecha_vencimiento' => null,
        'descuento' => 0,
        'detalles' => $detalles,
    ];
}

test('editing a compra opens the Compras POS with its lines and what of them arrived', function () {
    $eliminado = Producto::factory()->create();
    $this->compra->detallesCompra()->create([
        'producto_id' => $eliminado->id,
        'bodega_id' => $this->bodega->id,
        'cantidad' => 1,
        'cantidad_recibida' => 0,
        'precio_unitario' => 500,
        'subtotal' => 500,
        'estado_entrega' => 'PENDIENTE',
    ]);
    $eliminado->delete();

    $this->actingAs($this->owner)->get(route('compras.edit', $this->compra))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('compras/editar')
            ->where('compra.factura', 'FAC-55')
            ->has('compra.detalles_compra', 2)
            ->where('compra.detalles_compra.0.cantidad_recibida', '4.00')
            // A deleted producto of its lines still has its name.
            ->where('productos', fn ($productos) => collect($productos)->pluck('id')->contains($eliminado->id))
            ->where('canDelete', true)
        );
});

test('the edited compra keeps what arrived and only what is new follows the switch', function () {
    $nuevo = Producto::factory()->create();

    $this->actingAs($this->owner)->patch(route('compras.update', $this->compra), guardarCompraEditada($this->compra, [
        // Raised from 10 to 12: 4 had arrived, 8 still to come.
        ['producto_id' => $this->producto->id, 'bodega_id' => $this->bodega->id, 'cantidad' => 12, 'precio_unitario' => 1100, 'cantidad_recibida' => 4, 'recibido' => false],
        // New, and it already arrived.
        ['producto_id' => $nuevo->id, 'bodega_id' => $this->bodega->id, 'cantidad' => 3, 'precio_unitario' => 200, 'cantidad_recibida' => 0, 'recibido' => true],
    ], ['factura' => 'FAC-55B']))->assertSessionHasNoErrors();

    $compra = $this->compra->fresh();
    $lineas = $compra->detallesCompra->keyBy('producto_id');

    expect($compra->factura)->toBe('FAC-55B')
        ->and((float) $lineas[$this->producto->id]->cantidad_recibida)->toBe(4.0)
        ->and($lineas[$this->producto->id]->estado_entrega)->toBe('PENDIENTE')
        ->and((float) StockBodega::where('producto_id', $this->producto->id)->value('stock'))->toBe(4.0)
        ->and((float) StockBodega::where('producto_id', $nuevo->id)->value('stock'))->toBe(3.0)
        // The latest compra of the producto: its cost follows the new price.
        ->and((float) $this->producto->fresh()->costo_producto)->toBe(1100.0);
});

test('removing a received line takes its goods out of the bodega', function () {
    $nuevo = Producto::factory()->create();

    $this->actingAs($this->owner)->patch(route('compras.update', $this->compra), guardarCompraEditada($this->compra, [
        ['producto_id' => $nuevo->id, 'bodega_id' => $this->bodega->id, 'cantidad' => 1, 'precio_unitario' => 200, 'cantidad_recibida' => 0, 'recibido' => false],
    ]))->assertSessionHasNoErrors();

    expect((float) StockBodega::where('producto_id', $this->producto->id)->value('stock'))->toBe(0.0);
});

test('only who may edit compras opens the editor', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $miembro->givePermissionTo('compras.view');

    $this->actingAs($miembro)->get(route('compras.edit', $this->compra))->assertForbidden();
});
