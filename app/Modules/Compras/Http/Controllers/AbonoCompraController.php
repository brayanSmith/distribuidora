<?php

namespace App\Modules\Compras\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Compras\Models\AbonoCompra;
use App\Modules\Compras\Models\Compra;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Inertia\Inertia;

/**
 * Payments made to the proveedor of a compra after it was registered.
 */
class AbonoCompraController extends Controller
{
    public function store(Request $request, Compra $compra): RedirectResponse
    {
        Gate::authorize('compras.create-abono');

        $datos = $request->validate([
            'puc_id' => ['required', 'integer', 'exists:pucs,id'],
            // Never more than what is still owed.
            'monto' => ['required', 'numeric', 'min:0.01', 'max:'.(float) $compra->saldo_pendiente],
            'descripcion' => ['nullable', 'string', 'max:255'],
        ], [
            'monto.max' => __('The payment is more than what is still owed.'),
        ]);

        $compra->abonos()->create($datos + [
            'fecha' => now(),
            'user_id' => $request->user()->id,
        ]);
        $compra->recalcularPagos();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Payment registered.')]);

        return back();
    }

    public function destroy(Compra $compra, AbonoCompra $abono): RedirectResponse
    {
        Gate::authorize('compras.delete-abono');
        abort_unless($abono->compra_id === $compra->id, 404);

        $abono->delete();
        $compra->recalcularPagos();

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Payment deleted.')]);

        return back();
    }
}
