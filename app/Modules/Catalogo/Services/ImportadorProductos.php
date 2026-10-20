<?php

namespace App\Modules\Catalogo\Services;

use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\Importacion;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Models\SubCategoria;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;
use Spatie\SimpleExcel\SimpleExcelReader;
use Throwable;

/**
 * Reads a spreadsheet of productos row by row and creates or updates them.
 *
 * A producto is matched by its SKU; the categorias and subcategorias that do
 * not exist yet are created on the way. A failing row is recorded and the rest
 * go on.
 */
class ImportadorProductos
{
    /** Columns of the file, in the order the template lists them. */
    public const COLUMNAS = [
        'sku', 'marca', 'referencia', 'descripcion', 'categoria', 'subcategoria',
        'costo', 'valor_detal', 'valor_mayorista', 'inventariable',
    ];

    /** Other names a header may have, by the column they stand for. */
    private const ALIAS = [
        'referencia_producto' => 'referencia',
        'descripcion_producto' => 'descripcion',
        'sub_categoria' => 'subcategoria',
        'categoria_producto' => 'categoria',
        'costo_producto' => 'costo',
        'detal' => 'valor_detal',
        'mayorista' => 'valor_mayorista',
    ];

    private const MAX_ERRORES_GUARDADOS = 200;

    private const FILAS_POR_ACTUALIZACION = 100;

    /** @var array<string, Categoria> */
    private array $categorias = [];

    /** @var array<string, SubCategoria> */
    private array $subCategorias = [];

    public function importar(Importacion $importacion): void
    {
        $ruta = Storage::disk('local')->path($importacion->archivo);

        $importacion->update([
            'estado' => Importacion::PROCESANDO,
            'iniciada_at' => now(),
            'total_filas' => $this->contarFilas($ruta),
        ]);

        $errores = [];

        foreach ($this->lector($ruta)->getRows() as $indice => $fila) {
            // The header is the first row of the file, so data starts on row 2.
            $numero = $indice + 2;

            try {
                $this->procesarFila($importacion, $fila);
            } catch (Throwable $e) {
                $importacion->con_error++;

                if (count($errores) < self::MAX_ERRORES_GUARDADOS) {
                    $errores[] = ['fila' => $numero, 'mensaje' => $e instanceof FilaInvalida ? $e->getMessage() : 'Error inesperado: '.$e->getMessage()];
                }
            }

            $importacion->procesadas++;

            if ($importacion->procesadas % self::FILAS_POR_ACTUALIZACION === 0) {
                $importacion->errores = $errores;
                $importacion->save();
            }
        }

        $importacion->errores = $errores;
        $importacion->estado = Importacion::COMPLETADA;
        $importacion->terminada_at = now();
        $importacion->save();

        Storage::disk('local')->delete($importacion->archivo);
    }

    /**
     * @param  array<string, mixed>  $fila
     */
    private function procesarFila(Importacion $importacion, array $fila): void
    {
        $datos = $this->validar($fila);

        $categoria = $datos['categoria'] !== null ? $this->categoria($datos['categoria']) : null;
        $subCategoria = $categoria !== null && $datos['subcategoria'] !== null
            ? $this->subCategoria($categoria, $datos['subcategoria'])
            : null;

        $atributos = array_filter([
            'categoria_id' => $categoria?->id,
            'sub_categoria_id' => $subCategoria?->id,
            'marca' => $datos['marca'],
            'referencia_producto' => $datos['referencia'],
            'descripcion_producto' => $datos['descripcion'],
            'costo_producto' => $datos['costo'],
            'valor_detal' => $datos['valor_detal'],
            'valor_mayorista' => $datos['valor_mayorista'],
            'inventariable' => $datos['inventariable'],
        ], fn (mixed $valor): bool => $valor !== null);

        $producto = $datos['sku'] !== null
            ? Producto::withTrashed()->where('sku', $datos['sku'])->first()
            : null;

        if ($producto === null) {
            Producto::create($atributos + ['sku' => $datos['sku']]);
            $importacion->creados++;

            return;
        }

        if ($producto->trashed()) {
            $producto->restore();
        }

        $producto->update($atributos);
        $importacion->actualizados++;
    }

    /**
     * @param  array<string, mixed>  $fila
     * @return array{sku: ?string, marca: ?string, referencia: ?string, descripcion: ?string, categoria: ?string, subcategoria: ?string, costo: ?float, valor_detal: ?float, valor_mayorista: ?float, inventariable: ?bool}
     */
    private function validar(array $fila): array
    {
        $texto = fn (string $columna): ?string => ($valor = trim((string) ($fila[$columna] ?? ''))) === '' ? null : $valor;

        $datos = [];
        foreach (['sku', 'marca', 'referencia', 'descripcion', 'categoria', 'subcategoria'] as $columna) {
            $datos[$columna] = $texto($columna);
        }
        foreach (['costo', 'valor_detal', 'valor_mayorista'] as $columna) {
            $datos[$columna] = $this->numero($texto($columna));
        }
        $datos['inventariable'] = $this->booleano($texto('inventariable'));

        $validador = Validator::make($datos, [
            'sku' => ['nullable', 'string', 'max:255'],
            'marca' => ['nullable', 'string', 'max:255'],
            'referencia' => ['nullable', 'string', 'max:255', 'required_without:sku'],
            'descripcion' => ['nullable', 'string', 'max:255'],
            'categoria' => ['nullable', 'string', 'max:255'],
            'subcategoria' => ['nullable', 'string', 'max:255'],
            'costo' => ['nullable', 'numeric', 'min:0'],
            'valor_detal' => ['nullable', 'numeric', 'min:0'],
            'valor_mayorista' => ['nullable', 'numeric', 'min:0'],
        ], [
            'referencia.required_without' => 'La fila necesita un SKU o una referencia.',
        ]);

        if ($datos['subcategoria'] !== null && $datos['categoria'] === null) {
            throw new FilaInvalida('La subcategoría necesita una categoría.');
        }

        if ($validador->fails()) {
            throw new FilaInvalida($validador->errors()->first());
        }

        return $datos;
    }

    private function categoria(string $nombre): Categoria
    {
        return $this->categorias[Str::lower($nombre)] ??= Categoria::query()
            ->whereRaw('lower(nombre_categoria) = ?', [Str::lower($nombre)])
            ->first() ?? Categoria::create(['nombre_categoria' => $nombre]);
    }

    private function subCategoria(Categoria $categoria, string $nombre): SubCategoria
    {
        return $this->subCategorias[$categoria->id.'|'.Str::lower($nombre)] ??= SubCategoria::query()
            ->where('categoria_id', $categoria->id)
            ->whereRaw('lower(nombre_sub_categoria) = ?', [Str::lower($nombre)])
            ->first() ?? SubCategoria::create(['categoria_id' => $categoria->id, 'nombre_sub_categoria' => $nombre]);
    }

    /**
     * Accepts "1234.5" and "1.234,50" alike; anything else is left as text so
     * the validation rejects it.
     */
    private function numero(?string $valor): float|string|null
    {
        if ($valor === null) {
            return null;
        }

        $limpio = str_replace(['$', ' '], '', $valor);

        if (str_contains($limpio, ',')) {
            $limpio = str_replace(',', '.', str_replace('.', '', $limpio));
        }

        return is_numeric($limpio) ? (float) $limpio : $valor;
    }

    private function booleano(?string $valor): ?bool
    {
        if ($valor === null) {
            return null;
        }

        return in_array(Str::lower($valor), ['1', 'si', 'sí', 's', 'true', 'x', 'yes'], true);
    }

    private function contarFilas(string $ruta): int
    {
        return $this->lector($ruta)->getRows()->count();
    }

    private function lector(string $ruta): SimpleExcelReader
    {
        $esExcel = Str::lower(pathinfo($ruta, PATHINFO_EXTENSION)) === 'xlsx';
        $lector = SimpleExcelReader::create($ruta, $esExcel ? 'xlsx' : 'csv');

        if (! $esExcel) {
            $lector->useDelimiter($this->delimitador($ruta));
        }

        return $lector->formatHeadersUsing(fn (string $encabezado): string => $this->normalizar($encabezado));
    }

    /**
     * The delimiter the first line uses: comma, semicolon or tab.
     */
    private function delimitador(string $ruta): string
    {
        $linea = (string) fgets(fopen($ruta, 'r'));

        $cuentas = [',' => substr_count($linea, ','), ';' => substr_count($linea, ';'), "\t" => substr_count($linea, "\t")];
        arsort($cuentas);

        return array_key_first($cuentas);
    }

    private function normalizar(string $encabezado): string
    {
        $limpio = Str::of($encabezado)
            ->replace("\xEF\xBB\xBF", '')
            ->trim()
            ->ascii()
            ->lower()
            ->replaceMatches('/[^a-z0-9]+/', '_')
            ->trim('_')
            ->toString();

        return self::ALIAS[$limpio] ?? $limpio;
    }
}
