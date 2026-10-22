<?php

namespace App\Modules\Catalogo\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Models\Producto;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Updates only the sale prices of a producto, from screens like the compras
 * POS where they are adjusted while buying. A price the user may not see is
 * never changed.
 */
class ProductoPreciosController extends Controller
{
    public function __invoke(Request $request, Producto $producto): RedirectResponse
    {
        Gate::authorize('productos.update');

        $datos = $request->validate([
            'valor_detal' => ['nullable', 'numeric', 'min:0'],
            'valor_mayorista' => ['nullable', 'numeric', 'min:0'],
        ]);

        $usuario = $request->user();
        $permitidos = array_filter([
            'valor_detal' => $usuario->puedeVerPrecio('valor_detal'),
            'valor_mayorista' => $usuario->puedeVerPrecio('valor_mayorista'),
        ]);
        $cambios = array_filter(
            array_intersect_key($datos, $permitidos),
            fn (mixed $valor): bool => $valor !== null,
        );

        if ($cambios !== []) {
            $producto->update($cambios);
            Inertia::flash('toast', ['type' => 'success', 'message' => __('Prices updated.')]);
        }

        return back();
    }
}
