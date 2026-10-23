<?php

use App\Models\User;
use App\Modules\Administracion\Models\Role;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockBodega;
use App\Modules\Ventas\Models\Cliente;
use App\Modules\Ventas\Models\Pedido;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    Carbon::setTestNow('2026-10-22 10:00:00');
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
});

afterEach(fn () => Carbon::setTestNow());

/**
 * @param  array<string, mixed>  $extra
 */
function ventaSeparada(User $usuario, array $extra = []): TestResponse
{
    return test()->actingAs($usuario)->post(route('pos.store'), $extra + [
        'cliente_id' => Cliente::factory()->create()->id,
        'fecha' => '2026-10-22 10:00:00',
        'user_id' => $usuario->id,
        'bodega_id' => Bodega::factory()->create()->id,
        'tipo_precio' => 'DETAL',
        'tipo_pago' => 'SEPARADO',
        'detalles' => [
            ['producto_id' => Producto::factory()->create()->id, 'cantidad' => 1, 'precio_unitario' => 100],
        ],
    ]);
}

/**
 * @param  array<string, mixed>  $atributos
 */
function separado(array $atributos = []): Pedido
{
    return Pedido::factory()->create($atributos + [
        'tipo_pago' => 'SEPARADO',
        'total_a_pagar' => 80000,
        'abono' => 30000,
        'saldo_pendiente' => 50000,
        'fecha_recogida' => '2026-10-25',
    ]);
}

test('a separado POS sale keeps the day the cliente picks it up', function () {
    ventaSeparada($this->owner, ['fecha_recogida' => '2026-10-30', 'observacion' => 'A'])->assertSessionHasNoErrors();
    ventaSeparada($this->owner, ['observacion' => 'B'])->assertSessionHasNoErrors();
    ventaSeparada($this->owner, ['tipo_pago' => 'CONTADO', 'fecha_recogida' => '2026-10-30', 'observacion' => 'C'])->assertSessionHasNoErrors();

    expect(Pedido::where('observacion', 'A')->first()->fecha_recogida->toDateString())->toBe('2026-10-30')
        ->and(Pedido::where('observacion', 'B')->first()->fecha_recogida->toDateString())->toBe('2026-10-29')
        ->and(Pedido::where('observacion', 'C')->first()->fecha_recogida)->toBeNull();
});

test('a separado can not be picked up on a past day', function () {
    ventaSeparada($this->owner, ['fecha_recogida' => '2026-10-21'])
        ->assertSessionHasErrors(['fecha_recogida' => 'La fecha de recogida no puede ser anterior a hoy.']);
});

test('separados brings the ones to pick up and the ones picked up lately, of the authorized bodegas', function () {
    [$a, $b] = Bodega::factory()->count(2)->create();
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $rol = Role::create(['name' => 'Sucursal']);
    $rol->bodegas()->sync([$a->id]);
    $miembro->assignRole($rol);
    $miembro->givePermissionTo('separados.view');

    $vencido = separado(['bodega_id' => $a->id, 'fecha_recogida' => '2026-10-20']);
    separado(['bodega_id' => $a->id]);
    separado(['bodega_id' => $a->id, 'recogido_at' => now()->subDays(3)]);
    separado(['bodega_id' => $a->id, 'recogido_at' => now()->subDays(40)]);
    separado(['bodega_id' => $b->id]);
    Pedido::factory()->create(['bodega_id' => $a->id, 'tipo_pago' => 'CONTADO']);

    $this->actingAs($miembro)->get(route('separados.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('separados/index')
            ->has('separados', 3)
            ->where('separados.0.id', $vencido->id)
            ->where('separados.0.fecha_recogida', '2026-10-20')
            ->has('separados.0.productos')
            ->where('canUpdate', false)
            ->where('canCobrar', false)
            ->where('canAnular', false)
            ->where('canViewSeparados', true)
            ->where('navCounts.separadosPorRecoger', 2)
            ->where('navCounts.separadosVencidos', 1)
        );
});

test('separados needs its permission', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $pedido = separado();

    $this->actingAs($miembro)->get(route('separados.index'))->assertForbidden();
    $this->actingAs($miembro)->post(route('separados.entregar', $pedido))->assertForbidden();
    $this->actingAs($miembro)->getJson(route('separados.voucher', $pedido))->assertForbidden();
});

test('a separado is handed over only once it is fully paid', function () {
    $pedido = separado();

    $this->actingAs($this->owner)->post(route('separados.entregar', $pedido))
        ->assertSessionHasErrors(['pedido' => 'Primero cobra el pedido: faltan $50.000.']);

    expect($pedido->fresh()->recogido_at)->toBeNull();

    $pedido->update(['saldo_pendiente' => 0]);
    $this->actingAs($this->owner)->post(route('separados.entregar', $pedido))->assertSessionHasNoErrors();

    expect($pedido->fresh()->recogido_at->toDateTimeString())->toBe('2026-10-22 10:00:00');

    $this->actingAs($this->owner)->post(route('separados.entregar', $pedido))
        ->assertSessionHasErrors(['pedido' => 'El cliente ya recogió este pedido.']);
});

test('the pickup day of a separado can be moved, never to the past', function () {
    $pedido = separado();

    $this->actingAs($this->owner)->patch(route('separados.update', $pedido), ['fecha_recogida' => '2026-10-21'])
        ->assertSessionHasErrors('fecha_recogida');

    $this->actingAs($this->owner)->patch(route('separados.update', $pedido), ['fecha_recogida' => '2026-11-02'])
        ->assertSessionHasNoErrors();

    expect($pedido->fresh()->fecha_recogida->toDateString())->toBe('2026-11-02');
});

test('a separado the cliente never picks up is cancelled and its stock goes back', function () {
    $bodega = Bodega::factory()->create();
    $producto = Producto::factory()->create();
    StockBodega::create(['bodega_id' => $bodega->id, 'producto_id' => $producto->id, 'stock' => 10]);

    ventaSeparada($this->owner, [
        'bodega_id' => $bodega->id,
        'detalles' => [['producto_id' => $producto->id, 'cantidad' => 4, 'precio_unitario' => 100]],
    ])->assertSessionHasNoErrors();

    $pedido = Pedido::firstOrFail();
    expect((float) StockBodega::firstOrFail()->stock)->toBe(6.0);

    $this->actingAs($this->owner)->post(route('separados.anular', $pedido))->assertSessionHasNoErrors();

    expect((float) StockBodega::firstOrFail()->stock)->toBe(10.0)
        ->and(Pedido::count())->toBe(0);
});

test('cancelling a separado needs the permission to delete pedidos', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $miembro->givePermissionTo(['separados.view', 'separados.update']);
    $pedido = separado();

    $this->actingAs($miembro)->post(route('separados.anular', $pedido))->assertForbidden();

    expect($pedido->fresh())->not->toBeNull();
});

test('only separados go through this module', function () {
    $contado = Pedido::factory()->create(['tipo_pago' => 'CONTADO']);

    $this->actingAs($this->owner)->post(route('separados.entregar', $contado))->assertNotFound();
    $this->actingAs($this->owner)->getJson(route('separados.voucher', $contado))->assertNotFound();
});

test('the voucher of a separado can be seen from the module', function () {
    $pedido = separado();

    $this->actingAs($this->owner)->getJson(route('separados.voucher', $pedido))
        ->assertOk()
        ->assertJsonPath('pedido.id', $pedido->id);
});
