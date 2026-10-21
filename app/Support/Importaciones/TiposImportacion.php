<?php

namespace App\Support\Importaciones;

use App\Models\User;
use App\Modules\Catalogo\Services\ImportadorProductos;
use App\Modules\Finanzas\Services\ImportadorPucs;
use InvalidArgumentException;

/**
 * What can be imported from a file: each type with its importer and the
 * permission it needs. Adding a type here is all the import dialog needs.
 */
final class TiposImportacion
{
    /** @var array<string, array{etiqueta: string, importador: class-string<Importador>, permiso: string}> */
    private const TIPOS = [
        'productos' => [
            'etiqueta' => 'Productos',
            'importador' => ImportadorProductos::class,
            'permiso' => 'productos.import',
        ],
        'pucs' => [
            'etiqueta' => 'Medios de pago',
            'importador' => ImportadorPucs::class,
            'permiso' => 'puc.import',
        ],
    ];

    /**
     * @return list<string>
     */
    public static function claves(): array
    {
        return array_keys(self::TIPOS);
    }

    public static function importador(string $tipo): Importador
    {
        return app(self::datos($tipo)['importador']);
    }

    public static function permiso(string $tipo): string
    {
        return self::datos($tipo)['permiso'];
    }

    public static function etiqueta(string $tipo): string
    {
        return self::TIPOS[$tipo]['etiqueta'] ?? $tipo;
    }

    /**
     * The types the user may import, with what the dialog shows of each.
     *
     * @return list<array{value: string, label: string, columnas: list<string>}>
     */
    public static function para(?User $user): array
    {
        if ($user === null) {
            return [];
        }

        $tipos = [];

        foreach (self::TIPOS as $clave => $datos) {
            if ($user->can($datos['permiso'])) {
                $tipos[] = [
                    'value' => $clave,
                    'label' => $datos['etiqueta'],
                    'columnas' => self::importador($clave)->columnas(),
                ];
            }
        }

        return $tipos;
    }

    /**
     * @return array{etiqueta: string, importador: class-string<Importador>, permiso: string}
     */
    private static function datos(string $tipo): array
    {
        return self::TIPOS[$tipo] ?? throw new InvalidArgumentException("Unknown import type [{$tipo}].");
    }
}
