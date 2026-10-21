<?php

namespace App\Support\Importaciones;

use App\Modules\Catalogo\Models\Importacion;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Spatie\SimpleExcel\SimpleExcelReader;
use Throwable;

/**
 * Reads a spreadsheet (CSV, TXT or Excel) row by row and hands each row to the
 * concrete importer. A failing row is recorded with its number and the rest go
 * on; the progress is saved every few rows so it can be followed.
 */
abstract class Importador
{
    private const MAX_ERRORES_GUARDADOS = 200;

    private const FILAS_POR_ACTUALIZACION = 100;

    /**
     * Columns of the file, in the order the template lists them.
     *
     * @return list<string>
     */
    abstract public function columnas(): array;

    /**
     * An example row for the template, in the order of the columns.
     *
     * @return list<string>
     */
    abstract public function filaDeEjemplo(): array;

    /**
     * Create or update the record of one row. Throw FilaInvalida to reject it.
     *
     * @param  array<string, mixed>  $fila  Values by normalized header.
     */
    abstract protected function procesarFila(Importacion $importacion, array $fila): void;

    /**
     * Columns a mapping must fill for the rows to make sense.
     *
     * @return list<string>
     */
    public function columnasObligatorias(): array
    {
        return [];
    }

    /**
     * What the file has, to relate its headers with the columns: its headers
     * (the key the rows use and the name as written), a few rows and the
     * header suggested for each column (same name or a known alias).
     *
     * @return array{encabezados: list<array{clave: string, nombre: string}>, muestra: list<array<string, mixed>>, sugerido: array<string, string|null>}
     */
    public function previa(string $ruta): array
    {
        $lector = $this->lector($ruta);
        $claves = $lector->getHeaders() ?? [];
        // The first row as written in the file, to show the headers by their name.
        $nombres = array_values($this->lector($ruta, normalizar: false)->noHeaderRow()->take(1)->getRows()->first() ?? []);

        $encabezados = [];
        foreach ($claves as $indice => $clave) {
            if ($clave !== '') {
                $encabezados[] = ['clave' => $clave, 'nombre' => trim((string) ($nombres[$indice] ?? $clave), "\xEF\xBB\xBF ")];
            }
        }

        $sugerido = [];
        foreach ($this->columnas() as $columna) {
            $sugerido[$columna] = in_array($columna, $claves, true) ? $columna : null;
        }

        return [
            'encabezados' => $encabezados,
            'muestra' => $this->lector($ruta)->take(3)->getRows()->values()->all(),
            'sugerido' => $sugerido,
        ];
    }

    /**
     * Other names a header may have, by the column they stand for.
     *
     * @return array<string, string>
     */
    protected function alias(): array
    {
        return [];
    }

    public function importar(Importacion $importacion): void
    {
        $ruta = Storage::disk('local')->path($importacion->archivo);

        $importacion->update([
            'estado' => Importacion::PROCESANDO,
            'iniciada_at' => now(),
            'total_filas' => $this->lector($ruta)->getRows()->count(),
        ]);

        $errores = [];

        foreach ($this->lector($ruta)->getRows() as $indice => $fila) {
            // The header is the first row of the file, so data starts on row 2.
            $numero = $indice + 2;

            try {
                $this->procesarFila($importacion, $this->mapear($fila, $importacion->mapeo));
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
     * With a mapping, each column takes the value of the header picked for
     * it (none: left empty); without one the headers are the columns.
     *
     * @param  array<string, mixed>  $fila
     * @param  array<string, string|null>|null  $mapeo
     * @return array<string, mixed>
     */
    private function mapear(array $fila, ?array $mapeo): array
    {
        if ($mapeo === null || $mapeo === []) {
            return $fila;
        }

        $mapeada = [];
        foreach ($this->columnas() as $columna) {
            $encabezado = $mapeo[$columna] ?? null;
            $mapeada[$columna] = $encabezado !== null && $encabezado !== '' ? ($fila[$encabezado] ?? null) : null;
        }

        return $mapeada;
    }

    /**
     * The trimmed text of a column, or null when it is empty.
     *
     * @param  array<string, mixed>  $fila
     */
    protected function texto(array $fila, string $columna): ?string
    {
        $valor = trim((string) ($fila[$columna] ?? ''));

        return $valor === '' ? null : $valor;
    }

    /**
     * Accepts "1234.5" and "1.234,50" alike; anything else is left as text so
     * the validation rejects it.
     */
    protected function numero(?string $valor): float|string|null
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

    protected function booleano(?string $valor): ?bool
    {
        if ($valor === null) {
            return null;
        }

        return in_array(Str::lower($valor), ['1', 'si', 'sí', 's', 'true', 'x', 'yes'], true);
    }

    private function lector(string $ruta, bool $normalizar = true): SimpleExcelReader
    {
        $esExcel = Str::lower(pathinfo($ruta, PATHINFO_EXTENSION)) === 'xlsx';
        $lector = SimpleExcelReader::create($ruta, $esExcel ? 'xlsx' : 'csv');

        if (! $esExcel) {
            $lector->useDelimiter($this->delimitador($ruta));
        }

        return $normalizar
            ? $lector->formatHeadersUsing(fn (string $encabezado): string => $this->normalizar($encabezado))
            : $lector;
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

        return $this->alias()[$limpio] ?? $limpio;
    }
}
