<?php

namespace App\Support\Importaciones;

use App\Modules\Catalogo\Models\Importacion;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

/**
 * Imports an uploaded file in the background with the importer of its type.
 */
class ImportarArchivoJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 3600;

    public function __construct(public int $importacionId) {}

    public function handle(): void
    {
        $importacion = Importacion::findOrFail($this->importacionId);
        $importador = TiposImportacion::importador($importacion->tipo);

        // A bulk import would flood the history with one entry per record.
        activity()->withoutLogs(fn () => $importador->importar($importacion));
    }

    public function failed(Throwable $e): void
    {
        $importacion = Importacion::find($this->importacionId);

        if ($importacion === null) {
            return;
        }

        $importacion->update([
            'estado' => Importacion::FALLIDA,
            'terminada_at' => now(),
            'errores' => [['fila' => 0, 'mensaje' => $e->getMessage()]],
        ]);

        ImportacionTerminada::avisar($importacion);
    }
}
