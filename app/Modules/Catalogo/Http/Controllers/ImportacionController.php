<?php

namespace App\Modules\Catalogo\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Http\Requests\StoreImportacionRequest;
use App\Modules\Catalogo\Models\Importacion;
use App\Support\Importaciones\ImportarArchivoJob;
use App\Support\Importaciones\TiposImportacion;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ImportacionController extends Controller
{
    /**
     * First step: keep the file aside and tell what it has, so the user can
     * relate its headers with the columns before importing.
     */
    public function previa(Request $request): JsonResponse
    {
        $datos = $request->validate([
            'tipo' => ['required', Rule::in(TiposImportacion::claves())],
            'archivo' => ['required', 'file', 'extensions:csv,txt,xlsx', 'max:51200'],
        ]);

        Gate::authorize(TiposImportacion::permiso($datos['tipo']));

        $archivo = $request->file('archivo');
        $ruta = $archivo->storeAs(
            self::carpetaTemporal($request),
            Str::random(40).'.'.Str::lower($archivo->getClientOriginalExtension()),
            'local',
        );
        $importador = TiposImportacion::importador($datos['tipo']);

        return response()->json([
            'archivo_temporal' => basename($ruta),
            'nombre_original' => $archivo->getClientOriginalName(),
            'columnas' => $importador->columnas(),
            'obligatorias' => $importador->columnasObligatorias(),
            ...$importador->previa(Storage::disk('local')->path($ruta)),
        ]);
    }

    /**
     * Import the file in the background with the importer of the type the
     * user picked (productos, medios de pago...), using the columns they
     * related with its headers, if any.
     */
    public function store(StoreImportacionRequest $request): RedirectResponse
    {
        $tipo = $request->validated('tipo');

        Gate::authorize(TiposImportacion::permiso($tipo));

        if ($request->hasFile('archivo')) {
            $archivo = $request->file('archivo');
            $ruta = $archivo->store('importaciones', 'local');
            $nombre = $archivo->getClientOriginalName();
        } else {
            // The file the preview kept aside: only the user's own.
            $ruta = self::carpetaTemporal($request).'/'.$request->validated('archivo_temporal');
            abort_unless(Storage::disk('local')->exists($ruta), 422, __('The file is no longer available; upload it again.'));
            $nombre = $request->validated('nombre_original') ?? basename($ruta);
        }

        $columnas = TiposImportacion::importador($tipo)->columnas();
        $mapeo = $request->validated('mapeo');

        $importacion = Importacion::create([
            'user_id' => $request->user()->id,
            'tipo' => $tipo,
            'archivo' => $ruta,
            'nombre_original' => $nombre,
            'mapeo' => $mapeo === null ? null : array_intersect_key($mapeo, array_flip($columnas)),
        ]);

        ImportarArchivoJob::dispatch($importacion->id);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('The import started; you can keep working while it runs.')]);

        return back();
    }

    /**
     * Where the previews of a user wait to be imported.
     */
    private static function carpetaTemporal(Request $request): string
    {
        return 'importaciones/previas/'.$request->user()->id;
    }

    /**
     * Mark one of the user's finished imports as read.
     */
    public function marcarLeida(Request $request, Importacion $importacion): RedirectResponse
    {
        abort_unless($importacion->user_id === $request->user()->id, 403);

        $importacion->update(['leida_at' => $importacion->leida_at ?? now()]);

        return back();
    }

    /**
     * Mark every finished import of the user as read.
     */
    public function marcarTodasLeidas(Request $request): RedirectResponse
    {
        Importacion::de($request->user())->sinLeer()->update(['leida_at' => now()]);

        return back();
    }

    /**
     * A CSV with the columns of a type and an example row.
     */
    public function plantilla(Request $request): StreamedResponse
    {
        $tipo = $request->validate(['tipo' => ['required', Rule::in(TiposImportacion::claves())]])['tipo'];

        Gate::authorize(TiposImportacion::permiso($tipo));

        $importador = TiposImportacion::importador($tipo);

        return response()->streamDownload(function () use ($importador): void {
            $salida = fopen('php://output', 'w');
            fwrite($salida, "\xEF\xBB\xBF");
            fputcsv($salida, $importador->columnas());
            fputcsv($salida, $importador->filaDeEjemplo());
            fclose($salida);
        }, "plantilla-{$tipo}.csv", ['Content-Type' => 'text/csv; charset=UTF-8']);
    }
}
