<?php

use App\Models\User;
use App\Modules\Administracion\Models\Empresa;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

test('owners can view and create the company profile without a custom role', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->get(route('empresa.edit'))->assertOk();

    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Llantas El Sol',
        'nit_empresa' => '900123456-1',
    ])->assertRedirect();

    $empresa = Empresa::firstOrFail();
    expect($empresa->nombre_empresa)->toBe('Llantas El Sol');
});

test('owners can update the existing company profile', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    Empresa::factory()->create(['nombre_empresa' => 'Nombre Original']);

    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Nombre Actualizado',
    ])->assertRedirect();

    expect(Empresa::count())->toBe(1);
    expect(Empresa::first()->nombre_empresa)->toBe('Nombre Actualizado');
});

test('members without permission cannot view or update the company profile', function () {
    $member = User::factory()->create();
    asignarRol($member, 'Member');

    $this->actingAs($member)->get(route('empresa.edit'))->assertForbidden();

    $this->actingAs($member)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Intento no autorizado',
    ])->assertForbidden();
});

test('the company has a square icon for the app and the shape its logo is printed with', function () {
    Storage::fake('public');
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');
    Empresa::factory()->create(['nombre_empresa' => 'Black purple']);

    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Black purple',
        'logo_empresa' => UploadedFile::fake()->image('logo.png', 600, 200),
        'formato_logo' => 'CUADRADO',
        'icono_empresa' => UploadedFile::fake()->image('icono.png', 512, 512),
    ])->assertSessionHasNoErrors();

    $empresa = Empresa::sole();
    Storage::disk('public')->assertExists([$empresa->logo_empresa, $empresa->icono_empresa]);

    expect($empresa->formato_logo)->toBe('CUADRADO');

    $this->actingAs($owner)->get(route('empresa.edit'))
        ->assertSee('<link rel="icon" href="'.$empresa->icono_empresa_url.'">', false)
        ->assertInertia(fn ($page) => $page
            ->where('iconoUrl', $empresa->icono_empresa_url)
            ->where('logoUrl', $empresa->logo_empresa_url)
        );

    // Removing the icon falls back to the logo.
    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Black purple',
        'remove_icono_empresa' => true,
    ])->assertSessionHasNoErrors();

    expect(Empresa::sole()->icono_empresa)->toBeNull()
        ->and(Empresa::sole()->formato_logo)->toBe('CUADRADO');

    // Branding is resolved once per request: a real one starts fresh.
    app()->forgetScopedInstances();
    $this->actingAs($owner)->get(route('empresa.edit'))
        ->assertInertia(fn ($page) => $page->where('iconoUrl', $empresa->logo_empresa_url));
});

test('the company icon must be an image big enough and the logo shape a known one', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Black purple',
        'icono_empresa' => UploadedFile::fake()->image('icono.png', 32, 32),
        'formato_logo' => 'REDONDO',
    ])->assertSessionHasErrors(['icono_empresa', 'formato_logo']);
});

test('the company keeps its brand: colors and slogan', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');
    Empresa::factory()->create();

    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Black purple',
        'color_primario' => '#3B0764',
        'color_acento' => '#a855f7',
        'eslogan_empresa' => 'Todo para tu belleza',
        'colaboracion_empresa' => 'Wanda',
    ])->assertSessionHasNoErrors();

    expect(Empresa::sole())
        ->color_primario->toBe('#3B0764')
        ->eslogan_empresa->toBe('Todo para tu belleza')
        ->colaboracion_empresa->toBe('Wanda');

    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Black purple',
        'color_primario' => 'morado',
    ])->assertSessionHasErrors(['color_primario' => 'Elige un color válido.']);
});

test('the company lists its networks, a custom one with the icon it uploads', function () {
    Storage::fake('public');
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');
    Empresa::factory()->create();

    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Black purple',
        'redes_sociales_enviadas' => true,
        'redes_sociales' => [
            ['red' => 'whatsapp', 'valor' => ' 300 123 4567 '],
            ['red' => 'personalizada', 'nombre' => 'Linktree', 'valor' => 'linktr.ee/bp', 'icono_archivo' => UploadedFile::fake()->image('linktree.png', 64, 64)],
        ],
    ])->assertSessionHasNoErrors();

    $redes = Empresa::sole()->redes_sociales;
    $icono = $redes[1]['icono'];

    expect($redes[0])->toBe(['red' => 'whatsapp', 'valor' => '300 123 4567'])
        ->and($redes[1])->toMatchArray(['red' => 'personalizada', 'nombre' => 'Linktree']);
    Storage::disk('public')->assertExists($icono);

    $this->actingAs($owner)->get(route('empresa.edit'))
        ->assertInertia(fn ($page) => $page
            ->where('empresa.redes.0.nombre', 'WhatsApp')
            ->where('empresa.redes.1.icono_url', Storage::disk('public')->url($icono))
            ->has('redesDisponibles')
        );

    // Saved again, the custom one keeps its icon (and no other file can be named).
    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Black purple',
        'redes_sociales_enviadas' => true,
        'redes_sociales' => [
            ['red' => 'personalizada', 'nombre' => 'Linktree', 'valor' => 'linktr.ee/bp', 'icono' => $icono],
            ['red' => 'personalizada', 'nombre' => 'Otra', 'valor' => 'otra', 'icono' => 'empresa/logo-ajeno.png'],
        ],
    ])->assertSessionHasNoErrors();

    expect(Empresa::sole()->redes_sociales[0]['icono'])->toBe($icono)
        ->and(Empresa::sole()->redes_sociales[1])->not->toHaveKey('icono');

    // Left without networks, the icon nobody uses goes away.
    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Black purple',
        'redes_sociales_enviadas' => true,
    ])->assertSessionHasNoErrors();

    expect(Empresa::sole()->redes_sociales)->toBeNull();
    Storage::disk('public')->assertMissing($icono);
});

test('a network must be a known one, with its value and a custom one with its name', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->patch(route('empresa.update'), [
        'nombre_empresa' => 'Black purple',
        'redes_sociales_enviadas' => true,
        'redes_sociales' => [
            ['red' => 'myspace', 'valor' => 'bp'],
            ['red' => 'instagram', 'valor' => ''],
            ['red' => 'personalizada', 'valor' => 'bp'],
        ],
    ])->assertSessionHasErrors([
        'redes_sociales.0.red',
        'redes_sociales.1.valor' => 'Escribe el usuario, número o enlace.',
        'redes_sociales.2.nombre' => 'Escribe el nombre de la red.',
    ]);
});
