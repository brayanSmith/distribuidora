<?php

namespace App\Modules\Catalogo\Jobs;

use App\Modules\Catalogo\Models\Importacion;
use App\Modules\Catalogo\Services\ImportadorProductos;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Throwable;

class ImportarProductosJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 3600;

    public function __construct(public int $importacionId) {}

    public function handle(ImportadorProductos $importador): void
    {
        $importacion = Importacion::findOrFail($this->importacionId);

        // A bulk import would flood the history with one entry per producto.
        activity()->withoutLogs(fn () => $importador->importar($importacion));
    }

    public function failed(Throwable $e): void
    {
        Importacion::whereKey($this->importacionId)->update([
            'estado' => Importacion::FALLIDA,
            'terminada_at' => now(),
            'errores' => json_encode([['fila' => 0, 'mensaje' => $e->getMessage()]]),
        ]);
    }
}
