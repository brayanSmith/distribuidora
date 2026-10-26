<?php

namespace App\Modules\Catalogo\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Administracion\Models\Empresa;
use App\Modules\Catalogo\Models\CatalogoPlantilla;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Services\DisenoCatalogo;
use App\Modules\Catalogo\Services\GeneradorCatalogo;
use App\Support\RedesSociales;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The designs of the product catalog: made of blocks in the editor (next to
 * a preview with real productos) and picked when generating a catalog.
 */
class CatalogoPlantillaController extends Controller
{
    public function create(): Response
    {
        Gate::authorize('productos.export');

        return $this->editor(null);
    }

    public function edit(CatalogoPlantilla $plantilla): Response
    {
        Gate::authorize('productos.export');

        return $this->editor($plantilla);
    }

    public function store(Request $request): RedirectResponse
    {
        Gate::authorize('productos.export');

        $plantilla = CatalogoPlantilla::create([
            ...$this->validar($request),
            'user_id' => $request->user()->id,
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Plantilla guardada.']);

        return to_route('catalogo-plantillas.edit', $plantilla);
    }

    public function update(Request $request, CatalogoPlantilla $plantilla): RedirectResponse
    {
        Gate::authorize('productos.export');

        $plantilla->update($this->validar($request));

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Plantilla guardada.']);

        return back();
    }

    public function destroy(CatalogoPlantilla $plantilla): RedirectResponse
    {
        Gate::authorize('productos.export');

        $plantilla->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => 'Plantilla eliminada.']);

        return to_route('catalogo-plantillas.create');
    }

    /**
     * The design being edited, with real productos (a few per categoría):
     * what the editor shows when asked to update its preview.
     */
    public function vistaPrevia(Request $request, GeneradorCatalogo $generador): string
    {
        Gate::authorize('productos.export');

        $datos = $request->validate([
            ...$this->reglas(),
            'precio' => ['nullable', Rule::in(['detal', 'mayorista', 'ninguno'])],
            'solo_con_stock' => ['boolean'],
        ]);

        // A price the user may not see is not previewed.
        if (! $this->puedeVer($request, $datos['precio'] ?? 'detal')) {
            $datos['precio'] = 'ninguno';
        }

        return $generador->html([...$datos, 'titulo' => $datos['nombre'] ?? null], porCategoria: 8, web: true);
    }

    private function editor(?CatalogoPlantilla $plantilla): Response
    {
        $empresa = Empresa::first();

        return Inertia::render('catalogo-plantillas/editar', [
            'plantilla' => $plantilla ? [
                ...$plantilla->only(['id', 'nombre', 'bloques', 'columnas', 'encabezado', 'pie']),
                'ajustes' => DisenoCatalogo::normalizarAjustes($plantilla->ajustes),
            ] : null,
            // What the header and footer say when the design does not.
            'empresa' => [
                'nombre' => $empresa?->nombre_empresa,
                'logo_url' => $empresa?->logo_empresa_url,
                'eslogan' => $empresa?->eslogan_empresa,
                'descripcion' => $empresa?->descripcion_empresa,
                'colaboracion' => $empresa?->colaboracion_empresa,
                'redes' => collect($empresa?->redes ?? [])->map(fn (array $red): array => [...$red, 'id' => DisenoCatalogo::idRed($red)])->all(),
            ],
            'redesDisponibles' => RedesSociales::catalogo(),
            'plantillas' => CatalogoPlantilla::orderBy('nombre')->get(['id', 'nombre']),
            'categorias' => Categoria::orderBy('nombre_categoria')->get(['id', 'nombre_categoria']),
        ]);
    }

    /**
     * @return array{nombre: string, bloques: list<array<string, mixed>>, columnas: int, encabezado: bool, pie: bool, ajustes: array<string, mixed>}
     */
    private function validar(Request $request): array
    {
        $datos = $request->validate([...$this->reglas(), 'nombre' => ['required', 'string', 'max:80']]);

        return [
            'nombre' => $datos['nombre'],
            'bloques' => DisenoCatalogo::normalizar($datos['bloques']),
            'columnas' => (int) $datos['columnas'],
            'encabezado' => (bool) $datos['encabezado'],
            'pie' => (bool) $datos['pie'],
            'ajustes' => DisenoCatalogo::normalizarAjustes($datos['ajustes'] ?? null),
        ];
    }

    /**
     * @return array<string, array<mixed>>
     */
    private function reglas(): array
    {
        return [
            'nombre' => ['nullable', 'string', 'max:80'],
            'columnas' => ['required', Rule::in([2, 3, 4])],
            'encabezado' => ['required', 'boolean'],
            'pie' => ['required', 'boolean'],
            ...DisenoCatalogo::reglas(),
            ...DisenoCatalogo::reglasAjustes(),
        ];
    }

    private function puedeVer(Request $request, string $precio): bool
    {
        return match ($precio) {
            'detal' => $request->user()->puedeVerPrecio('valor_detal'),
            'mayorista' => $request->user()->puedeVerPrecio('valor_mayorista'),
            default => true,
        };
    }
}
