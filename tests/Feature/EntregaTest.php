<?php

use App\Models\User;
use App\Modules\Administracion\Models\Role;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockBodega;
use App\Modules\Ventas\Models\Cliente;
use App\Modules\Ventas\Models\Entrega;
use App\Modules\Ventas\Models\Pedido;
use Illuminate\Support\Carbon;
use Illuminate\Testing\TestResponse;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
});

afterEach(fn () => Carbon::setTestNow());

/**
 * @param  array<string, mixed>  $extra
 */
function ventaContraEntrega(User $usuario, array $extra = []): TestResponse
{
    return test()->actingAs($usuario)->post(route('pos.store'), $extra + [
        'cliente_id' => Cliente::factory()->create()->id,
        'fecha' => '2026-10-21 10:00:00',
        'user_id' => $usuario->id,
        'bodega_id' => Bodega::factory()->create()->id,
        'tipo_precio' => 'DETAL',
        'tipo_pago' => 'CONTRA_ENTREGA',
        'detalles' => [
            ['producto_id' => Producto::factory()->create()->id, 'cantidad' => 1, 'precio_unitario' => 100],
        ],
    ]);
}

test('a contra entrega POS sale keeps where it is delivered', function () {
    ventaContraEntrega($this->owner, [
        'entrega' => ['direccion' => 'Calle 10 # 5-20', 'ciudad' => 'Cali', 'telefono' => '3001234567', 'recibe' => 'Ana', 'nota' => 'Portería'],
    ])->assertSessionHasNoErrors();

    $pedido = Pedido::latest('id')->first();

    expect($pedido->tipo_pago)->toBe('CONTRA_ENTREGA')
        ->and($pedido->fecha_vencimiento)->toBeNull()
        ->and($pedido->entrega)->not->toBeNull()
        ->and($pedido->entrega->direccion)->toBe('Calle 10 # 5-20')
        ->and($pedido->entrega->telefono)->toBe('3001234567')
        ->and($pedido->entrega->estado)->toBe(Entrega::POR_DESPACHAR);
});

test('a contra entrega POS sale needs the address and the phone', function () {
    ventaContraEntrega($this->owner)
        ->assertSessionHasErrors(['entrega.direccion', 'entrega.telefono']);

    expect(Entrega::count())->toBe(0);
});

test('other POS sales do not create a delivery', function () {
    ventaContraEntrega($this->owner, ['tipo_pago' => 'CONTADO'])->assertSessionHasNoErrors();

    expect(Entrega::count())->toBe(0);
});

test('entregas brings at once the pending deliveries and the ones finished lately, of the authorized bodegas', function () {
    [$a, $b] = Bodega::factory()->count(2)->create();
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $rol = Role::create(['name' => 'Sucursal']);
    $rol->bodegas()->sync([$a->id]);
    $miembro->assignRole($rol);
    $miembro->givePermissionTo('entregas.view');

    Entrega::factory()->for(Pedido::factory()->create(['bodega_id' => $a->id]))->create();
    Entrega::factory()->for(Pedido::factory()->create(['bodega_id' => $a->id]))->create(['estado' => Entrega::ENTREGADO]);
    Entrega::factory()->for(Pedido::factory()->create(['bodega_id' => $a->id]))->create(['estado' => Entrega::DEVUELTO]);
    // Finished long ago: no longer listed. Pending for long: still listed.
    Entrega::factory()->for(Pedido::factory()->create(['bodega_id' => $a->id]))->create(['estado' => Entrega::ENTREGADO, 'updated_at' => now()->subDays(31)]);
    Entrega::factory()->for(Pedido::factory()->create(['bodega_id' => $a->id]))->create(['estado' => Entrega::DEVUELTO, 'updated_at' => now()->subDays(60)]);
    Entrega::factory()->for(Pedido::factory()->create(['bodega_id' => $b->id]))->create();

    $this->actingAs($miembro)->get(route('entregas.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('entregas/index')
            ->has('entregas', 4)
            ->where('entregas.0.estado', Entrega::DEVUELTO)
            ->where('entregas.3.estado', Entrega::ENTREGADO)
            ->where('diasFinalizadas', 30)
            ->where('navCounts.entregasActivas', 1)
            ->where('navCounts.entregasDevueltas', 2)
            ->where('canUpdate', false)
            ->where('canCobrar', false)
            ->where('canViewEntregas', true)
        );
});

test('entregas needs its permission', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $entrega = Entrega::factory()->create();

    $this->actingAs($miembro)->get(route('entregas.index'))->assertForbidden();
    $this->actingAs($miembro)->patch(route('entregas.update', $entrega), ['estado' => Entrega::EN_CAMINO])->assertForbidden();
});

test('a delivery is dispatched with its messenger and then delivered', function () {
    Carbon::setTestNow('2026-10-21 10:00:00');
    $entrega = Entrega::factory()->create();
    $pedro = User::factory()->create(['name' => 'Pedro']);

    // Dispatching says who takes it.
    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::EN_CAMINO])
        ->assertSessionHasErrors(['mensajero_id' => 'Indica quién lleva el pedido.']);

    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::EN_CAMINO, 'mensajero_id' => $pedro->id])
        ->assertSessionHasNoErrors();

    expect($entrega->fresh())
        ->estado->toBe(Entrega::EN_CAMINO)
        ->mensajero_id->toBe($pedro->id)
        ->despachada_at->toDateTimeString()->toBe('2026-10-21 10:00:00');

    Carbon::setTestNow('2026-10-21 12:30:00');
    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::ENTREGADO]);

    expect($entrega->fresh())
        ->estado->toBe(Entrega::ENTREGADO)
        ->mensajero_id->toBe($pedro->id)
        ->entregada_at->toDateTimeString()->toBe('2026-10-21 12:30:00');
});

test('a delivery goes in order: dispatched, paid and then delivered', function () {
    $pedido = Pedido::factory()->create(['total_a_pagar' => 50000, 'saldo_pendiente' => 50000]);
    $entrega = Entrega::factory()->for($pedido)->create();
    $marcar = fn (string $estado) => $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => $estado, 'mensajero_id' => $this->owner->id]);

    $marcar(Entrega::ENTREGADO)->assertSessionHasErrors(['estado' => 'Primero despacha el pedido.']);

    $marcar(Entrega::EN_CAMINO)->assertSessionHasNoErrors();
    $marcar(Entrega::EN_CAMINO)->assertSessionHasErrors('estado');
    $marcar(Entrega::ENTREGADO)->assertSessionHasErrors(['estado' => 'Primero cobra el pedido: faltan $50.000.']);

    expect($entrega->fresh()->estado)->toBe(Entrega::EN_CAMINO);

    $pedido->update(['saldo_pendiente' => 0]);
    $marcar(Entrega::ENTREGADO)->assertSessionHasNoErrors();

    expect($entrega->fresh()->estado)->toBe(Entrega::ENTREGADO);

    // Delivered is the end of the road.
    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::DEVUELTO, 'motivo' => 'Rechazado'])
        ->assertSessionHasErrors('estado');
});

test('a delivery only takes the known states', function () {
    $entrega = Entrega::factory()->create();

    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => 'PERDIDO'])
        ->assertSessionHasErrors('estado');
});

test('the sidebar counts the deliveries still to finish', function () {
    Entrega::factory()->count(2)->create();
    Entrega::factory()->create(['estado' => Entrega::EN_CAMINO]);
    Entrega::factory()->create(['estado' => Entrega::DEVUELTO]);

    $this->actingAs($this->owner)->get(route('dashboard'))
        ->assertInertia(fn ($page) => $page->where('navCounts.entregasActivas', 3));
});

test('a returned delivery needs the reason', function () {
    $entrega = Entrega::factory()
        ->for(Pedido::factory()->create(['total_a_pagar' => 50000, 'saldo_pendiente' => 50000]))
        ->create(['estado' => Entrega::EN_CAMINO]);

    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::DEVUELTO])
        ->assertSessionHasErrors('motivo');

    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::DEVUELTO, 'motivo' => 'Dirección errada'])
        ->assertSessionHasNoErrors();

    expect($entrega->fresh())
        ->estado->toBe(Entrega::DEVUELTO)
        ->motivo->toBe('Dirección errada');
});

test('a delivery is rescheduled for another day and goes back to dispatch', function () {
    Carbon::setTestNow('2026-10-22 10:00:00');
    $entrega = Entrega::factory()->create([
        'estado' => Entrega::DEVUELTO,
        'motivo' => 'El cliente no estaba',
        'mensajero_id' => User::factory(),
        'despachada_at' => now(),
    ]);

    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::POR_DESPACHAR])
        ->assertSessionHasErrors('fecha_programada');

    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::POR_DESPACHAR, 'fecha_programada' => '2026-10-21'])
        ->assertSessionHasErrors('fecha_programada');

    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::POR_DESPACHAR, 'fecha_programada' => '2026-10-24', 'motivo' => 'El cliente pidió otro día'])
        ->assertSessionHasNoErrors();

    expect($entrega->fresh())
        ->estado->toBe(Entrega::POR_DESPACHAR)
        ->fecha_programada->toDateString()->toBe('2026-10-24')
        ->motivo->toBe('El cliente pidió otro día')
        ->reagendamientos->toBe(1)
        ->despachada_at->toBeNull();
});

test('a contra entrega POS sale can be scheduled for a day', function () {
    Carbon::setTestNow('2026-10-22 10:00:00');

    ventaContraEntrega($this->owner, [
        'entrega' => ['direccion' => 'Calle 1', 'telefono' => '300', 'fecha_programada' => '2026-10-25'],
    ])->assertSessionHasNoErrors();

    expect(Entrega::first()->fecha_programada->toDateString())->toBe('2026-10-25');
});

test('a returned pedido is cancelled: its stock goes back and it is no longer owed', function () {
    $bodega = Bodega::factory()->create();
    $producto = Producto::factory()->create();
    StockBodega::create(['bodega_id' => $bodega->id, 'producto_id' => $producto->id, 'stock' => 10]);

    ventaContraEntrega($this->owner, [
        'bodega_id' => $bodega->id,
        'detalles' => [['producto_id' => $producto->id, 'cantidad' => 3, 'precio_unitario' => 100]],
        'entrega' => ['direccion' => 'Calle 1', 'telefono' => '300'],
    ])->assertSessionHasNoErrors();

    $entrega = Entrega::firstOrFail();
    expect((float) StockBodega::firstOrFail()->stock)->toBe(7.0);

    // Only a returned one can be cancelled.
    $this->actingAs($this->owner)->post(route('entregas.anular', $entrega))->assertSessionHasErrors('estado');

    $entrega->update(['estado' => Entrega::DEVUELTO, 'motivo' => 'Rechazado']);
    $this->actingAs($this->owner)->post(route('entregas.anular', $entrega))->assertSessionHasNoErrors();

    expect($entrega->fresh()->estado)->toBe(Entrega::ANULADO)
        ->and((float) StockBodega::firstOrFail()->stock)->toBe(10.0)
        ->and(Pedido::count())->toBe(0)
        ->and(Pedido::onlyTrashed()->count())->toBe(1);

    $this->actingAs($this->owner)->get(route('entregas.index'))
        ->assertInertia(fn ($page) => $page
            ->has('entregas', 1)
            ->where('entregas.0.estado', Entrega::ANULADO)
            ->where('entregas.0.pedido.id', $entrega->pedido_id)
        );

    // A cancelled delivery does not move anymore.
    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::POR_DESPACHAR, 'fecha_programada' => now()->addDay()->toDateString()])
        ->assertSessionHasErrors('estado');
});

test('cancelling a returned pedido needs the permission to delete pedidos', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $miembro->givePermissionTo(['entregas.view', 'entregas.update']);
    $entrega = Entrega::factory()->create(['estado' => Entrega::DEVUELTO]);

    $this->actingAs($miembro)->get(route('entregas.index'))
        ->assertInertia(fn ($page) => $page->where('canAnular', false));

    $this->actingAs($miembro)->post(route('entregas.anular', $entrega))->assertForbidden();

    expect($entrega->fresh()->estado)->toBe(Entrega::DEVUELTO);
});

test('once collected on its way a delivery can no longer be returned nor rescheduled', function () {
    $pedido = Pedido::factory()->create(['total_a_pagar' => 50000, 'saldo_pendiente' => 0]);
    $entrega = Entrega::factory()->for($pedido)->create(['estado' => Entrega::EN_CAMINO]);

    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::DEVUELTO, 'motivo' => 'Rechazado'])
        ->assertSessionHasErrors(['estado' => 'El pedido ya está cobrado: solo falta marcarlo entregado.']);

    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::POR_DESPACHAR, 'fecha_programada' => now()->addDay()->toDateString()])
        ->assertSessionHasErrors('estado');

    expect($entrega->fresh()->estado)->toBe(Entrega::EN_CAMINO);
});

test('the voucher of a delivery says where it goes and what to collect', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $miembro->givePermissionTo('entregas.view');
    $pedido = Pedido::factory()->create(['total_a_pagar' => 50000, 'saldo_pendiente' => 50000]);
    $entrega = Entrega::factory()->for($pedido)->create([
        'direccion' => 'Calle 10 # 5-20',
        'telefono' => '3001234567',
        'fecha_programada' => '2026-10-25',
        'mensajero_id' => User::factory()->create(['name' => 'Pedro'])->id,
    ]);

    $this->actingAs($miembro)->getJson(route('entregas.voucher', $entrega))
        ->assertOk()
        ->assertJsonPath('pedido.id', $pedido->id)
        ->assertJsonPath('pedido.saldo_pendiente', 50000)
        ->assertJsonPath('entrega.direccion', 'Calle 10 # 5-20')
        ->assertJsonPath('entrega.telefono', '3001234567')
        ->assertJsonPath('entrega.fecha_programada', '25/10/2026')
        ->assertJsonPath('entrega.mensajero', 'Pedro');
});

test('the voucher of a delivery needs the entregas permission', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');

    $this->actingAs($miembro)->getJson(route('entregas.voucher', Entrega::factory()->create()))
        ->assertForbidden();
});
