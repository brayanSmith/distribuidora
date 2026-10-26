<?php

namespace App\Modules\Catalogo\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Jobs\GenerarCatalogoPdfJob;
use App\Modules\Catalogo\Models\CatalogoPdf;
use App\Modules\Catalogo\Models\CatalogoPlantilla;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Services\GeneradorCatalogo;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Illuminate\Validation\Rule;
use Symfony\Component\HttpFoundation\StreamedResponse;

/**
 * The product catalog as PDF: asked for with some options, generated in
 * the background, then downloaded by whoever asked for it.
 */
class CatalogoPdfController extends Controller
{
    /**
     * What the catalog window needs: the categorías to pick, the prices the
     * user may print and their latest catalogs.
     */
    public function index(Request $request): JsonResponse
    {
        Gate::authorize('productos.export');

        return response()->json([
            'categorias' => Categoria::orderBy('nombre_categoria')->get(['id', 'nombre_categoria']),
            'precios' => $this->preciosPermitidos($request),
            'plantillas' => CatalogoPlantilla::orderBy('nombre')->get(['id', 'nombre']),
            'catalogos' => $this->ultimos($request),
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        Gate::authorize('productos.export');

        $datos = $request->validate([
            'categoria_ids' => ['nullable', 'array'],
            'categoria_ids.*' => ['integer', 'exists:categorias,id'],
            'solo_con_stock' => ['boolean'],
            'precio' => ['required', Rule::in($this->preciosPermitidos($request))],
            'columnas' => ['required', Rule::in([2, 3, 4])],
            'portada' => ['boolean'],
            'subcategorias' => ['boolean'],
            'titulo' => ['nullable', 'string', 'max:80'],
            'plantilla_id' => ['nullable', 'integer', 'exists:catalogo_plantillas,id'],
        ], [
            'precio.in' => 'No puedes mostrar ese precio en el catálogo.',
        ]);

        $catalogo = CatalogoPdf::create([
            'user_id' => $request->user()->id,
            'opciones' => GeneradorCatalogo::normalizar($this->conPlantilla($datos)),
        ]);

        GenerarCatalogoPdfJob::dispatch($catalogo->id);

        return response()->json(['catalogo' => $this->resumen($catalogo->fresh())], 201);
    }

    /**
     * How a catalog is going, while the window waits for it.
     */
    public function show(Request $request, CatalogoPdf $catalogo): JsonResponse
    {
        abort_unless($catalogo->user_id === $request->user()->id, 404);

        return response()->json(['catalogo' => $this->resumen($catalogo)]);
    }

    public function descargar(Request $request, CatalogoPdf $catalogo): StreamedResponse
    {
        abort_unless($catalogo->user_id === $request->user()->id, 404);
        abort_unless($catalogo->estado === CatalogoPdf::COMPLETADO && Storage::disk('local')->exists((string) $catalogo->archivo), 404);

        $nombre = Str::slug($catalogo->opciones['titulo'] ?? 'catalogo').'-'.$catalogo->created_at->format('Y-m-d').'.pdf';

        return Storage::disk('local')->download($catalogo->archivo, $nombre, ['Content-Type' => 'application/pdf']);
    }

    /**
     * The catalog in the browser, with a few productos: to see the design
     * before generating the whole PDF.
     */
    public function vistaPrevia(Request $request, GeneradorCatalogo $generador): string
    {
        Gate::authorize('productos.export');

        $datos = $request->validate([
            'categoria_ids' => ['nullable', 'array'],
            'categoria_ids.*' => ['integer'],
            'solo_con_stock' => ['boolean'],
            'precio' => ['nullable', Rule::in($this->preciosPermitidos($request))],
            'columnas' => ['nullable', Rule::in([2, 3, 4])],
            'portada' => ['boolean'],
            'subcategorias' => ['boolean'],
            'titulo' => ['nullable', 'string', 'max:80'],
            'plantilla_id' => ['nullable', 'integer', 'exists:catalogo_plantillas,id'],
        ]);

        return $generador->html($this->conPlantilla($datos), porCategoria: 8, web: true);
    }

    /**
     * The options with the design chosen (its blocks and settings, copied:
     * later changes to it do not touch a catalog already asked for).
     *
     * @param  array<string, mixed>  $datos
     * @return array<string, mixed>
     */
    private function conPlantilla(array $datos): array
    {
        $plantilla = isset($datos['plantilla_id']) ? CatalogoPlantilla::find($datos['plantilla_id']) : null;

        return $plantilla ? [...$datos, ...$plantilla->opciones()] : $datos;
    }

    /**
     * @return list<string>
     */
    private function preciosPermitidos(Request $request): array
    {
        $usuario = $request->user();

        return array_values(array_filter([
            $usuario->puedeVerPrecio('valor_detal') ? 'detal' : null,
            $usuario->puedeVerPrecio('valor_mayorista') ? 'mayorista' : null,
            'ninguno',
        ]));
    }

    /**
     * @return list<array<string, mixed>>
     */
    private function ultimos(Request $request): array
    {
        return CatalogoPdf::where('user_id', $request->user()->id)
            ->latest('id')
            ->limit(5)
            ->get()
            ->map(fn (CatalogoPdf $catalogo): array => $this->resumen($catalogo))
            ->all();
    }

    /**
     * @return array<string, mixed>
     */
    private function resumen(CatalogoPdf $catalogo): array
    {
        return [
            'id' => $catalogo->id,
            'titulo' => $catalogo->opciones['titulo'] ?? 'Catálogo de productos',
            'plantilla' => $catalogo->opciones['plantilla'] ?? null,
            'estado' => $catalogo->estado,
            'total_productos' => $catalogo->total_productos,
            'error' => $catalogo->error,
            'creado' => $catalogo->created_at?->toIso8601String(),
            'url' => $catalogo->estado === CatalogoPdf::COMPLETADO ? route('catalogo-pdf.descargar', $catalogo, absolute: false) : null,
        ];
    }
}
