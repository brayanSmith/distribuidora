<?php

namespace App\Modules\Catalogo\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Http\Requests\StoreImportacionRequest;
use App\Modules\Catalogo\Jobs\ImportarProductosJob;
use App\Modules\Catalogo\Models\Importacion;
use App\Modules\Catalogo\Services\ImportadorProductos;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportacionController extends Controller
{
    /**
     * Keep the uploaded file and import it in the background.
     */
    public function store(StoreImportacionRequest $request): RedirectResponse
    {
        Gate::authorize('productos.import');

        $archivo = $request->file('archivo');

        $importacion = Importacion::create([
            'user_id' => $request->user()->id,
            'archivo' => $archivo->store('importaciones', 'local'),
            'nombre_original' => $archivo->getClientOriginalName(),
        ]);

        ImportarProductosJob::dispatch($importacion->id);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('The import started; you can keep working while it runs.')]);

        return back();
    }

    /**
     * Mark one of the user's finished imports as read.
     */
    public function marcarLeida(Request $request, Importacion $importacion): RedirectResponse
    {
        Gate::authorize('productos.import');
        abort_unless($importacion->user_id === $request->user()->id, 403);

        $importacion->update(['leida_at' => $importacion->leida_at ?? now()]);

        return back();
    }

    /**
     * Mark every finished import of the user as read.
     */
    public function marcarTodasLeidas(Request $request): RedirectResponse
    {
        Gate::authorize('productos.import');

        Importacion::de($request->user())->sinLeer()->update(['leida_at' => now()]);

        return back();
    }

    /**
     * An empty CSV with the columns the import expects.
     */
    public function plantilla(): StreamedResponse
    {
        Gate::authorize('productos.import');

        return response()->streamDownload(function (): void {
            $salida = fopen('php://output', 'w');
            fwrite($salida, "\xEF\xBB\xBF");
            fputcsv($salida, ImportadorProductos::COLUMNAS);
            fputcsv($salida, ['SKU-001', 'Marca', 'Referencia', 'Descripción', 'Categoría', 'Subcategoría', '100000', '150000', '130000', 'si']);
            fclose($salida);
        }, 'plantilla-productos.csv', ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
