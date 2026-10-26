<?php

use App\Models\User;
use App\Modules\Administracion\Models\Empresa;
use App\Modules\Catalogo\Jobs\GenerarCatalogoPdfJob;
use App\Modules\Catalogo\Models\CatalogoPdf;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Notifications\CatalogoTerminado;
use App\Modules\Catalogo\Services\GeneradorCatalogo;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockBodega;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    $this->llantas = Categoria::factory()->create(['nombre_categoria' => 'Llantas']);
    $this->conStock = Producto::factory()->create(['categoria_id' => $this->llantas->id, 'referencia_producto' => '155R13', 'marca' => 'WANDA', 'valor_detal' => 150000, 'valor_mayorista' => 120000]);
    $this->agotado = Producto::factory()->create(['categoria_id' => $this->llantas->id, 'referencia_producto' => 'AGOTADA', 'inventariable' => true]);
    StockBodega::create(['producto_id' => $this->conStock->id, 'bodega_id' => Bodega::factory()->create()->id, 'stock' => 4]);
});

test('asking for a catalog queues it with the chosen options', function () {
    Queue::fake();

    $this->actingAs($this->owner)
        ->postJson(route('catalogo-pdf.store'), [
            'categoria_ids' => [$this->llantas->id],
            'solo_con_stock' => true,
            'precio' => 'mayorista',
            'columnas' => 4,
            'portada' => false,
            'titulo' => 'Lista de precios',
        ])
        ->assertCreated()
        ->assertJsonPath('catalogo.estado', CatalogoPdf::PENDIENTE)
        ->assertJsonPath('catalogo.titulo', 'Lista de precios');

    $catalogo = CatalogoPdf::sole();
    expect($catalogo->opciones)->toMatchArray(['precio' => 'mayorista', 'columnas' => 4, 'portada' => false, 'solo_con_stock' => true]);
    Queue::assertPushed(GenerarCatalogoPdfJob::class, fn ($job) => $job->catalogoId === $catalogo->id);
});

test('the catalog shows the productos asked for, with the price chosen', function () {
    $html = app(GeneradorCatalogo::class)->html(['solo_con_stock' => true, 'precio' => 'mayorista']);

    expect($html)->toContain('155R13 WANDA')
        ->toContain('$120.000')
        ->not->toContain('AGOTADA')
        ->toContain('<h2>Llantas</h2>');

    $sinPrecio = app(GeneradorCatalogo::class)->html(['precio' => 'ninguno']);

    expect($sinPrecio)->toContain('AGOTADA')->not->toContain('$150.000');
});

test('the generated catalog is stored, its owner is told and only they download it', function () {
    Storage::fake('local');
    Notification::fake();
    $this->owner->updatePushSubscription('https://push.example.com/1', 'clave', 'token');

    // Chromium is not run here: the PDF itself is stood in.
    $this->mock(GeneradorCatalogo::class, function ($mock) {
        $mock->shouldReceive('pdf')->andReturn('%PDF-catalogo');
        $mock->shouldReceive('totalProductos')->andReturn(2);
    });

    $catalogo = CatalogoPdf::create(['user_id' => $this->owner->id, 'opciones' => GeneradorCatalogo::normalizar([])]);
    app()->call([new GenerarCatalogoPdfJob($catalogo->id), 'handle']);

    expect($catalogo->fresh())
        ->estado->toBe(CatalogoPdf::COMPLETADO)
        ->total_productos->toBe(2);
    Storage::disk('local')->assertExists("catalogos/{$catalogo->id}.pdf");
    Notification::assertSentTo($this->owner, CatalogoTerminado::class);

    $this->actingAs($this->owner)->get(route('catalogo-pdf.descargar', $catalogo))
        ->assertOk()
        ->assertHeader('content-type', 'application/pdf');

    $otro = User::factory()->create();
    asignarRol($otro, 'Owner');
    $this->actingAs($otro)->get(route('catalogo-pdf.descargar', $catalogo))->assertNotFound();
});

test('a catalog that fails says so', function () {
    $catalogo = CatalogoPdf::create(['user_id' => $this->owner->id, 'opciones' => GeneradorCatalogo::normalizar([])]);

    (new GenerarCatalogoPdfJob($catalogo->id))->failed(new RuntimeException('Chromium no está instalado'));

    expect($catalogo->fresh())
        ->estado->toBe(CatalogoPdf::FALLIDO)
        ->error->toBe('Chromium no está instalado');

    $this->actingAs($this->owner)->get(route('catalogo-pdf.descargar', $catalogo))->assertNotFound();
});

test('only who may export productos makes catalogs, with the prices they may see', function () {
    Queue::fake();
    $miembro = User::factory()->create(['tipos_precio_permitidos' => ['valor_detal']]);
    asignarRol($miembro, 'Member');

    $this->actingAs($miembro)->getJson(route('catalogo-pdf.index'))->assertForbidden();

    $miembro->givePermissionTo('productos.export');

    $this->actingAs($miembro)->getJson(route('catalogo-pdf.index'))
        ->assertOk()
        ->assertJsonPath('precios', ['detal', 'ninguno']);

    $this->actingAs($miembro)
        ->postJson(route('catalogo-pdf.store'), ['precio' => 'mayorista', 'columnas' => 3])
        ->assertJsonValidationErrors(['precio' => 'No puedes mostrar ese precio en el catálogo.']);

    Queue::assertNothingPushed();
});

test('each categoría lays its productos out so its rows are full', function (int $total, int $columnas, array $esperada) {
    expect(GeneradorCatalogo::disposicion($total, $columnas))->toBe($esperada);
})->with([
    'one lies wide' => [1, 4, ['modo' => 'horizontal', 'columnas' => 1]],
    'two lie wide, side by side' => [2, 4, ['modo' => 'horizontal', 'columnas' => 2]],
    'a few share one row' => [3, 4, ['modo' => 'vertical', 'columnas' => 3]],
    'five fit one row of small cards' => [5, 4, ['modo' => 'vertical', 'columnas' => 5]],
    'fourteen go five a row (one gap)' => [14, 4, ['modo' => 'vertical', 'columnas' => 5]],
    'twelve keep the size asked for' => [12, 3, ['modo' => 'vertical', 'columnas' => 3]],
    'without a better fit, the size asked for' => [41, 4, ['modo' => 'vertical', 'columnas' => 4]],
]);

test('the catalog is drawn with the company brand', function () {
    Empresa::factory()->create([
        'color_primario' => '#123456',
        'color_acento' => '#fde047',
        'eslogan_empresa' => 'Todo para tu moto',
        'redes_sociales' => [['red' => 'whatsapp', 'valor' => '300 111 2222'], ['red' => 'instagram', 'valor' => '@motos.co']],
        'colaboracion_empresa' => 'Black Purple',
    ]);

    $html = app(GeneradorCatalogo::class)->html(['precio' => 'detal'], web: true);

    expect($html)->toContain('--primario: #123456')
        ->toContain('--acento: #fde047')
        // A light accent takes dark text.
        ->toContain('--sobre-acento: #0f172a')
        ->toContain('Todo para tu moto')
        ->toContain('300 111 2222')
        ->toContain('@motos.co')
        // Each with its icon, in the brand's accent.
        ->toContain('fill="#fde047"')
        ->toContain('Black Purple');
});

test('without a brand of its own the catalog uses the default colors', function () {
    $html = app(GeneradorCatalogo::class)->html([]);

    expect($html)->toContain('--primario: '.Empresa::COLOR_PRIMARIO)
        ->toContain('--acento: '.Empresa::COLOR_ACENTO);
});
