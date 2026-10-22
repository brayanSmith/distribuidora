<?php

use App\Models\User;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Compras\Models\AbonoCompra;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\Proveedor;
use App\Modules\Finanzas\Models\Puc;
use App\Modules\Inventario\Models\Bodega;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    $this->puc = Puc::factory()->create();
});

function datosCompra(array $extra = []): array
{
    return $extra + [
        'proveedor_id' => Proveedor::factory()->create()->id,
        'factura' => 'FAC-'.fake()->unique()->numerify('####'),
        'fecha' => '2026-10-21T10:00:00Z',
        'descuento' => 0,
        'detalles' => [
            ['producto_id' => Producto::factory()->create(['inventariable' => true])->id, 'bodega_id' => Bodega::factory()->create()->id, 'cantidad' => 2, 'precio_unitario' => 50000, 'recibido' => true],
        ],
    ];
}

test('a compra without payments is owed in full', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra())->assertSessionHasNoErrors();

    $compra = Compra::firstOrFail();
    expect((float) $compra->abono)->toBe(0.0)
        ->and((float) $compra->saldo_pendiente)->toBe(100000.0)
        ->and($compra->estado_pago)->toBe('POR_PAGAR');
});

test('the payments made while registering the compra lower what is owed', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra([
        'abonos' => [
            ['puc_id' => $this->puc->id, 'monto' => 30000, 'descripcion' => 'Efectivo'],
            ['puc_id' => $this->puc->id, 'monto' => 70000],
        ],
    ]))->assertSessionHasNoErrors();

    $compra = Compra::firstOrFail();
    expect($compra->abonos)->toHaveCount(2)
        ->and((float) $compra->saldo_pendiente)->toBe(0.0)
        ->and($compra->estado_pago)->toBe('PAGADA')
        ->and($compra->abonos->first()->user_id)->toBe($this->owner->id);
});

test('the payments cannot be more than the total of the compra', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra([
        'abonos' => [['puc_id' => $this->puc->id, 'monto' => 150000]],
    ]))->assertSessionHasErrors('abonos');

    expect(Compra::count())->toBe(0);
});

test('a compra is paid later from the listing, never beyond what is owed', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra());
    $compra = Compra::firstOrFail();

    $this->actingAs($this->owner)
        ->post(route('compras.abonos.store', [$compra]), ['puc_id' => $this->puc->id, 'monto' => 120000])
        ->assertSessionHasErrors('monto');

    $this->actingAs($this->owner)
        ->post(route('compras.abonos.store', [$compra]), ['puc_id' => $this->puc->id, 'monto' => 40000])
        ->assertSessionHasNoErrors();

    expect((float) $compra->fresh()->saldo_pendiente)->toBe(60000.0)
        ->and($compra->fresh()->estado_pago)->toBe('POR_PAGAR');
});

test('deleting a payment puts its amount back on what is owed', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra([
        'abonos' => [['puc_id' => $this->puc->id, 'monto' => 100000]],
    ]));
    $compra = Compra::firstOrFail();
    $abono = $compra->abonos()->firstOrFail();

    $this->actingAs($this->owner)->delete(route('compras.abonos.destroy', [$compra, $abono]))->assertRedirect();

    expect(AbonoCompra::count())->toBe(0)
        ->and((float) $compra->fresh()->saldo_pendiente)->toBe(100000.0)
        ->and($compra->fresh()->estado_pago)->toBe('POR_PAGAR');
});

test('editing the compra recomputes what is owed with its new total', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra([
        'abonos' => [['puc_id' => $this->puc->id, 'monto' => 40000]],
    ]));
    $compra = Compra::with('detallesCompra')->firstOrFail();
    $detalle = $compra->detallesCompra->first();

    $this->actingAs($this->owner)->patch(route('compras.update', [$compra]), [
        'proveedor_id' => $compra->proveedor_id,
        'factura' => $compra->factura,
        'fecha' => '2026-10-21T10:00:00Z',
        'descuento' => 0,
        'detalles' => [
            ['producto_id' => $detalle->producto_id, 'bodega_id' => $detalle->bodega_id, 'cantidad' => 4, 'precio_unitario' => 50000, 'recibido' => true],
        ],
    ])->assertSessionHasNoErrors();

    expect((float) $compra->fresh()->saldo_pendiente)->toBe(160000.0);
});

test('paying compras needs its own permission', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra());
    $compra = Compra::firstOrFail();

    $member = User::factory()->create();
    asignarRol($member, 'Member');
    $member->givePermissionTo(['compras.view', 'compras.create']);

    $this->actingAs($member)
        ->post(route('compras.abonos.store', [$compra]), ['puc_id' => $this->puc->id, 'monto' => 1000])
        ->assertForbidden();

    $this->actingAs($member)->get(route('compras.pos'))
        ->assertInertia(fn ($page) => $page->where('canCreateAbono', false)->where('pucs', []));
});

test('the listing and the detail show what was paid and what is owed', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra([
        'abonos' => [['puc_id' => $this->puc->id, 'monto' => 25000]],
    ]));
    $compra = Compra::firstOrFail();

    $this->actingAs($this->owner)->get(route('compras.index'))
        ->assertInertia(fn ($page) => $page
            ->where('compras.0.saldo_pendiente', '75000.00')
            ->where('compras.0.estado_pago', 'POR_PAGAR')
            ->where('permissions.canCreateAbono', true)
            ->has('pucs', 1)
        );

    $this->actingAs($this->owner)->getJson(route('compras.show', [$compra]))
        ->assertOk()
        ->assertJsonPath('abonos.0.monto', '25000.00')
        ->assertJsonPath('abonos.0.puc.id', $this->puc->id);
});

test('a cash compra must be paid in full and is never due later', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra([
        'tipo_pago' => 'CONTADO',
        'abonos' => [['puc_id' => $this->puc->id, 'monto' => 40000]],
    ]))->assertSessionHasErrors('abonos');

    expect(Compra::count())->toBe(0);

    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra([
        'tipo_pago' => 'CONTADO',
        'fecha_vencimiento' => '2026-12-01',
        'abonos' => [['puc_id' => $this->puc->id, 'monto' => 100000]],
    ]))->assertSessionHasNoErrors();

    $compra = Compra::firstOrFail();
    expect($compra->tipo_pago)->toBe('CONTADO')
        ->and($compra->estado_pago)->toBe('PAGADA')
        ->and($compra->fecha_vencimiento)->toBeNull();
});

test('a credit compra may take an advance and keeps its due date', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra([
        'tipo_pago' => 'CREDITO',
        'fecha_vencimiento' => '2026-12-01',
        'abonos' => [['puc_id' => $this->puc->id, 'monto' => 20000]],
    ]))->assertSessionHasNoErrors();

    $compra = Compra::firstOrFail();
    expect($compra->tipo_pago)->toBe('CREDITO')
        ->and((float) $compra->saldo_pendiente)->toBe(80000.0)
        ->and($compra->fecha_vencimiento->toDateString())->toBe('2026-12-01');
});

test('without a tipo de pago a compra is cash when its payments cover the total', function () {
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra([
        'factura' => 'PAGADA',
        'abonos' => [['puc_id' => $this->puc->id, 'monto' => 100000]],
    ]));
    $this->actingAs($this->owner)->post(route('compras.store'), datosCompra(['factura' => 'DEBIDA']));

    expect(Compra::where('factura', 'PAGADA')->value('tipo_pago'))->toBe('CONTADO')
        ->and(Compra::where('factura', 'DEBIDA')->value('tipo_pago'))->toBe('CREDITO');
});
