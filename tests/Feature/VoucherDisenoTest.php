<?php

use App\Models\User;
use App\Modules\Administracion\Models\Empresa;
use App\Modules\Ventas\Models\Pedido;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    $this->empresa = Empresa::factory()->create(['nombre_empresa' => 'Black purple']);
});

/** A block as the designer sends it. */
function bloqueVoucher(string $tipo, array $cambios = []): array
{
    return $cambios + [
        'id' => $tipo,
        'tipo' => $tipo,
        'visible' => true,
        'alineacion' => 'center',
        'tamano' => 'normal',
        'linea' => false,
        'campos' => [],
    ];
}

test('the company saves how its voucher is laid out, and every voucher carries it', function () {
    $bloques = [
        bloqueVoucher('texto', ['id' => 'saludo', 'texto' => '¡Bienvenido!', 'tamano' => 'grande']),
        bloqueVoucher('productos', ['alineacion' => 'left']),
        bloqueVoucher('totales', ['campos' => ['flete' => false, 'reteica' => false], 'linea' => true]),
        bloqueVoucher('logo', ['visible' => false]),
    ];

    $this->actingAs($this->owner)
        ->put(route('empresa.voucher.update'), ['bloques' => $bloques])
        ->assertSessionHasNoErrors();

    expect($this->empresa->fresh()->diseno_voucher['bloques'])->toHaveCount(4)
        ->and($this->empresa->fresh()->diseno_voucher['bloques'][0]['texto'])->toBe('¡Bienvenido!');

    $this->actingAs($this->owner)
        ->getJson(route('pedidos.voucher', Pedido::factory()->create()))
        ->assertOk()
        ->assertJsonPath('diseno.bloques.1.tipo', 'productos')
        ->assertJsonPath('diseno.bloques.2.campos.flete', false);

    $this->actingAs($this->owner)->get(route('empresa.voucher.edit'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('empresa/voucher')
            ->where('diseno.bloques.0.id', 'saludo')
            ->where('empresa.nombre', 'Black purple')
            ->where('canUpdate', true)
        );
});

test('going back to the original design forgets the saved one', function () {
    $this->empresa->update(['diseno_voucher' => ['version' => 1, 'bloques' => [bloqueVoucher('logo')]]]);

    $this->actingAs($this->owner)
        ->put(route('empresa.voucher.update'), ['bloques' => []])
        ->assertSessionHasNoErrors();

    expect($this->empresa->fresh()->diseno_voucher)->toBeNull();
});

test('only known blocks and settings are saved', function () {
    $this->actingAs($this->owner)
        ->put(route('empresa.voucher.update'), ['bloques' => [
            bloqueVoucher('codigo_qr'),
            bloqueVoucher('texto', ['alineacion' => 'justify', 'texto' => str_repeat('a', 601)]),
        ]])
        ->assertSessionHasErrors(['bloques.0.tipo', 'bloques.1.alineacion', 'bloques.1.texto']);

    expect($this->empresa->fresh()->diseno_voucher)->toBeNull();
});

test('only who may edit the company changes the voucher design', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $miembro->givePermissionTo('empresa.view');

    $this->actingAs($miembro)->get(route('empresa.voucher.edit'))
        ->assertInertia(fn ($page) => $page->where('canUpdate', false));

    $this->actingAs($miembro)
        ->put(route('empresa.voucher.update'), ['bloques' => [bloqueVoucher('logo')]])
        ->assertForbidden();

    expect($this->empresa->fresh()->diseno_voucher)->toBeNull();
});
