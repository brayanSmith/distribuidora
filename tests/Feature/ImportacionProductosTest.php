<?php

use App\Models\User;
use App\Modules\Catalogo\Jobs\ImportarProductosJob;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\Importacion;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Models\SubCategoria;
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
        ->post(route('importaciones.store'), ['archivo' => csvProductos($csv)])
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

    $this->actingAs($this->owner)->post(route('importaciones.store'), ['archivo' => csvProductos($csv)]);

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

    $this->actingAs($this->owner)->post(route('importaciones.store'), ['archivo' => csvProductos($csv)]);

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
        ->post(route('importaciones.store'), ['archivo' => csvProductos("sku,referencia\nA-1,X\n")])
        ->assertRedirect();

    Queue::assertPushed(ImportarProductosJob::class);
    expect(Importacion::firstOrFail()->estado)->toBe(Importacion::PENDIENTE)
        ->and(Producto::count())->toBe(0);
});

test('only csv, txt and xlsx files are accepted', function () {
    $this->actingAs($this->owner)
        ->post(route('importaciones.store'), ['archivo' => UploadedFile::fake()->create('productos.pdf', 10)])
        ->assertSessionHasErrors('archivo');
});

test('members without permission cannot import or export productos', function () {
    $member = User::factory()->create();
    asignarRol($member, 'Member');

    $this->actingAs($member)->get(route('importaciones.plantilla'))->assertForbidden();
    $this->actingAs($member)->post(route('importaciones.store'), ['archivo' => csvProductos("sku\nA\n")])->assertForbidden();
    $this->actingAs($member)->get(route('productos.exportar', ['formato' => 'csv']))->assertForbidden();
});

test('every page offers the import from the header and lists the imports only when asked, while the export stays on productos', function () {
    Importacion::factory()->create(['user_id' => $this->owner->id, 'estado' => Importacion::PROCESANDO, 'total_filas' => 10, 'procesadas' => 4]);

    $this->actingAs($this->owner)->get(route('productos.index'))
        ->assertInertia(fn ($page) => $page
            ->where('canImportProductos', true)
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
