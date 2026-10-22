<?php

use App\Models\User;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\Proveedor;
use App\Modules\Inventario\Models\Bodega;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    Carbon::setTestNow('2026-10-21 10:00:00');
});

afterEach(fn () => Carbon::setTestNow());

function compraACredito(Proveedor $proveedor, array $extra = []): array
{
    return $extra + [
        'proveedor_id' => $proveedor->id,
        'factura' => 'FAC-'.fake()->unique()->numerify('####'),
        'fecha' => '2026-10-21 10:00:00',
        'descuento' => 0,
        'detalles' => [
            ['producto_id' => Producto::factory()->create(['inventariable' => true])->id, 'bodega_id' => Bodega::factory()->create()->id, 'cantidad' => 1, 'precio_unitario' => 100000, 'recibido' => true],
        ],
    ];
}

test('a compra is due after the days of credit of its proveedor unless a date is given', function () {
    $proveedor = Proveedor::factory()->create(['dias_credito' => 30]);

    $this->actingAs($this->owner)->post(route('compras.store'), compraACredito($proveedor, ['factura' => 'A']))->assertSessionHasNoErrors();
    $this->actingAs($this->owner)->post(route('compras.store'), compraACredito($proveedor, ['factura' => 'B', 'fecha_vencimiento' => '2026-11-05']))->assertSessionHasNoErrors();

    expect(Compra::where('factura', 'A')->value('fecha_vencimiento')->toDateString())->toBe('2026-11-20')
        ->and(Compra::where('factura', 'B')->value('fecha_vencimiento')->toDateString())->toBe('2026-11-05');
});

test('a compra is overdue only while it owes something past its due date', function () {
    $vencida = Compra::factory()->create(['saldo_pendiente' => 5000, 'fecha_vencimiento' => '2026-10-20']);
    $alDia = Compra::factory()->create(['saldo_pendiente' => 5000, 'fecha_vencimiento' => '2026-10-21']);
    $pagada = Compra::factory()->create(['saldo_pendiente' => 0, 'fecha_vencimiento' => '2026-10-01']);

    expect($vencida->vencida)->toBeTrue()
        ->and($alDia->vencida)->toBeFalse()
        ->and($pagada->vencida)->toBeFalse()
        ->and(Compra::vencidas()->pluck('id')->all())->toBe([$vencida->id]);
});

test('cuentas por pagar groups what is owed by proveedor, overdue first', function () {
    $alDia = Proveedor::factory()->create(['nombre_proveedor' => 'Al día', 'dias_credito' => 30]);
    $moroso = Proveedor::factory()->create(['nombre_proveedor' => 'Moroso']);

    Compra::factory()->create(['proveedor_id' => $alDia->id, 'total_a_pagar' => 900000, 'saldo_pendiente' => 900000, 'fecha_vencimiento' => '2026-10-25']);
    Compra::factory()->create(['proveedor_id' => $moroso->id, 'total_a_pagar' => 100000, 'saldo_pendiente' => 60000, 'fecha_vencimiento' => '2026-10-18']);
    Compra::factory()->create(['proveedor_id' => $moroso->id, 'total_a_pagar' => 50000, 'saldo_pendiente' => 0, 'fecha_vencimiento' => '2026-10-01']);

    $this->actingAs($this->owner)->get(route('compras.cuentas-por-pagar'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('cuentas-por-pagar/index')
            ->where('resumen.total', 960000)
            ->where('resumen.vencido', 60000)
            ->where('resumen.proximo', 900000)
            ->where('resumen.facturas', 2)
            ->has('proveedores', 2)
            ->where('proveedores.0.proveedor.nombre_proveedor', 'Moroso')
            ->where('proveedores.0.vencido', 60000)
            ->has('proveedores.0.compras', 1)
            ->where('proveedores.0.compras.0.dias_para_vencer', -3)
            ->where('proveedores.1.compras.0.dias_para_vencer', 4)
        );
});

test('the sidebar counts the compras still owed and the overdue ones', function () {
    Compra::factory()->count(2)->create(['saldo_pendiente' => 1000, 'fecha_vencimiento' => '2026-10-01']);
    Compra::factory()->create(['saldo_pendiente' => 1000, 'fecha_vencimiento' => '2026-12-01']);

    $this->actingAs($this->owner)->get(route('compras.cuentas-por-pagar'))
        ->assertInertia(fn ($page) => $page
            ->where('navCounts.comprasPorPagar', 3)
            ->where('navCounts.comprasVencidas', 2)
        );
});

test('the days of credit are saved with the proveedor', function () {
    $proveedor = Proveedor::factory()->create();

    $this->actingAs($this->owner)
        ->patch(route('proveedores.update', [$proveedor]), [...$proveedor->only(['nombre_proveedor', 'nit_proveedor', 'tipo_proveedor', 'categoria_proveedor', 'tipo_cuenta_proveedor']), 'dias_credito' => 45])
        ->assertSessionHasNoErrors();

    expect($proveedor->fresh()->dias_credito)->toBe(45);
});
