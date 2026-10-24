<?php

use App\Models\User;
use App\Modules\Administracion\Models\Empresa;
use App\Modules\Administracion\Models\Role;
use App\Modules\Catalogo\Models\Importacion;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Notifications\CuentasPorPagarPorVencer;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Ventas\Models\Cliente;
use App\Modules\Ventas\Models\Entrega;
use App\Modules\Ventas\Notifications\EntregaAsignada;
use App\Modules\Ventas\Notifications\EntregasPendientes;
use App\Modules\Ventas\Notifications\NuevaEntrega;
use App\Support\Importaciones\ImportacionTerminada;
use App\Support\Importaciones\ImportarArchivoJob;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    Carbon::setTestNow('2026-10-23 07:00:00');
    Notification::fake();
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
});

afterEach(fn () => Carbon::setTestNow());

/** A user that turned push notifications on in one device. */
function conNotificaciones(User $usuario): User
{
    $usuario->updatePushSubscription('https://push.example.com/'.$usuario->id, 'clave-publica', 'token');

    return $usuario;
}

test('a device subscribes to push notifications and unsubscribes', function () {
    $this->actingAs($this->owner)
        ->postJson(route('push-suscripciones.store'), [
            'endpoint' => 'https://fcm.googleapis.com/fcm/send/abc',
            'keys' => ['p256dh' => 'clave', 'auth' => 'token'],
            'content_encoding' => 'aes128gcm',
        ])
        ->assertNoContent();

    expect($this->owner->pushSubscriptions()->count())->toBe(1);

    // The same browser with another user logged in now notifies that user.
    $otro = User::factory()->create();
    $this->actingAs($otro)->postJson(route('push-suscripciones.store'), [
        'endpoint' => 'https://fcm.googleapis.com/fcm/send/abc',
        'keys' => ['p256dh' => 'clave', 'auth' => 'token'],
    ])->assertNoContent();

    expect($this->owner->pushSubscriptions()->count())->toBe(0)
        ->and($otro->pushSubscriptions()->count())->toBe(1);

    $this->actingAs($otro)
        ->deleteJson(route('push-suscripciones.destroy'), ['endpoint' => 'https://fcm.googleapis.com/fcm/send/abc'])
        ->assertNoContent();

    expect($otro->pushSubscriptions()->count())->toBe(0);
});

test('a new contra entrega tells who dispatches in that bodega, not who sold it', function () {
    [$norte, $sur] = Bodega::factory()->count(2)->create();
    $despachador = conNotificaciones(User::factory()->create());
    asignarRol($despachador, 'Member');
    $despachador->givePermissionTo('entregas.view');
    $deOtraBodega = conNotificaciones(User::factory()->create());
    asignarRol($deOtraBodega, 'Member');
    $rol = Role::create(['name' => 'Sur']);
    $rol->bodegas()->sync([$sur->id]);
    $deOtraBodega->assignRole($rol);
    $deOtraBodega->givePermissionTo('entregas.view');
    $sinNotificaciones = User::factory()->create();
    asignarRol($sinNotificaciones, 'Owner');
    conNotificaciones($this->owner);

    $this->actingAs($this->owner)->post(route('pos.store'), [
        'cliente_id' => Cliente::factory()->create(['razon_social' => 'Tienda Ana'])->id,
        'fecha' => '2026-10-23 08:00:00',
        'user_id' => $this->owner->id,
        'bodega_id' => $norte->id,
        'tipo_precio' => 'DETAL',
        'tipo_pago' => 'CONTRA_ENTREGA',
        'entrega' => ['direccion' => 'Calle 10 # 5-20', 'ciudad' => 'Cali', 'telefono' => '300'],
        'detalles' => [['producto_id' => Producto::factory()->create()->id, 'cantidad' => 1, 'precio_unitario' => 50000]],
    ])->assertSessionHasNoErrors();

    Notification::assertSentTo($despachador, NuevaEntrega::class, function (NuevaEntrega $aviso) use ($despachador) {
        $mensaje = $aviso->toWebPush($despachador, $aviso)->toArray();

        return $mensaje['title'] === 'Nueva entrega por despachar'
            && str_contains($mensaje['body'], 'Tienda Ana')
            && str_contains($mensaje['body'], 'Calle 10 # 5-20, Cali')
            && str_contains($mensaje['body'], 'Cobrar $50.000')
            && $mensaje['data']['url'] === '/entregas';
    });
    Notification::assertNotSentTo([$this->owner, $deOtraBodega, $sinNotificaciones], NuevaEntrega::class);
});

test('every morning whoever handles deliveries gets what is pending', function () {
    $despachador = conNotificaciones(User::factory()->create());
    asignarRol($despachador, 'Member');
    $despachador->givePermissionTo('entregas.view');
    $sinPermiso = conNotificaciones(User::factory()->create());
    asignarRol($sinPermiso, 'Member');

    Entrega::factory()->count(2)->create();
    Entrega::factory()->create(['estado' => Entrega::EN_CAMINO, 'fecha_programada' => '2026-10-20']);
    Entrega::factory()->create(['estado' => Entrega::DEVUELTO]);
    Entrega::factory()->create(['estado' => Entrega::ENTREGADO]);

    $this->artisan('entregas:avisar-pendientes')->assertSuccessful();

    Notification::assertSentTo($despachador, EntregasPendientes::class, function (EntregasPendientes $aviso) use ($despachador) {
        $mensaje = $aviso->toWebPush($despachador, $aviso)->toArray();

        return $mensaje['title'] === '4 entregas pendientes'
            && str_contains($mensaje['body'], '2 por despachar · 1 en camino · 1 devueltas sin resolver')
            && str_contains($mensaje['body'], '1 ya pasaron su fecha de entrega');
    });
    Notification::assertNotSentTo($sinPermiso, EntregasPendientes::class);
});

test('nobody is bothered when there are no pending deliveries', function () {
    $despachador = conNotificaciones(User::factory()->create());
    asignarRol($despachador, 'Owner');
    Entrega::factory()->create(['estado' => Entrega::ENTREGADO]);

    $this->artisan('entregas:avisar-pendientes')->assertSuccessful();

    Notification::assertNothingSent();
});

test('every morning whoever sees the compras gets the ones overdue or due soon', function () {
    $comprador = conNotificaciones(User::factory()->create());
    asignarRol($comprador, 'Member');
    $comprador->givePermissionTo('compras.view');

    Compra::factory()->create(['saldo_pendiente' => 200000, 'fecha_vencimiento' => '2026-10-20']);
    Compra::factory()->create(['saldo_pendiente' => 50000, 'fecha_vencimiento' => '2026-10-25']);
    Compra::factory()->create(['saldo_pendiente' => 90000, 'fecha_vencimiento' => '2026-12-01']);
    Compra::factory()->create(['saldo_pendiente' => 0, 'fecha_vencimiento' => '2026-10-01']);

    $this->artisan('cuentas-por-pagar:avisar')->assertSuccessful();

    Notification::assertSentTo($comprador, CuentasPorPagarPorVencer::class, function (CuentasPorPagarPorVencer $aviso) use ($comprador) {
        $mensaje = $aviso->toWebPush($comprador, $aviso)->toArray();

        return $mensaje['title'] === 'Cuentas por pagar vencidas'
            && str_contains($mensaje['body'], '1 compra vencida: $200.000')
            && str_contains($mensaje['body'], '1 compra vence en los próximos 7 días: $50.000')
            && $mensaje['data']['url'] === '/compras/cuentas-por-pagar';
    });
});

test('no cuentas por pagar notification when everything is paid or far from due', function () {
    conNotificaciones($this->owner);
    Compra::factory()->create(['saldo_pendiente' => 90000, 'fecha_vencimiento' => '2026-12-01']);

    $this->artisan('cuentas-por-pagar:avisar')->assertSuccessful();

    Notification::assertNothingSent();
});

test('a contra entrega with who takes it tells only them', function () {
    $mensajero = conNotificaciones(User::factory()->create(['name' => 'Luis']));
    asignarRol($mensajero, 'Member');
    $mensajero->givePermissionTo('entregas.view');
    $otroDespachador = conNotificaciones(User::factory()->create());
    asignarRol($otroDespachador, 'Owner');

    $this->actingAs($this->owner)->post(route('pos.store'), [
        'cliente_id' => Cliente::factory()->create()->id,
        'fecha' => '2026-10-23 08:00:00',
        'user_id' => $this->owner->id,
        'bodega_id' => Bodega::factory()->create()->id,
        'tipo_precio' => 'DETAL',
        'tipo_pago' => 'CONTRA_ENTREGA',
        'entrega' => ['direccion' => 'Calle 1', 'telefono' => '300', 'mensajero_id' => $mensajero->id],
        'detalles' => [['producto_id' => Producto::factory()->create()->id, 'cantidad' => 1, 'precio_unitario' => 100]],
    ])->assertSessionHasNoErrors();

    expect(Entrega::sole()->mensajero_id)->toBe($mensajero->id);

    Notification::assertSentTo($mensajero, EntregaAsignada::class, fn (EntregaAsignada $aviso) => $aviso->toWebPush($mensajero, $aviso)->toArray()['title'] === 'Te asignaron una entrega');
    Notification::assertNotSentTo($otroDespachador, NuevaEntrega::class);
});

test('dispatching to someone tells them, also when it is to themselves', function () {
    $mensajero = conNotificaciones(User::factory()->create());
    conNotificaciones($this->owner);
    $entrega = Entrega::factory()->create();

    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $entrega), ['estado' => Entrega::EN_CAMINO, 'mensajero_id' => $mensajero->id])
        ->assertSessionHasNoErrors();

    Notification::assertSentTo($mensajero, EntregaAsignada::class);

    $otra = Entrega::factory()->create();
    $this->actingAs($this->owner)
        ->patch(route('entregas.update', $otra), ['estado' => Entrega::EN_CAMINO, 'mensajero_id' => $this->owner->id])
        ->assertSessionHasNoErrors();

    Notification::assertSentTo($this->owner, EntregaAsignada::class);
});

test('the notifications show the company logo, or the app icon without one', function () {
    $entrega = Entrega::factory()->create();
    $aviso = new NuevaEntrega($entrega);

    expect($aviso->toWebPush($this->owner, $aviso)->toArray()['icon'])->toBe('/apple-touch-icon.png');

    Empresa::factory()->create(['logo_empresa' => 'logos/empresa.png']);
    app()->forgetScopedInstances();

    expect($aviso->toWebPush($this->owner, $aviso)->toArray()['icon'])->toBe('/storage/logos/empresa.png');
});

test('whoever starts an import is told when it finishes, with what it did', function () {
    Storage::fake('local');
    conNotificaciones($this->owner);

    $csv = "sku,referencia,valor_detal\nA-1,Llanta,1000\nA-2,Rin,2000\n";

    $this->actingAs($this->owner)->post(route('importaciones.store'), [
        'tipo' => 'productos',
        'archivo' => UploadedFile::fake()->createWithContent('productos.csv', $csv),
    ])->assertSessionHasNoErrors();

    Notification::assertSentTo($this->owner, ImportacionTerminada::class, function (ImportacionTerminada $aviso) {
        $mensaje = $aviso->toWebPush($this->owner, $aviso)->toArray();

        return $mensaje['title'] === 'Importación de Productos completada'
            && $mensaje['body'] === "productos.csv\n2 creados · 0 actualizados"
            && $mensaje['data']['url'] === '/dashboard?importaciones=1';
    });
});

test('a failed import tells why', function () {
    conNotificaciones($this->owner);
    $importacion = Importacion::create([
        'user_id' => $this->owner->id,
        'tipo' => 'productos',
        'archivo' => 'importaciones/no-existe.csv',
        'nombre_original' => 'productos.csv',
        'estado' => Importacion::PROCESANDO,
    ]);

    (new ImportarArchivoJob($importacion->id))->failed(new RuntimeException('El archivo está dañado.'));

    expect($importacion->fresh()->estado)->toBe(Importacion::FALLIDA);
    Notification::assertSentTo($this->owner, ImportacionTerminada::class, function (ImportacionTerminada $aviso) {
        $mensaje = $aviso->toWebPush($this->owner, $aviso)->toArray();

        return $mensaje['title'] === 'Falló la importación de Productos'
            && $mensaje['body'] === "productos.csv\nEl archivo está dañado.";
    });
});

test('no import notification for whoever did not turn notifications on', function () {
    Storage::fake('local');

    $this->actingAs($this->owner)->post(route('importaciones.store'), [
        'tipo' => 'productos',
        'archivo' => UploadedFile::fake()->createWithContent('productos.csv', "sku,referencia\nA-1,Llanta\n"),
    ])->assertSessionHasNoErrors();

    Notification::assertNothingSent();
});
