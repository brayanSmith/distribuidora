<?php

use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Hash;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate('usuarios.view');
    Permission::findOrCreate('usuarios.create');
    Permission::findOrCreate('usuarios.update');
    Permission::findOrCreate('usuarios.delete');
});

test('owners can create a user with roles', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');
    $role = Role::create(['name' => 'Vendedor']);

    $this
        ->actingAs($owner)
        ->post(route('usuarios.store'), [
            'name' => 'Nuevo Empleado',
            'email' => 'empleado@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'tipos_precio_permitidos' => ['valor_detal', 'costo'],
            'roles' => [$role->id],
        ])
        ->assertRedirect();

    $usuario = User::where('email', 'empleado@example.com')->firstOrFail();

    expect($usuario->hasRole('Vendedor'))->toBeTrue();
    expect($usuario->tiposPrecioPermitidos())->toBe(['valor_detal', 'costo']);
    expect(Hash::check('password123', $usuario->password))->toBeTrue();
    expect($usuario->email_verified_at)->not->toBeNull();
});

test('a user can be created with no allowed prices', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->post(route('usuarios.store'), [
        'name' => 'Nuevo',
        'email' => 'nuevo@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
        'tipos_precio_permitidos' => [],
    ])->assertRedirect()->assertSessionDoesntHaveErrors('tipos_precio_permitidos');

    $usuario = User::where('email', 'nuevo@example.com')->firstOrFail();
    expect($usuario->tiposPrecioPermitidos())->toBe([]);
});

test('a user can be created without sending the allowed prices at all', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->post(route('usuarios.store'), [
        'name' => 'Nuevo',
        'email' => 'sinenviar@example.com',
        'password' => 'password123',
        'password_confirmation' => 'password123',
    ])->assertRedirect()->assertSessionDoesntHaveErrors('tipos_precio_permitidos');

    $usuario = User::where('email', 'sinenviar@example.com')->firstOrFail();
    expect($usuario->tiposPrecioPermitidos())->toBe([]);
});

test('members without permission cannot create users', function () {
    $member = User::factory()->create();
    asignarRol($member, 'Member');

    $this
        ->actingAs($member)
        ->post(route('usuarios.store'), [
            'name' => 'Nuevo Empleado',
            'email' => 'empleado@example.com',
            'password' => 'password123',
            'password_confirmation' => 'password123',
            'tipos_precio_permitidos' => ['valor_detal'],
        ])
        ->assertForbidden();
});

test('a user can be edited and its roles replaced', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');
    $empleado = User::factory()->create();
    $vendedor = Role::create(['name' => 'Vendedor']);
    $cajero = Role::create(['name' => 'Cajero']);
    $empleado->assignRole($vendedor);

    $this->actingAs($owner)->patch(route('usuarios.update', [$empleado]), [
        'name' => 'Otro Nombre',
        'email' => $empleado->email,
        'tipos_precio_permitidos' => ['valor_mayorista'],
        'roles' => [$cajero->id],
    ])->assertRedirect();

    expect($empleado->fresh()->name)->toBe('Otro Nombre');
    expect($empleado->fresh()->tiposPrecioPermitidos())->toBe(['valor_mayorista']);
    expect($empleado->fresh()->roles->pluck('name')->all())->toBe(['Cajero']);
});

test('a user being edited can be left with no allowed prices', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');
    $empleado = User::factory()->create(['tipos_precio_permitidos' => ['valor_detal']]);

    $this->actingAs($owner)->patch(route('usuarios.update', [$empleado]), [
        'name' => $empleado->name,
        'email' => $empleado->email,
        'tipos_precio_permitidos' => [],
    ])->assertRedirect()->assertSessionDoesntHaveErrors('tipos_precio_permitidos');

    expect($empleado->fresh()->tiposPrecioPermitidos())->toBe([]);
});

test('nobody can delete their own user', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->delete(route('usuarios.destroy', [$owner]))->assertForbidden();
    expect(User::find($owner->id))->not->toBeNull();
});

test('deleting a user removes the account', function () {
    $owner = User::factory()->create();
    $empleado = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->delete(route('usuarios.destroy', [$empleado]))->assertRedirect();

    expect(User::find($empleado->id))->toBeNull();
});

test('the allowed prices can be changed inline, keeping at least one', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');
    $empleado = User::factory()->create();

    $this->actingAs($owner)->patch(route('usuarios.precios.update', [$empleado]), [
        'tipos_precio_permitidos' => ['valor_detal'],
    ])->assertRedirect();

    expect($empleado->fresh()->tiposPrecioPermitidos())->toBe(['valor_detal']);

    $this->actingAs($owner)->patch(route('usuarios.precios.update', [$empleado]), [
        'tipos_precio_permitidos' => [],
    ])->assertSessionHasErrors('tipos_precio_permitidos');

    $member = User::factory()->create();
    asignarRol($member, 'Member');

    $this->actingAs($member)->patch(route('usuarios.precios.update', [$empleado]), [
        'tipos_precio_permitidos' => ['costo'],
    ])->assertForbidden();
});

test('the prices saved by the previous system are understood', function (?array $guardados, array $esperados) {
    $empleado = User::factory()->create(['tipos_precio_permitidos' => $guardados]);

    expect($empleado->tiposPrecioPermitidos())->toBe($esperados);
})->with([
    'its own names' => [['MAYORISTA', 'DETAL'], ['valor_detal', 'valor_mayorista']],
    'both systems names' => [['valor_detal', 'DETAL'], ['valor_detal']],
    'null means never restricted: every price' => [null, ['valor_detal', 'valor_mayorista', 'costo']],
    'an explicit empty array means no price at all' => [[], []],
]);

test('saving a user keeps the prices readable by the previous system', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');
    $empleado = User::factory()->create(['tipos_precio_permitidos' => ['DETAL']]);

    $this->actingAs($owner)->patch(route('usuarios.update', [$empleado]), [
        'name' => $empleado->name,
        'email' => $empleado->email,
        'tipos_precio_permitidos' => ['valor_mayorista', 'costo'],
    ])->assertRedirect();

    expect($empleado->fresh()->tipos_precio_permitidos)->toBe(['valor_mayorista', 'costo', 'MAYORISTA', 'COSTO']);
});
