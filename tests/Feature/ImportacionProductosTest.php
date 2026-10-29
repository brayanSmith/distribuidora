<?php

use App\Models\User;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\Importacion;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Models\SubCategoria;
use App\Modules\Finanzas\Models\Puc;
use App\Support\Importaciones\ImportarArchivoJob;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

function csvProductos(string $contenido, string $nombre = 'productos.csv'): UploadedFile
{
    return UploadedFile::fake()->createWithContent($nombre, $contenido);
}

beforeEach(function () {
    Storage::fake('local');
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
});

test('the import creates productos, categorias and subcategorias that do not exist yet', function () {
    $existente = Categoria::factory()->create(['nombre_categoria' => 'Llantas']);

    $csv = <<<'CSV'
sku,marca,referencia,descripcion,categoria,subcategoria,costo,valor_detal,valor_mayorista,inventariable
A-1,WANDA,155R13,Llanta carro,Llantas,Carro,100000,150000,130000,si
A-2,HEVOS,100/80-17,Llanta moto,llantas,Moto,50000,80000,70000,si
A-3,,Instalación,Servicio,Servicios,,0,20000,0,no
CSV;

    $this->actingAs($this->owner)
        ->post(route('importaciones.store'), ['tipo' => 'productos', 'archivo' => csvProductos($csv)])
        ->assertSessionHasNoErrors();

    $importacion = Importacion::firstOrFail();
    expect($importacion->estado)->toBe(Importacion::COMPLETADA)
        ->and($importacion->total_filas)->toBe(3)
        ->and($importacion->creados)->toBe(3)
        ->and($importacion->con_error)->toBe(0);

    // "llantas" matches the existing categoria whatever its case.
    expect(Categoria::count())->toBe(2)
        ->and(SubCategoria::where('categoria_id', $existente->id)->pluck('nombre_sub_categoria')->sort()->values()->all())->toBe(['Carro', 'Moto']);

    $servicio = Producto::where('sku', 'A-3')->firstOrFail();
    expect($servicio->inventariable)->toBeFalse()
        ->and($servicio->categoria->nombre_categoria)->toBe('Servicios')
        ->and($servicio->subCategoria)->toBeNull()
        ->and(Producto::where('sku', 'A-1')->firstOrFail()->concatenar_codigo_nombre)->toBe('155R13-WANDA-Llanta carro');
});

test('a row with an existing sku updates that producto', function () {
    $producto = Producto::factory()->create(['sku' => 'A-1', 'valor_detal' => 100, 'referencia_producto' => 'VIEJA']);

    $csv = "sku;referencia;valor_detal\nA-1;NUEVA;250,50\n";

    $this->actingAs($this->owner)->post(route('importaciones.store'), ['tipo' => 'productos', 'archivo' => csvProductos($csv)]);

    $importacion = Importacion::firstOrFail();
    expect($importacion->actualizados)->toBe(1)
        ->and($importacion->creados)->toBe(0)
        ->and(Producto::count())->toBe(1)
        ->and($producto->fresh()->referencia_producto)->toBe('NUEVA')
        ->and((float) $producto->fresh()->valor_detal)->toBe(250.5);
});

test('a failing row is reported and the others still import', function () {
    $csv = <<<'CSV'
sku,referencia,valor_detal,subcategoria
OK-1,Buena,100,
,,100,
MAL-1,Precio malo,abc,
MAL-2,Sin categoria,100,Carro
OK-2,Otra buena,200,
CSV;

    $this->actingAs($this->owner)->post(route('importaciones.store'), ['tipo' => 'productos', 'archivo' => csvProductos($csv)]);

    $importacion = Importacion::firstOrFail();
    expect($importacion->estado)->toBe(Importacion::COMPLETADA)
        ->and($importacion->creados)->toBe(2)
        ->and($importacion->con_error)->toBe(3)
        ->and(collect($importacion->errores)->pluck('fila')->all())->toBe([3, 4, 5])
        ->and(Producto::pluck('sku')->sort()->values()->all())->toBe(['OK-1', 'OK-2']);
});

test('the import is queued so the user can keep working', function () {
    Queue::fake();

    $this->actingAs($this->owner)
        ->post(route('importaciones.store'), ['tipo' => 'productos', 'archivo' => csvProductos("sku,referencia\nA-1,X\n")])
        ->assertRedirect();

    Queue::assertPushed(ImportarArchivoJob::class);
    expect(Importacion::firstOrFail()->estado)->toBe(Importacion::PENDIENTE)
        ->and(Producto::count())->toBe(0);
});

test('only csv, txt and xlsx files are accepted', function () {
    $this->actingAs($this->owner)
        ->post(route('importaciones.store'), ['tipo' => 'productos', 'archivo' => UploadedFile::fake()->create('productos.pdf', 10)])
        ->assertSessionHasErrors('archivo');
});

test('members without permission cannot import or export productos', function () {
    $member = User::factory()->create();
    asignarRol($member, 'Member');

    $this->actingAs($member)->get(route('importaciones.plantilla', ['tipo' => 'productos']))->assertForbidden();
    $this->actingAs($member)->post(route('importaciones.store'), ['tipo' => 'productos', 'archivo' => csvProductos("sku\nA\n")])->assertForbidden();
    $this->actingAs($member)->get(route('productos.exportar', ['formato' => 'csv']))->assertForbidden();
});

test('every page offers the import from the header and lists the imports only when asked, while the export stays on productos', function () {
    Importacion::factory()->create(['user_id' => $this->owner->id, 'estado' => Importacion::PROCESANDO, 'total_filas' => 10, 'procesadas' => 4]);

    $this->actingAs($this->owner)->get(route('productos.index'))
        ->assertInertia(fn ($page) => $page
            ->where('tiposImportacion.0.value', 'productos')
            ->where('permissions.canExport', true)
            ->missing('importaciones')
        );

    // The sidebar asks for the list from any page, e.g. the categorias one.
    $this->actingAs($this->owner)->get(route('categorias.index'), ['X-Inertia-Partial-Data' => 'importaciones', 'X-Inertia-Partial-Component' => 'categorias/index'])
        ->assertInertia(fn ($page) => $page
            ->has('importaciones', 1)
            ->where('importaciones.0.procesadas', 4)
        );
});

test('productos can be exported to csv, txt and xlsx with the columns the import reads', function () {
    $categoria = Categoria::factory()->create(['nombre_categoria' => 'Llantas']);
    Producto::factory()->create(['sku' => 'E-1', 'marca' => 'WANDA', 'categoria_id' => $categoria->id, 'valor_detal' => 150000]);

    $csv = $this->actingAs($this->owner)->get(route('productos.exportar', ['formato' => 'csv']))
        ->assertOk()->streamedContent();
    expect($csv)->toContain('sku,marca,referencia')->toContain('E-1,WANDA')->toContain('Llantas');

    $txt = $this->actingAs($this->owner)->get(route('productos.exportar', ['formato' => 'txt']))
        ->assertOk()->streamedContent();
    expect($txt)->toContain("sku\tmarca\treferencia")->toContain("E-1\tWANDA");

    $xlsx = $this->actingAs($this->owner)->get(route('productos.exportar', ['formato' => 'xlsx']))
        ->assertOk()->streamedContent();
    expect(substr($xlsx, 0, 2))->toBe('PK');

    $this->actingAs($this->owner)->get(route('productos.exportar', ['formato' => 'pdf']))
        ->assertSessionHasErrors('formato');
});

test('an exported file can be imported back', function () {
    Producto::factory()->count(3)->create(['categoria_id' => Categoria::factory()->create()->id]);

    $contenido = $this->actingAs($this->owner)->get(route('productos.exportar', ['formato' => 'xlsx']))->streamedContent();

    $this->actingAs($this->owner)->post(route('importaciones.store'), [
        'tipo' => 'productos',
        'archivo' => csvProductos($contenido, 'productos.xlsx'),
    ]);

    $importacion = Importacion::firstOrFail();
    expect($importacion->estado)->toBe(Importacion::COMPLETADA)
        ->and($importacion->actualizados)->toBe(3)
        ->and($importacion->con_error)->toBe(0);
});

test('the user sees their own imports as notifications and how many finished ones are unread', function () {
    $otro = User::factory()->create();
    Importacion::factory()->create(['user_id' => $this->owner->id, 'estado' => Importacion::COMPLETADA]);
    Importacion::factory()->create(['user_id' => $this->owner->id, 'estado' => Importacion::FALLIDA]);
    Importacion::factory()->create(['user_id' => $this->owner->id, 'estado' => Importacion::COMPLETADA, 'leida_at' => now()]);
    Importacion::factory()->create(['user_id' => $this->owner->id, 'estado' => Importacion::PROCESANDO]);
    Importacion::factory()->create(['user_id' => $otro->id, 'estado' => Importacion::COMPLETADA]);

    $this->actingAs($this->owner)->get(route('categorias.index'))
        ->assertInertia(fn ($page) => $page
            ->where('importacionesSinLeer', 2)
            ->where('importacionesEnCurso', 1)
        );

    $this->actingAs($this->owner)->get(route('categorias.index'), ['X-Inertia-Partial-Data' => 'importaciones', 'X-Inertia-Partial-Component' => 'categorias/index'])
        ->assertInertia(fn ($page) => $page->has('importaciones', 4));
});

test('a notification can be marked as read, one by one or all at once, only by its owner', function () {
    $otro = User::factory()->create();
    asignarRol($otro, 'Owner');
    [$una, $dos] = Importacion::factory()->count(2)->create(['user_id' => $this->owner->id, 'estado' => Importacion::COMPLETADA]);
    $ajena = Importacion::factory()->create(['user_id' => $otro->id, 'estado' => Importacion::COMPLETADA]);

    $this->actingAs($this->owner)->patch(route('importaciones.leida', [$ajena]))->assertForbidden();
    expect($ajena->fresh()->leida_at)->toBeNull();

    $this->actingAs($this->owner)->patch(route('importaciones.leida', [$una]))->assertRedirect();
    expect($una->fresh()->leida_at)->not->toBeNull()
        ->and($dos->fresh()->leida_at)->toBeNull();

    $this->actingAs($this->owner)->patch(route('importaciones.leidas'))->assertRedirect();
    expect($dos->fresh()->leida_at)->not->toBeNull()
        ->and($ajena->fresh()->leida_at)->toBeNull();
});

test('medios de pago are imported from the same dialog, matched by their subcuenta', function () {
    Puc::factory()->create(['tipo' => '1', 'cuenta' => '1105', 'subcuenta' => '110505', 'concepto' => 'Caja vieja']);

    $csv = "tipo;cuenta;subcuenta;concepto;descripcion\n"
        ."1;1105;110505;Caja general;Efectivo\n"
        ."1;1110;111005;Bancolombia;Cuenta de ahorros\n"
        ."10;1110;111010;Mal tipo;\n";

    $this->actingAs($this->owner)
        ->post(route('importaciones.store'), ['tipo' => 'pucs', 'archivo' => csvProductos($csv, 'pucs.csv')])
        ->assertSessionHasNoErrors();

    $importacion = Importacion::firstOrFail();
    expect($importacion->tipo)->toBe('pucs')
        ->and($importacion->creados)->toBe(1)
        ->and($importacion->actualizados)->toBe(1)
        ->and($importacion->con_error)->toBe(1)
        ->and($importacion->errores[0]['fila'])->toBe(4)
        ->and(Puc::where('subcuenta', '110505')->value('concepto'))->toBe('Caja general')
        ->and(Puc::where('subcuenta', '111005')->value('concatenar_subcuenta_concepto'))->toBe('111005 - Bancolombia');
});

test('each import type needs its own permission, also for its template', function () {
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $miembro->givePermissionTo('productos.import');

    $this->actingAs($miembro)->get(route('importaciones.plantilla', ['tipo' => 'productos']))->assertOk();
    $this->actingAs($miembro)->get(route('importaciones.plantilla', ['tipo' => 'pucs']))->assertForbidden();
    $this->actingAs($miembro)
        ->post(route('importaciones.store'), ['tipo' => 'pucs', 'archivo' => csvProductos("tipo\n1\n", 'pucs.csv')])
        ->assertForbidden();

    $this->actingAs($miembro)->get(route('profile.edit'))
        ->assertInertia(fn ($page) => $page
            ->has('tiposImportacion', 1)
            ->where('tiposImportacion.0.value', 'productos')
        );
});

test('the template of each type has its own columns', function () {
    $contenido = $this->actingAs($this->owner)->get(route('importaciones.plantilla', ['tipo' => 'pucs']))->streamedContent();

    expect($contenido)->toContain('tipo,cuenta,subcuenta,concepto,descripcion');
});

test('the preview reads the headers of the file and suggests the column of each one', function () {
    $csv = "Codigo;Nombre comercial;sku;Precio\nA-1;Llanta;SKU-1;150000\n";

    $previa = $this->actingAs($this->owner)
        ->post(route('importaciones.previa'), ['tipo' => 'productos', 'archivo' => csvProductos($csv)])
        ->assertOk()
        ->json();

    expect($previa['archivo_temporal'])->toMatch('/^[A-Za-z0-9]{40}\.csv$/')
        ->and(collect($previa['encabezados'])->pluck('nombre')->all())->toBe(['Codigo', 'Nombre comercial', 'sku', 'Precio'])
        ->and($previa['sugerido']['sku'])->toBe('sku')
        ->and($previa['sugerido']['referencia'])->toBeNull()
        ->and($previa['muestra'][0]['codigo'])->toBe('A-1');
    Storage::disk('local')->assertExists('importaciones/previas/'.$this->owner->id.'/'.$previa['archivo_temporal']);
});

test('a file with other column names and order is imported with the columns the user related', function () {
    $csv = "Precio venta;Nombre comercial;Codigo interno\n150000;Llanta 155;A-1\n";

    $previa = $this->actingAs($this->owner)
        ->post(route('importaciones.previa'), ['tipo' => 'productos', 'archivo' => csvProductos($csv)])
        ->json();

    $this->actingAs($this->owner)->post(route('importaciones.store'), [
        'tipo' => 'productos',
        'archivo_temporal' => $previa['archivo_temporal'],
        'nombre_original' => 'inventario.csv',
        'mapeo' => ['sku' => 'codigo_interno', 'referencia' => 'nombre_comercial', 'valor_detal' => 'precio_venta', 'marca' => ''],
    ])->assertSessionHasNoErrors();

    $importacion = Importacion::firstOrFail();
    $producto = Producto::where('sku', 'A-1')->firstOrFail();

    expect($importacion->nombre_original)->toBe('inventario.csv')
        ->and($importacion->creados)->toBe(1)
        ->and($producto->referencia_producto)->toBe('Llanta 155')
        ->and((float) $producto->valor_detal)->toBe(150000.0)
        ->and($producto->marca)->toBeNull();
});

test('a previewed file can only be imported by the user who uploaded it', function () {
    $previa = $this->actingAs($this->owner)
        ->post(route('importaciones.previa'), ['tipo' => 'productos', 'archivo' => csvProductos("sku\nA-1\n")])
        ->json();

    $otro = User::factory()->create();
    asignarRol($otro, 'Owner');

    $this->actingAs($otro)->post(route('importaciones.store'), [
        'tipo' => 'productos',
        'archivo_temporal' => $previa['archivo_temporal'],
    ])->assertStatus(422);

    expect(Importacion::count())->toBe(0);
});

/**
 * Previews a productos file and attaches the given images to it, as the dialog does.
 *
 * @param  list<string>  $imagenes
 * @return array<string, mixed>
 */
function previaConImagenes(User $user, string $csv, array $imagenes): array
{
    $previa = test()->actingAs($user)
        ->post(route('importaciones.previa'), ['tipo' => 'productos', 'archivo' => csvProductos($csv)])
        ->json();

    foreach ($imagenes as $nombre) {
        test()->actingAs($user)->post(route('importaciones.imagenes'), [
            'tipo' => 'productos',
            'archivo_temporal' => $previa['archivo_temporal'],
            'imagen' => UploadedFile::fake()->image($nombre),
        ], ['Accept' => 'application/json'])->assertOk()->assertJson(['nombre' => $nombre]);
    }

    return $previa;
}

test('the template has a column for the attached images', function () {
    $contenido = $this->actingAs($this->owner)->get(route('importaciones.plantilla', ['tipo' => 'productos']))->streamedContent();

    expect($contenido)->toContain('inventariable,imagen_adjunta')->toContain('SKU-001.jpg, SKU-001-lateral.jpg');
});

test('the images uploaded with a file are matched by the names its rows write, several separated by commas', function () {
    Storage::fake('public');
    $existente = Producto::factory()->create(['sku' => 'A-2']);
    $vieja = $existente->imagenes()->create(['imagen_producto' => UploadedFile::fake()->image('vieja.jpg')->store('productos', 'public'), 'orden' => 1]);

    $csv = "sku,referencia,imagen_adjunta\nA-1,Llanta,\"a1-frente.JPG, a1-lado.png\"\nA-2,Rin,comun.jpg\nA-3,Tapa,COMUN.jpg\nA-4,Sin foto,\n";
    $previa = previaConImagenes($this->owner, $csv, ['A1-frente.jpg', 'a1-lado.png', 'comun.jpg']);

    expect($previa['columna_imagenes'])->toBe('imagen_adjunta');

    $this->actingAs($this->owner)->post(route('importaciones.store'), [
        'tipo' => 'productos',
        'archivo_temporal' => $previa['archivo_temporal'],
        'mapeo' => ['sku' => 'sku', 'referencia' => 'referencia', 'imagen_adjunta' => 'imagen_adjunta'],
    ])->assertSessionHasNoErrors();

    $importacion = Importacion::firstOrFail();
    expect($importacion->con_error)->toBe(0)->and($importacion->creados)->toBe(3);

    $a1 = Producto::where('sku', 'A-1')->firstOrFail()->imagenes;
    expect($a1)->toHaveCount(2)->and($a1->pluck('orden')->all())->toBe([1, 2]);
    $a1->each(fn ($imagen) => Storage::disk('public')->assertExists($imagen->imagen_producto));

    // The same image may go to several productos; it replaces what one had.
    expect(Producto::where('sku', 'A-3')->firstOrFail()->imagenes)->toHaveCount(1)
        ->and($existente->imagenes()->count())->toBe(1)
        ->and($existente->imagenes()->first()->is($vieja))->toBeFalse()
        ->and(Producto::where('sku', 'A-4')->firstOrFail()->imagenes)->toHaveCount(0);
    Storage::disk('public')->assertMissing($vieja->imagen_producto);

    // Once imported, the images kept aside are gone.
    Storage::disk('local')->assertMissing($importacion->carpeta_imagenes);
});

test('a row naming an image that was not uploaded fails, and without uploaded images the column is left alone', function () {
    Storage::fake('public');

    $previa = previaConImagenes($this->owner, "sku,imagen_adjunta\nA-1,a1.jpg\nA-2,falta.jpg\n", ['a1.jpg']);

    $this->actingAs($this->owner)->post(route('importaciones.store'), [
        'tipo' => 'productos',
        'archivo_temporal' => $previa['archivo_temporal'],
    ]);

    $importacion = Importacion::firstOrFail();
    expect($importacion->creados)->toBe(1)
        ->and($importacion->con_error)->toBe(1)
        ->and($importacion->errores[0]['mensaje'])->toContain('falta.jpg')
        ->and(Producto::where('sku', 'A-2')->exists())->toBeFalse();

    // A file imported without images (an export, say) keeps the ones the productos have.
    $this->actingAs($this->owner)->post(route('importaciones.store'), [
        'tipo' => 'productos',
        'archivo' => csvProductos("sku,imagen_adjunta\nA-1,otra.jpg\n"),
    ]);

    expect(Importacion::latest('id')->firstOrFail()->con_error)->toBe(0)
        ->and(Producto::where('sku', 'A-1')->firstOrFail()->imagenes)->toHaveCount(1);
});

test('only images are attached, and only to a file the user previewed', function () {
    $previa = previaConImagenes($this->owner, "sku\nA-1\n", []);

    $this->actingAs($this->owner)->post(route('importaciones.imagenes'), [
        'tipo' => 'productos',
        'archivo_temporal' => $previa['archivo_temporal'],
        'imagen' => UploadedFile::fake()->create('lista.pdf', 10, 'application/pdf'),
    ], ['Accept' => 'application/json'])->assertJsonValidationErrors('imagen');

    $otro = User::factory()->create();
    asignarRol($otro, 'Owner');

    $this->actingAs($otro)->post(route('importaciones.imagenes'), [
        'tipo' => 'productos',
        'archivo_temporal' => $previa['archivo_temporal'],
        'imagen' => UploadedFile::fake()->image('a.jpg'),
    ], ['Accept' => 'application/json'])->assertStatus(422);

    $this->actingAs($this->owner)->post(route('importaciones.imagenes'), [
        'tipo' => 'pucs',
        'archivo_temporal' => $previa['archivo_temporal'],
        'imagen' => UploadedFile::fake()->image('a.jpg'),
    ], ['Accept' => 'application/json'])->assertStatus(422);
});
