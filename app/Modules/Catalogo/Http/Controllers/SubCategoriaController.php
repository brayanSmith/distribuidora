<?php

namespace App\Modules\Catalogo\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Http\Requests\StoreSubCategoriaRequest;
use App\Modules\Catalogo\Http\Requests\UpdateSubCategoriaRequest;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\SubCategoria;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;
use Inertia\Response;

class SubCategoriaController extends Controller
{
    /**
     * Display a listing of subcategorias.
     */
    public function index(Request $request): Response
    {
        Gate::authorize('sub-categorias.view');

        return Inertia::render('sub-categorias/index', [
            'subCategorias' => SubCategoria::with('categoria:id,nombre_categoria')
                ->withCount('productos')
                ->orderBy('nombre_sub_categoria')
                ->get(),
            'categorias' => Categoria::orderBy('nombre_categoria')->get(['id', 'nombre_categoria']),
            'permissions' => [
                'canCreate' => $request->user()->can('sub-categorias.create'),
                'canUpdate' => $request->user()->can('sub-categorias.update'),
                'canDelete' => $request->user()->can('sub-categorias.delete'),
            ],
        ]);
    }

    /**
     * Store a newly created subcategoria.
     */
    public function store(StoreSubCategoriaRequest $request): RedirectResponse
    {
        Gate::authorize('sub-categorias.create');

        SubCategoria::create($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Subcategoria created.')]);

        return back();
    }

    /**
     * Update the specified subcategoria.
     */
    public function update(UpdateSubCategoriaRequest $request, SubCategoria $subCategoria): RedirectResponse
    {
        Gate::authorize('sub-categorias.update');

        $subCategoria->update($request->validated());

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Subcategoria updated.')]);

        return back();
    }

    /**
     * Remove the specified subcategoria.
     */
    public function destroy(SubCategoria $subCategoria): RedirectResponse
    {
        Gate::authorize('sub-categorias.delete');

        if ($subCategoria->productos()->exists()) {
            Inertia::flash('toast', ['type' => 'error', 'message' => __('This subcategoria cannot be deleted because it still has products associated with it.')]);

            return back();
        }

        $subCategoria->delete();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Subcategoria deleted.')]);

        return back();
    }
}
