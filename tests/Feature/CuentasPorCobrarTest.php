<?php

use App\Models\User;
use App\Modules\Administracion\Models\Role;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Ventas\Models\Cliente;
use App\Modules\Ventas\Models\Pedido;
use Illuminate\Support\Carbon;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    Carbon::setTestNow('2026-10-21 10:00:00');
});

afterEach(fn () => Carbon::setTestNow());

test('cuentas por cobrar groups what the clientes owe, overdue first', function () {
    $puntual = Cliente::factory()->create(['razon_social' => 'Puntual']);
    $moroso = Cliente::factory()->create(['razon_social' => 'Moroso']);

    Pedido::factory()->create(['cliente_id' => $puntual->id, 'total_a_pagar' => 500000, 'saldo_pendiente' => 500000, 'fecha_vencimiento' => '2026-10-24']);
    Pedido::factory()->create(['cliente_id' => $moroso->id, 'total_a_pagar' => 80000, 'saldo_pendiente' => 30000, 'fecha_vencimiento' => '2026-10-15']);
    Pedido::factory()->create(['cliente_id' => $moroso->id, 'total_a_pagar' => 90000, 'saldo_pendiente' => 0, 'fecha_vencimiento' => '2026-10-01']);

    $this->actingAs($this->owner)->get(route('pedidos.cuentas-por-cobrar'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('cuentas-por-cobrar/index')
            ->where('resumen.total', 530000)
            ->where('resumen.vencido', 30000)
            ->where('resumen.proximo', 500000)
            ->where('resumen.pedidos', 2)
            ->has('clientes', 2)
            ->where('clientes.0.cliente.razon_social', 'Moroso')
            ->where('clientes.0.vencido', 30000)
            ->where('clientes.0.pedidos.0.dias_para_vencer', -6)
            ->where('canCreateAbono', true)
        );
});

test('cuentas por cobrar and its counter only see the authorized bodegas', function () {
    [$a, $b] = Bodega::factory()->count(2)->create();
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $rol = Role::create(['name' => 'Sucursal']);
    $rol->bodegas()->sync([$a->id]);
    $miembro->assignRole($rol);
    $miembro->givePermissionTo('pedidos.view');

    Pedido::factory()->create(['bodega_id' => $a->id, 'saldo_pendiente' => 1000, 'fecha_vencimiento' => '2026-10-01']);
    Pedido::factory()->create(['bodega_id' => $b->id, 'saldo_pendiente' => 9000, 'fecha_vencimiento' => '2026-10-01']);

    $this->actingAs($miembro)->get(route('pedidos.cuentas-por-cobrar'))
        ->assertInertia(fn ($page) => $page
            ->where('resumen.total', 1000)
            ->where('navCounts.pedidosPorCobrar', 1)
            ->where('navCounts.pedidosVencidos', 1)
            ->where('canCreateAbono', false)
        );
});

test('the POS shows what each cliente owes and how much is overdue', function () {
    $cliente = Cliente::factory()->create();
    Pedido::factory()->create(['cliente_id' => $cliente->id, 'saldo_pendiente' => 40000, 'fecha_vencimiento' => '2026-10-10']);
    Pedido::factory()->create(['cliente_id' => $cliente->id, 'saldo_pendiente' => 10000, 'fecha_vencimiento' => '2026-11-10']);

    $clientes = $this->actingAs($this->owner)->get(route('pos.index'))->inertiaProps('clientes');
    $fila = collect($clientes)->firstWhere('id', $cliente->id);

    expect((float) $fila['deuda'])->toBe(50000.0)
        ->and((float) $fila['deuda_vencida'])->toBe(40000.0);
});
