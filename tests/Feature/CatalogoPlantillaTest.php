<?php

use App\Models\User;
use App\Modules\Administracion\Models\Empresa;
use App\Modules\Catalogo\Models\CatalogoPdf;
use App\Modules\Catalogo\Models\CatalogoPlantilla;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Models\SubCategoria;
use App\Modules\Catalogo\Services\DisenoCatalogo;
use App\Modules\Catalogo\Services\GeneradorCatalogo;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\StockBodega;
use Illuminate\Support\Facades\Queue;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    $this->llantas = Categoria::factory()->create(['nombre_categoria' => 'Llantas']);
    $this->aceites = Categoria::factory()->create(['nombre_categoria' => 'Aceites']);
    $this->barata = Producto::factory()->create(['categoria_id' => $this->llantas->id, 'referencia_producto' => 'BARATA', 'marca' => null, 'valor_detal' => 1000, 'inventariable' => true]);
    $this->cara = Producto::factory()->create(['categoria_id' => $this->llantas->id, 'referencia_producto' => 'CARA', 'marca' => null, 'valor_detal' => 9000, 'inventariable' => true]);
    Producto::factory()->create(['categoria_id' => $this->aceites->id, 'referencia_producto' => 'ACEITE 20W50', 'marca' => null]);
    StockBodega::create(['producto_id' => $this->cara->id, 'bodega_id' => Bodega::factory()->create()->id, 'stock' => 3]);
});

/**
 * @param  array<string, mixed>  $cambios
 * @return array<string, mixed>
 */
function bloque(string $tipo, array $cambios = []): array
{
    return ['id' => uniqid(), 'tipo' => $tipo, 'visible' => true, ...$cambios];
}

test('a design is saved with its blocks, completed with their defaults', function () {
    $this->actingAs($this->owner)
        ->post(route('catalogo-plantillas.store'), [
            'nombre' => 'Mayoristas',
            'columnas' => 3,
            'encabezado' => true,
            'pie' => false,
            'bloques' => [
                bloque('texto', ['texto' => 'Lista 2026']),
                bloque('categoria', ['categoria_id' => $this->llantas->id, 'tamano' => '2']),
                bloque('salto'),
            ],
        ])
        ->assertSessionHasNoErrors();

    $plantilla = CatalogoPlantilla::sole();

    expect($plantilla)
        ->nombre->toBe('Mayoristas')
        ->columnas->toBe(3)
        ->pie->toBeFalse()
        ->and(collect($plantilla->bloques)->pluck('tipo')->all())->toBe(['texto', 'categoria', 'salto'])
        ->and($plantilla->bloques[1])->toMatchArray(['tamano' => '2', 'orden' => 'nombre', 'solo_con_stock' => false]);

    $this->actingAs($this->owner)->get(route('catalogo-plantillas.edit', $plantilla))
        ->assertInertia(fn ($page) => $page
            ->component('catalogo-plantillas/editar')
            ->where('plantilla.nombre', 'Mayoristas')
            ->has('categorias', 2)
        );
});

test('a categoría block needs its categoría and only who exports productos designs', function () {
    $this->actingAs($this->owner)
        ->post(route('catalogo-plantillas.store'), [
            'nombre' => 'Incompleta',
            'columnas' => 4,
            'encabezado' => true,
            'pie' => true,
            'bloques' => [bloque('categoria'), bloque('desconocido')],
        ])
        ->assertSessionHasErrors(['bloques.0.categoria_id', 'bloques.1.tipo']);

    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');

    $this->actingAs($miembro)->get(route('catalogo-plantillas.create'))->assertForbidden();
    expect(CatalogoPlantilla::count())->toBe(0);
});

test('the catalog follows the blocks: their order, titles, texts and what each shows', function () {
    $html = app(GeneradorCatalogo::class)->html([
        'precio' => 'detal',
        'bloques' => [
            bloque('categoria', ['categoria_id' => $this->aceites->id, 'titulo' => 'Lubricantes']),
            bloque('texto', ['titulo' => 'Formas de pago', 'texto' => 'Nequi y efectivo']),
            bloque('salto'),
            bloque('categoria', ['categoria_id' => $this->llantas->id, 'orden' => 'precio_desc']),
            bloque('categoria', ['categoria_id' => $this->llantas->id, 'titulo' => 'Llantas disponibles', 'solo_con_stock' => true]),
            bloque('texto', ['visible' => false, 'texto' => 'Texto oculto']),
        ],
    ]);

    expect($html)
        ->toContain('<h2>Lubricantes</h2>')
        ->toContain('Formas de pago')
        ->toContain('Nequi y efectivo')
        ->toContain('class="salto"')
        ->not->toContain('Texto oculto')
        ->and(strpos($html, 'Lubricantes'))->toBeLessThan(strpos($html, 'Formas de pago'))
        // Most expensive first.
        ->and(strpos($html, 'CARA'))->toBeLessThan(strpos($html, 'BARATA'));

    $disponibles = substr($html, strpos($html, '<h2>Llantas disponibles</h2>'));

    expect($disponibles)->toContain('CARA')->not->toContain('BARATA');
});

test('a catalog generated with a design keeps a copy of it', function () {
    Queue::fake();
    $plantilla = CatalogoPlantilla::factory()->create([
        'nombre' => 'Promos',
        'columnas' => 2,
        'bloques' => [bloque('categoria', ['categoria_id' => $this->aceites->id])],
    ]);

    $this->actingAs($this->owner)
        ->postJson(route('catalogo-pdf.store'), ['precio' => 'detal', 'columnas' => 4, 'plantilla_id' => $plantilla->id])
        ->assertCreated()
        ->assertJsonPath('catalogo.plantilla', 'Promos');

    $plantilla->update(['bloques' => []]);

    $opciones = CatalogoPdf::sole()->opciones;

    expect($opciones['columnas'])->toBe(2)
        ->and($opciones['bloques'][0]['categoria_id'])->toBe($this->aceites->id)
        ->and(app(GeneradorCatalogo::class)->totalProductos($opciones))->toBe(1);
});

test('the designer previews the blocks with real productos', function () {
    $this->actingAs($this->owner)
        ->post(route('catalogo-plantillas.vista-previa'), [
            'nombre' => 'Borrador',
            'columnas' => 4,
            'encabezado' => false,
            'pie' => false,
            'precio' => 'detal',
            'bloques' => [bloque('categoria', ['categoria_id' => $this->llantas->id])],
        ])
        ->assertOk()
        ->assertSee('<h2>Llantas</h2>', false)
        ->assertSee('$9.000')
        ->assertDontSee('ACEITE 20W50');
});

test('a categoría shows its productos by subcategoría, those without one last', function () {
    $rin13 = SubCategoria::factory()->create(['categoria_id' => $this->llantas->id, 'nombre_sub_categoria' => 'Rin 13']);
    $rin12 = SubCategoria::factory()->create(['categoria_id' => $this->llantas->id, 'nombre_sub_categoria' => 'Rin 12']);
    $this->cara->update(['sub_categoria_id' => $rin13->id]);
    Producto::factory()->create(['categoria_id' => $this->llantas->id, 'sub_categoria_id' => $rin12->id, 'referencia_producto' => 'PEQUENA', 'marca' => null]);

    $html = app(GeneradorCatalogo::class)->html(['categoria_ids' => [$this->llantas->id]]);

    expect($html)->toContain('<h3 class="subcategoria">Rin 12</h3>')->toContain('<h3 class="subcategoria">Otros</h3>')
        ->and(strpos($html, 'Rin 12'))->toBeLessThan(strpos($html, 'Rin 13'))
        ->and(strpos($html, 'Rin 13'))->toBeLessThan(strpos($html, '<h3 class="subcategoria">Otros</h3>'))
        ->and(strpos($html, 'PEQUENA'))->toBeLessThan(strpos($html, 'CARA'))
        // BARATA has no subcategoría.
        ->and(strpos($html, '<h3 class="subcategoria">Otros</h3>'))->toBeLessThan(strpos($html, 'BARATA'));

    $sinDividir = app(GeneradorCatalogo::class)->html([
        'bloques' => [bloque('categoria', ['categoria_id' => $this->llantas->id, 'subcategorias' => false])],
    ]);

    expect($sinDividir)->toContain('CARA')->not->toContain('<h3 class="subcategoria">Rin 13</h3>');

    // A categoría without subcategorías keeps a single grid.
    expect(app(GeneradorCatalogo::class)->html(['categoria_ids' => [$this->aceites->id]]))->not->toContain('class="subcategoria"');
});

test('a design says what its page header and footer show', function () {
    Empresa::factory()->create([
        'eslogan_empresa' => 'Eslogan de la empresa',
        'descripcion_empresa' => 'Descripción de la empresa',
        'colaboracion_empresa' => 'Wanda',
        'redes_sociales' => [['red' => 'whatsapp', 'valor' => '300 111 2222'], ['red' => 'tiktok', 'valor' => '@motos']],
    ]);

    // Nothing said: the company's own.
    expect(app(GeneradorCatalogo::class)->html([], web: true))
        ->toContain('Eslogan de la empresa')
        ->toContain('Descripción de la empresa')
        ->toContain('En colaboración de')
        ->toContain('@motos');

    $this->actingAs($this->owner)
        ->post(route('catalogo-plantillas.store'), [
            'nombre' => 'Promos',
            'columnas' => 4,
            'encabezado' => true,
            'pie' => true,
            'bloques' => [bloque('categoria', ['categoria_id' => $this->aceites->id])],
            'ajustes' => [
                'encabezado_titulo' => 'Ofertas de diciembre',
                'encabezado_mostrar_subtitulo' => false,
                'pie_ocultar_redes' => ['tiktok|@motos'],
                'pie_texto' => 'Precios válidos hasta agotar existencias',
                'pie_paginas' => false,
            ],
        ])
        ->assertSessionHasNoErrors();

    $plantilla = CatalogoPlantilla::sole();
    $html = app(GeneradorCatalogo::class)->html($plantilla->opciones(), web: true);

    expect($html)
        ->toContain('Ofertas de diciembre')
        ->not->toContain('Eslogan de la empresa')
        ->not->toContain('Descripción de la empresa')
        ->toContain('Precios válidos hasta agotar existencias')
        ->not->toContain('En colaboración de')
        ->toContain('300 111 2222')
        ->not->toContain('@motos');

    $this->actingAs($this->owner)->get(route('catalogo-plantillas.edit', $plantilla))
        ->assertInertia(fn ($page) => $page
            ->where('plantilla.ajustes.encabezado_titulo', 'Ofertas de diciembre')
            ->where('plantilla.ajustes.encabezado_logo', true)
            ->where('empresa.redes.1.id', 'tiktok|@motos')
            ->has('redesDisponibles')
        );
});

test('the catalog opens with a band of its figures and numbers its categorías', function () {
    $html = app(GeneradorCatalogo::class)->html(['titulo' => 'Lista de precios', 'precio' => 'detal']);

    expect($html)
        ->toContain('class="presentacion"')
        ->toContain('Lista de precios')
        ->toContain('Precios al detal')
        // Aceites first, then Llantas: by name.
        ->toContain('<span class="categoria__numero">01</span>')
        ->toContain('<span class="categoria__numero">02</span>')
        ->and(strpos($html, '<h2>Aceites</h2>'))->toBeLessThan(strpos($html, '<h2>Llantas</h2>'));

    $sinPresentacion = app(GeneradorCatalogo::class)->html(['ajustes' => ['presentacion' => false]]);

    expect($sinPresentacion)->not->toContain('class="presentacion"');

    // A cover saved before covers were removed is left out.
    $bloques = DisenoCatalogo::normalizar([bloque('portada'), bloque('salto')]);

    expect(array_column($bloques, 'tipo'))->toBe(['salto']);
});
