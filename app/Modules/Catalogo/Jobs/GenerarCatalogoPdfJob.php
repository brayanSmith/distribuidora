<?php

namespace App\Modules\Catalogo\Jobs;

use App\Modules\Catalogo\Models\CatalogoPdf;
use App\Modules\Catalogo\Notifications\CatalogoTerminado;
use App\Modules\Catalogo\Services\GeneradorCatalogo;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Queue\Queueable;
use Illuminate\Support\Facades\Storage;
use Throwable;

/**
 * Generates a product catalog PDF in the background (a big one takes a
 * while) and tells whoever asked for it when it is ready.
 */
class GenerarCatalogoPdfJob implements ShouldQueue
{
    use Queueable;

    public int $tries = 1;

    public int $timeout = 900;

    public function __construct(public int $catalogoId) {}

    public function handle(GeneradorCatalogo $generador): void
    {
        $catalogo = CatalogoPdf::findOrFail($this->catalogoId);
        $catalogo->update(['estado' => CatalogoPdf::PROCESANDO]);

        $archivo = "catalogos/{$catalogo->id}.pdf";
        Storage::disk('local')->put($archivo, $generador->pdf($catalogo->opciones));

        $catalogo->update([
            'estado' => CatalogoPdf::COMPLETADO,
            'archivo' => $archivo,
            'total_productos' => $generador->totalProductos($catalogo->opciones),
            'terminado_at' => now(),
        ]);

        CatalogoTerminado::avisar($catalogo);
    }

    public function failed(Throwable $e): void
    {
        $catalogo = CatalogoPdf::find($this->catalogoId);

        if ($catalogo === null) {
            return;
        }

        $catalogo->update([
            'estado' => CatalogoPdf::FALLIDO,
            'error' => mb_substr($e->getMessage(), 0, 250),
            'terminado_at' => now(),
        ]);

        CatalogoTerminado::avisar($catalogo);
    }
}
