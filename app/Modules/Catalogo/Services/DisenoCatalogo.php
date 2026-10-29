<?php

namespace App\Modules\Catalogo\Services;

use Illuminate\Validation\Rule;

/**
 * The blocks a catalog design is made of, printed top to bottom:
 *  - categoria: the productos of one categoría (own title, card size,
 *    order, only with stock, split by subcategoría).
 *  - texto: a free paragraph (conditions, payment, schedule).
 *  - salto: what follows starts on a new page.
 */
class DisenoCatalogo
{
    public const TIPOS = ['categoria', 'texto', 'salto'];

    public const TAMANOS = ['auto', '2', '3', '4'];

    public const ORDENES = ['nombre', 'precio_asc', 'precio_desc'];

    /**
     * The rules for a list of blocks sent under $campo.
     *
     * @return array<string, array<mixed>>
     */
    public static function reglas(string $campo = 'bloques'): array
    {
        return [
            $campo => ['present', 'array', 'max:80'],
            "{$campo}.*.id" => ['required', 'string', 'max:40'],
            "{$campo}.*.tipo" => ['required', Rule::in(self::TIPOS)],
            "{$campo}.*.visible" => ['required', 'boolean'],
            "{$campo}.*.titulo" => ['nullable', 'string', 'max:80'],
            "{$campo}.*.categoria_id" => ["required_if:{$campo}.*.tipo,categoria", 'nullable', 'integer', 'exists:categorias,id'],
            "{$campo}.*.tamano" => ['nullable', Rule::in(self::TAMANOS)],
            "{$campo}.*.orden" => ['nullable', Rule::in(self::ORDENES)],
            "{$campo}.*.solo_con_stock" => ['sometimes', 'boolean'],
            "{$campo}.*.subcategorias" => ['sometimes', 'boolean'],
            "{$campo}.*.texto" => ['nullable', 'string', 'max:1000'],
            "{$campo}.*.alineacion" => ['nullable', Rule::in(['left', 'center'])],
            "{$campo}.*.destacado" => ['sometimes', 'boolean'],
        ];
    }

    /**
     * The blocks with every field the catalog reads (defaults for what is
     * missing); unknown ones, and categorías without one, left out.
     *
     * @param  array<int, mixed>  $bloques
     * @return list<array<string, mixed>>
     */
    public static function normalizar(array $bloques): array
    {
        $normalizados = [];

        foreach ($bloques as $bloque) {
            if (! is_array($bloque) || ! in_array($bloque['tipo'] ?? null, self::TIPOS, true)) {
                continue;
            }

            $base = [
                'id' => (string) ($bloque['id'] ?? uniqid()),
                'tipo' => $bloque['tipo'],
                'visible' => (bool) ($bloque['visible'] ?? true),
            ];

            $propio = match ($bloque['tipo']) {
                'categoria' => [
                    'categoria_id' => isset($bloque['categoria_id']) ? (int) $bloque['categoria_id'] : null,
                    'titulo' => self::texto($bloque['titulo'] ?? null),
                    'tamano' => in_array($bloque['tamano'] ?? null, self::TAMANOS, true) ? $bloque['tamano'] : 'auto',
                    'orden' => in_array($bloque['orden'] ?? null, self::ORDENES, true) ? $bloque['orden'] : 'nombre',
                    'solo_con_stock' => (bool) ($bloque['solo_con_stock'] ?? false),
                    'subcategorias' => (bool) ($bloque['subcategorias'] ?? true),
                ],
                'texto' => [
                    'titulo' => self::texto($bloque['titulo'] ?? null),
                    'texto' => self::texto($bloque['texto'] ?? null),
                    'alineacion' => ($bloque['alineacion'] ?? null) === 'center' ? 'center' : 'left',
                    'destacado' => (bool) ($bloque['destacado'] ?? false),
                ],
                'salto' => [],
            };

            if ($bloque['tipo'] === 'categoria' && ! $propio['categoria_id']) {
                continue;
            }

            $normalizados[] = [...$base, ...$propio];
        }

        return $normalizados;
    }

    /**
     * The rules for what the page header and footer say, sent under $campo.
     *
     * @return array<string, array<mixed>>
     */
    public static function reglasAjustes(string $campo = 'ajustes'): array
    {
        return [
            $campo => ['nullable', 'array'],
            "{$campo}.presentacion" => ['sometimes', 'boolean'],
            "{$campo}.encabezado_logo" => ['sometimes', 'boolean'],
            "{$campo}.encabezado_titulo" => ['nullable', 'string', 'max:80'],
            "{$campo}.encabezado_subtitulo" => ['nullable', 'string', 'max:200'],
            "{$campo}.encabezado_mostrar_subtitulo" => ['sometimes', 'boolean'],
            "{$campo}.pie_ocultar_redes" => ['nullable', 'array', 'max:20'],
            "{$campo}.pie_ocultar_redes.*" => ['string', 'max:200'],
            "{$campo}.pie_texto" => ['nullable', 'string', 'max:120'],
            "{$campo}.pie_mostrar_texto" => ['sometimes', 'boolean'],
            "{$campo}.pie_paginas" => ['sometimes', 'boolean'],
        ];
    }

    /**
     * What the header and footer say, with defaults for what is missing. A
     * title or text left empty takes the company's own (slogan, description,
     * "En colaboración de…"); networks are hidden one by one (see
     * self::idRed), so the ones added later show.
     *
     * @return array{presentacion: bool, encabezado_logo: bool, encabezado_titulo: ?string, encabezado_subtitulo: ?string, encabezado_mostrar_subtitulo: bool, pie_ocultar_redes: list<string>, pie_texto: ?string, pie_mostrar_texto: bool, pie_paginas: bool}
     */
    public static function normalizarAjustes(mixed $ajustes): array
    {
        $ajustes = is_array($ajustes) ? $ajustes : [];

        return [
            // The band that opens the catalog (title, figures, categorías).
            'presentacion' => (bool) ($ajustes['presentacion'] ?? true),
            'encabezado_logo' => (bool) ($ajustes['encabezado_logo'] ?? true),
            'encabezado_titulo' => self::texto($ajustes['encabezado_titulo'] ?? null),
            'encabezado_subtitulo' => self::texto($ajustes['encabezado_subtitulo'] ?? null),
            'encabezado_mostrar_subtitulo' => (bool) ($ajustes['encabezado_mostrar_subtitulo'] ?? true),
            'pie_ocultar_redes' => array_values(array_filter((array) ($ajustes['pie_ocultar_redes'] ?? []), 'is_string')),
            'pie_texto' => self::texto($ajustes['pie_texto'] ?? null),
            'pie_mostrar_texto' => (bool) ($ajustes['pie_mostrar_texto'] ?? true),
            'pie_paginas' => (bool) ($ajustes['pie_paginas'] ?? true),
        ];
    }

    /**
     * How a network of the company is named when hidden from the footer.
     *
     * @param  array{red: string, valor: string}  $red
     */
    public static function idRed(array $red): string
    {
        return $red['red'].'|'.$red['valor'];
    }

    private static function texto(mixed $valor): ?string
    {
        return is_string($valor) && trim($valor) !== '' ? trim($valor) : null;
    }
}
