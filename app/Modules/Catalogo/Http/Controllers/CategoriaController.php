<?php

namespace App\Modules\Catalogo\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Http\Requests\StoreCategoriaRequest;
use App\Modules\Catalogo\Http\Requests\UpdateCategoriaRequest;
use App\Modules\Catalogo\Models\Categoria;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class CategoriaController extends Controller
{
    /**
     * Display a listing of categorias.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('categorias.view');

        return Inertia::render('categorias/index', [
            'categorias' => Categoria::withCount(['subCategorias', 'productos'])->orderBy('nombre_categoria')->get(),
            'permissions' => [
                'canCreate' => $request->user()->can('categorias.create'),
                'canUpdate' => $request->user()->can('categorias.update'),
                'canDelete' => $request->user()->can('categorias.delete'),
            ],
        ]);
    }

    /**
     * Store a newly created categoria.
     */
    public function store(StoreCategoriaRequest $request): RedirectResponse
    {
        Gate::authorize('categorias.create');

        Categoria::create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Categoria created.')]);

        return back();
    }

    /**
     * Update the specified categoria.
     */
    public function update(UpdateCategoriaRequest $request, Categoria $categoria): RedirectResponse
    {
        Gate::authorize('categorias.update');

        $categoria->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Categoria updated.')]);

        return back();
    }

    /**
     * Remove the specified categoria.
     */
    public function destroy(Categoria $categoria): RedirectResponse
    {
        Gate::authorize('categorias.delete');

        if ($categoria->productos()->exists() || $categoria->subCategorias()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('This categoria cannot be deleted because it still has products or subcategorias associated with it.')]);

            return back();
        }

        $categoria->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Categoria deleted.')]);

        return back();
    }
}
