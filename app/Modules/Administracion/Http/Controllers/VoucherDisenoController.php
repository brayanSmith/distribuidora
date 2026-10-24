<?php

namespace App\Modules\Administracion\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Administracion\Models\Empresa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Validation\Rule;
use Inertia\Inertia;
use Inertia\Response;

/**
 * The designer of the printed voucher: which blocks it has, in which
 * order, and how each one looks.
 */
class VoucherDisenoController extends Controller
{
    /** The kinds of block a voucher can have (as the designer knows them). */
    private const TIPOS = ['logo', 'empresa', 'turno', 'remision', 'fecha_vendedor', 'cliente', 'observaciones', 'entrega', 'productos', 'totales', 'texto'];

    public function edit(Request $request): Response
    {
        Gate::authorize('empresa.view');

        $empresa = Empresa::first();

        return Inertia::render('empresa/voucher', [
            'diseno' => $empresa?->diseno_voucher,
            // The company's real data, for a preview that looks like the real thing.
            'empresa' => [
                'nombre' => $empresa?->nombre_empresa,
                'direccion' => $empresa?->direccion_empresa,
                'telefono' => $empresa?->telefono_empresa,
                'nit' => $empresa?->nit_empresa,
                'logo_url' => $empresa?->logo_empresa_url,
                'formato_logo' => $empresa?->formato_logo ?? 'RECTANGULAR',
            ],
            'canUpdate' => $request->user()->can('empresa.update'),
        ]);
    }

    public function update(Request $request): RedirectResponse
    {
        Gate::authorize('empresa.update');

        $datos = $request->validate([
            'bloques' => ['present', 'array', 'max:40'],
            'bloques.*.id' => ['required', 'string', 'max:40'],
            'bloques.*.tipo' => ['required', Rule::in(self::TIPOS)],
            'bloques.*.visible' => ['required', 'boolean'],
            'bloques.*.alineacion' => ['required', Rule::in(['left', 'center', 'right'])],
            'bloques.*.tamano' => ['required', Rule::in(['pequeno', 'normal', 'grande'])],
            'bloques.*.linea' => ['required', 'boolean'],
            'bloques.*.texto' => ['nullable', 'string', 'max:600'],
            'bloques.*.campos' => ['nullable', 'array'],
            'bloques.*.campos.*' => ['boolean'],
        ]);

        $empresa = Empresa::first();

        abort_if($empresa === null, 422, 'Primero registra los datos de la empresa.');

        // An empty list means "back to the default design".
        $empresa->update([
            'diseno_voucher' => $datos['bloques'] === [] ? null : ['version' => 1, 'bloques' => $datos['bloques']],
        ]);

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Voucher design saved.')]);

        return back();
    }
}
