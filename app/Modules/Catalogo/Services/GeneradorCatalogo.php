<?php

namespace App\Modules\Catalogo\Services;

use App\Modules\Administracion\Models\Empresa;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\Producto;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Storage;
use Spatie\Browsershot\Browsershot;

/**
 * Builds the product catalog: its sections (the blocks of a design, or a
 * cover and every categoría when there is none), filled with the productos
 * the options ask for and laid out with the brand (an HTML page that
 * Chromium turns into a PDF).
 */
class GeneradorCatalogo
{
    /** How long Chromium may take with a big catalog, in seconds. */
    private const TIEMPO_MAXIMO = 600;

    /**
     * The options as a catalog uses them, with defaults for what is missing.
     * With "bloques" (a design) the catalog follows them; without, it is the
     * automatic one: the categorías chosen.
     *
     * @param  array<string, mixed>  $opciones
     * @return array{categoria_ids: list<int>, solo_con_stock: bool, precio: string, columnas: int, titulo: string, encabezado: bool, pie: bool, subcategorias: bool, ajustes: array<string, mixed>, plantilla: ?string, bloques: ?list<array<string, mixed>>}
     */
    public static function normalizar(array $opciones): array
    {
        return [
            'categoria_ids' => array_values(array_map('intval', $opciones['categoria_ids'] ?? [])),
            'solo_con_stock' => (bool) ($opciones['solo_con_stock'] ?? false),
            'precio' => in_array($opciones['precio'] ?? null, ['detal', 'mayorista', 'ninguno'], true) ? $opciones['precio'] : 'detal',
            'columnas' => in_array((int) ($opciones['columnas'] ?? 4), [2, 3, 4], true) ? (int) ($opciones['columnas'] ?? 4) : 4,
            'titulo' => trim((string) ($opciones['titulo'] ?? '')) ?: 'Catálogo de productos',
            'encabezado' => (bool) ($opciones['encabezado'] ?? true),
            'pie' => (bool) ($opciones['pie'] ?? true),
            'subcategorias' => (bool) ($opciones['subcategorias'] ?? true),
            'ajustes' => DisenoCatalogo::normalizarAjustes($opciones['ajustes'] ?? null),
            'plantilla' => isset($opciones['plantilla']) ? (string) $opciones['plantilla'] : null,
            'bloques' => is_array($opciones['bloques'] ?? null) ? DisenoCatalogo::normalizar($opciones['bloques']) : null,
        ];
    }

    /**
     * What the catalog prints, in order: each visible block with what it
     * shows. Categorías left without productos are left out.
     *
     * @param  array<string, mixed>  $opciones
     * @param  int|null  $porCategoria  At most these productos per categoría (previews).
     * @return list<array<string, mixed>>
     */
    public function secciones(array $opciones, ?int $porCategoria = null, bool $web = false): array
    {
        $opciones = self::normalizar($opciones);
        $productos = $this->productos($opciones, $web);
        $bloques = collect($opciones['bloques'] ?? $this->bloquesAutomaticos($opciones, $productos))
            ->where('visible', true);
        $nombres = Categoria::whereIn('id', $bloques->pluck('categoria_id')->filter())->pluck('nombre_categoria', 'id');

        $secciones = $bloques
            ->map(fn (array $bloque): ?array => match ($bloque['tipo']) {
                'categoria' => $this->categoria($bloque, $productos, $opciones, $nombres, $porCategoria),
                'texto' => $bloque['texto'] || $bloque['titulo'] ? $bloque : null,
                default => $bloque,
            })
            ->filter()
            ->values();

        // Categorías are numbered in the order they come.
        $numero = 0;

        return $secciones
            ->map(function (array $seccion) use (&$numero): array {
                return $seccion['tipo'] === 'categoria' ? [...$seccion, 'numero' => ++$numero] : $seccion;
            })
            ->all();
    }

    /**
     * The band that opens the catalog: its title, what it has and the price
     * it shows. Null when the design leaves it out or there is nothing.
     *
     * @param  array<string, mixed>  $opciones
     * @param  list<array<string, mixed>>  $secciones
     * @return array{titulo: string, precio: ?string, total: int, categorias: list<array{titulo: string, total: int}>}|null
     */
    private function presentacion(array $opciones, array $secciones): ?array
    {
        $categorias = collect($secciones)->where('tipo', 'categoria');

        if (! $opciones['ajustes']['presentacion'] || $categorias->isEmpty()) {
            return null;
        }

        return [
            'titulo' => $opciones['titulo'],
            'precio' => match ($opciones['precio']) {
                'detal' => 'Precios al detal',
                'mayorista' => 'Precios mayoristas',
                default => null,
            },
            'total' => $categorias->sum(fn (array $categoria): int => $categoria['productos']->count()),
            'categorias' => $categorias
                ->map(fn (array $categoria): array => ['titulo' => $categoria['titulo'], 'total' => $categoria['productos']->count()])
                ->values()
                ->all(),
        ];
    }

    /**
     * How many productos the catalog shows.
     *
     * @param  array<string, mixed>  $opciones
     */
    public function totalProductos(array $opciones): int
    {
        return collect($this->secciones($opciones))
            ->where('tipo', 'categoria')
            ->sum(fn (array $seccion): int => $seccion['productos']->count());
    }

    /**
     * How a categoría's productos are laid out so its rows are full: one or
     * two productos lie wide (image beside the text); more go in the
     * columns, of the ones near the size asked for, that leave the fewest
     * gaps in the last row (which is centered anyway).
     *
     * @return array{modo: 'horizontal'|'vertical', columnas: int}
     */
    public static function disposicion(int $total, int $columnas): array
    {
        if ($total <= 2) {
            return ['modo' => 'horizontal', 'columnas' => max($total, 1)];
        }

        if ($total <= $columnas + 1) {
            return ['modo' => 'vertical', 'columnas' => $total];
        }

        $huecos = fn (int $opcion): int => ($opcion - $total % $opcion) % $opcion;

        // Ties keep the size asked for.
        $mejor = collect([$columnas, $columnas + 1])
            ->sortBy(fn (int $opcion): array => [$huecos($opcion), $opcion !== $columnas])
            ->first();

        return ['modo' => 'vertical', 'columnas' => $mejor];
    }

    /**
     * The catalog as HTML, with its design. The browser preview ($web) shows
     * the page's header and footer itself; in the PDF Chromium repeats them
     * on every page.
     *
     * @param  array<string, mixed>  $opciones
     */
    public function html(array $opciones, ?int $porCategoria = null, bool $web = false): string
    {
        $opciones = self::normalizar($opciones);

        $secciones = $this->secciones($opciones, $porCategoria, $web);

        return view('pdf.catalogo', [
            ...$this->marca($opciones, $web),
            'opciones' => $opciones,
            'secciones' => $secciones,
            'presentacion' => $this->presentacion($opciones, $secciones),
            'web' => $web,
        ])->render();
    }

    /**
     * The catalog as a PDF (A4, numbered pages).
     *
     * @param  array<string, mixed>  $opciones
     */
    public function pdf(array $opciones): string
    {
        $opciones = self::normalizar($opciones);
        $marca = $this->marca($opciones);

        // Opened from a file, so Chromium may read the local product images.
        $pagina = tempnam(sys_get_temp_dir(), 'catalogo').'.html';
        file_put_contents($pagina, $this->html($opciones));

        // Header and footer are drawn apart from the page: their images go
        // inside them.
        $encabezado = $opciones['encabezado']
            ? view('pdf.catalogo-encabezado', [
                ...$marca,
                'cabecera' => [...$marca['cabecera'], 'logo' => $marca['cabecera']['logo'] ? $this->embebida($marca['empresa']?->logo_empresa) : null],
            ])->render()
            : '<div></div>';
        $pie = $opciones['pie'] ? view('pdf.catalogo-pie', $marca)->render() : '<div></div>';

        try {
            return Browsershot::htmlFromFilePath($pagina)
                ->format('A4')
                ->margins($opciones['encabezado'] ? 34 : 10, 0, $opciones['pie'] ? 18 : 10, 0)
                ->showBackground()
                ->showBrowserHeaderAndFooter()
                ->headerHtml($encabezado)
                ->footerHtml($pie)
                // The embedded logo is too long for a command line (Windows).
                ->writeOptionsToFile()
                ->timeout(self::TIEMPO_MAXIMO)
                ->pdf();
        } finally {
            @unlink($pagina);
        }
    }

    /**
     * Every producto the catalog may show (of the categorías its blocks or
     * options name), with the price asked for.
     *
     * @param  array<string, mixed>  $opciones
     * @return Collection<int, array<string, mixed>>
     */
    private function productos(array $opciones, bool $web): Collection
    {
        $categoriaIds = $opciones['bloques'] !== null
            ? collect($opciones['bloques'])->where('tipo', 'categoria')->pluck('categoria_id')->unique()->values()->all()
            : $opciones['categoria_ids'];

        if ($opciones['bloques'] !== null && $categoriaIds === []) {
            return collect();
        }

        return Producto::query()
            ->with(['categoria:id,nombre_categoria', 'subCategoria:id,nombre_sub_categoria', 'imagenes:id,producto_id,imagen_producto'])
            ->withSum('stockBodegas as stock_total', 'stock')
            ->when($categoriaIds !== [], fn ($query) => $query->whereIn('categoria_id', $categoriaIds))
            ->get()
            ->map(fn (Producto $producto): array => [
                'nombre' => trim(implode(' ', array_filter([$producto->referencia_producto, $producto->marca]))) ?: 'Producto '.$producto->id,
                'descripcion' => $producto->descripcion_producto,
                'sku' => $producto->sku,
                'categoria_id' => $producto->categoria_id ?? 0,
                'categoria' => $producto->categoria?->nombre_categoria ?? 'Sin categoría',
                'sub_categoria' => $producto->subCategoria?->nombre_sub_categoria,
                // Servicios carry no stock: they are never "agotados".
                'agotado' => $producto->inventariable && (float) $producto->stock_total <= 0,
                'precio' => match ($opciones['precio']) {
                    'detal' => (float) $producto->valor_detal,
                    'mayorista' => (float) $producto->valor_mayorista,
                    default => null,
                },
                'imagen' => $this->imagen($producto->imagenes->first()?->imagen_producto, $web),
            ])
            ->when($opciones['solo_con_stock'], fn (Collection $productos) => $productos->reject(fn (array $producto): bool => $producto['agotado']))
            ->values();
    }

    /**
     * The design of a catalog without one: a block per categoría that has
     * productos, by name.
     *
     * @param  array<string, mixed>  $opciones
     * @param  Collection<int, array<string, mixed>>  $productos
     * @return list<array<string, mixed>>
     */
    private function bloquesAutomaticos(array $opciones, Collection $productos): array
    {
        return $productos
            ->unique('categoria_id')
            ->sortBy('categoria', SORT_NATURAL | SORT_FLAG_CASE)
            ->map(fn (array $producto): array => [
                'id' => 'categoria-'.$producto['categoria_id'],
                'tipo' => 'categoria',
                'visible' => true,
                'categoria_id' => $producto['categoria_id'],
                'titulo' => $producto['categoria'],
                'tamano' => 'auto',
                'orden' => 'nombre',
                'solo_con_stock' => false,
                'subcategorias' => $opciones['subcategorias'],
            ])
            ->values()
            ->all();
    }

    /**
     * A categoría block with its productos, in the order and layout it asks
     * for; null when it has none to show.
     *
     * @param  array<string, mixed>  $bloque
     * @param  Collection<int, array<string, mixed>>  $productos
     * @param  array<string, mixed>  $opciones
     * @param  Collection<int, string>  $nombres
     * @return array<string, mixed>|null
     */
    private function categoria(array $bloque, Collection $productos, array $opciones, Collection $nombres, ?int $porCategoria): ?array
    {
        $suyos = $productos
            ->where('categoria_id', $bloque['categoria_id'])
            ->when($bloque['solo_con_stock'], fn (Collection $lista) => $lista->reject(fn (array $producto): bool => $producto['agotado']));

        $suyos = match ($bloque['orden']) {
            'precio_asc' => $suyos->sortBy('precio'),
            'precio_desc' => $suyos->sortByDesc('precio'),
            default => $suyos->sortBy('nombre', SORT_NATURAL | SORT_FLAG_CASE),
        };

        $suyos = $suyos->when($porCategoria, fn (Collection $lista, int $limite) => $lista->take($limite))->values();

        if ($suyos->isEmpty()) {
            return null;
        }

        $columnas = $bloque['tamano'] === 'auto' ? $opciones['columnas'] : (int) $bloque['tamano'];

        return [
            ...$bloque,
            'titulo' => $bloque['titulo'] ?? $nombres[$bloque['categoria_id']] ?? 'Sin categoría',
            'productos' => $suyos,
            'grupos' => self::grupos($suyos, $bloque['subcategorias'], $columnas),
        ];
    }

    /**
     * A categoría's productos split by subcategoría (by name; those without
     * one last, as "Otros"), each group laid out on its own. Without
     * subcategorías, or not split, one group with no title.
     *
     * @param  Collection<int, array<string, mixed>>  $productos
     * @return list<array{titulo: ?string, productos: Collection<int, array<string, mixed>>, disposicion: array{modo: string, columnas: int}}>
     */
    public static function grupos(Collection $productos, bool $dividir, int $columnas): array
    {
        $grupo = fn (?string $titulo, Collection $suyos): array => [
            'titulo' => $titulo,
            'productos' => $suyos->values(),
            'disposicion' => self::disposicion($suyos->count(), $columnas),
        ];

        $porSubcategoria = $productos->groupBy(fn (array $producto): string => $producto['sub_categoria'] ?? '');

        if (! $dividir || $porSubcategoria->keys()->all() === ['']) {
            return [$grupo(null, $productos)];
        }

        return $porSubcategoria
            ->sortKeysUsing(fn (string $a, string $b): int => ($a === '') <=> ($b === '') ?: strnatcasecmp($a, $b))
            ->map(fn (Collection $suyos, string $nombre): array => $grupo($nombre === '' ? 'Otros' : $nombre, $suyos))
            ->values()
            ->all();
    }

    /**
     * The company's brand as the catalog shows it.
     *
     * @param  array<string, mixed>  $opciones
     * @return array{empresa: ?Empresa, paleta: array{primario: string, acento: string, sobre_primario: string, sobre_acento: string}, logo: ?string, cabecera: array{logo: ?string, titulo: string, subtitulo: ?string}, piePagina: array{texto: ?string, colaboracion: ?string, paginas: bool}, redes: list<array<string, mixed>>, titulo: string, fecha: string}
     */
    private function marca(array $opciones, bool $web = false): array
    {
        $empresa = Empresa::first();
        $ajustes = $opciones['ajustes'];
        $logo = $this->imagen($empresa?->logo_empresa, $web);

        // A title of its own, or the slogan (then the catalog's title under it).
        $titulo = $ajustes['encabezado_titulo'] ?? $empresa?->eslogan_empresa ?: $opciones['titulo'];
        $subtitulo = $ajustes['encabezado_subtitulo']
            ?? $empresa?->descripcion_empresa
            ?: ($titulo !== $opciones['titulo'] ? $opciones['titulo'] : null);

        return [
            'empresa' => $empresa,
            'paleta' => ($empresa ?? new Empresa)->paleta(),
            'logo' => $logo,
            'cabecera' => [
                'logo' => $ajustes['encabezado_logo'] ? $logo : null,
                'titulo' => $titulo,
                'subtitulo' => $ajustes['encabezado_mostrar_subtitulo'] ? $subtitulo : null,
            ],
            'piePagina' => [
                'texto' => $ajustes['pie_mostrar_texto'] ? $ajustes['pie_texto'] : null,
                // Without a text of its own, "En colaboración de…" (if any).
                'colaboracion' => $ajustes['pie_mostrar_texto'] && ! $ajustes['pie_texto'] ? $empresa?->colaboracion_empresa : null,
                'paginas' => $ajustes['pie_paginas'],
            ],
            // The footer of the PDF is drawn apart: uploaded icons go inside it.
            'redes' => collect($empresa?->redes ?? [])
                ->reject(fn (array $red): bool => in_array(DisenoCatalogo::idRed($red), $ajustes['pie_ocultar_redes'], true))
                ->map(fn (array $red): array => [
                    ...$red,
                    'imagen' => $web ? $red['icono_url'] : $this->embebida($red['icono']),
                ])
                ->values()
                ->all(),
            'titulo' => $opciones['titulo'],
            'fecha' => now()->translatedFormat('j \d\e F \d\e Y'),
        ];
    }

    /**
     * A stored image as the page reads it: its URL in the browser, the file
     * itself (file:///...) for Chromium. Null when it is missing.
     */
    private function imagen(?string $ruta, bool $web): ?string
    {
        if (! $ruta || ! Storage::disk('public')->exists($ruta)) {
            return null;
        }

        return $web ? Storage::disk('public')->url($ruta) : $this->archivoLocal($ruta);
    }

    /**
     * A stored image inside the HTML itself (data: URI), for the PDF's header.
     */
    private function embebida(?string $ruta): ?string
    {
        $disco = Storage::disk('public');

        if (! $ruta || ! $disco->exists($ruta)) {
            return null;
        }

        return 'data:'.$disco->mimeType($ruta).';base64,'.base64_encode($disco->get($ruta));
    }

    /**
     * A stored file as Chromium reads it (file:///...).
     */
    private function archivoLocal(string $ruta): string
    {
        return 'file:///'.ltrim(str_replace('\\', '/', Storage::disk('public')->path($ruta)), '/');
    }
}
