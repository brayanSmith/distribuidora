<?php

namespace App\Modules\Administracion\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Administracion\Http\Requests\UpdateEmpresaRequest;
use App\Modules\Administracion\Models\Empresa;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\Storage;
use Inertia\Inertia;
use Inertia\Response;

class EmpresaController extends Controller
{
    /**
     * Show the company profile settings page.
     */
    public function edit(Request $request): Response
    {
        Gate::authorize('empresa.view');

        return Inertia::render('empresa/edit', [
            'empresa' => Empresa::first(),
            'permissions' => [
                'canUpdate' => $request->user()->can('empresa.update'),
            ],
        ]);
    }

    /**
     * Create or update the company profile.
     */
    public function update(UpdateEmpresaRequest $request): RedirectResponse
    {
        Gate::authorize('empresa.update');

        $empresa = Empresa::first();
        $data = $request->safe()->except(['logo_empresa', 'remove_logo_empresa', 'icono_empresa', 'remove_icono_empresa']);

        foreach (['logo_empresa', 'icono_empresa'] as $campo) {
            $data = [...$data, ...$this->imagen($request, $empresa, $campo)];
        }

        if ($empresa) {
            $empresa->update($data);
        } else {
            Empresa::create($data);
        }

        Inertia::flash('toast', ['type' => 'success', 'message' => __('Company profile updated.')]);

        return to_route('empresa.edit');
    }

    /**
     * A new image for the field (the old file is deleted), or none when it
     * was removed; nothing when it did not change.
     *
     * @return array<string, string|null>
     */
    private function imagen(UpdateEmpresaRequest $request, ?Empresa $empresa, string $campo): array
    {
        if ($request->hasFile($campo)) {
            if ($empresa?->{$campo}) {
                Storage::disk('public')->delete($empresa->{$campo});
            }

            return [$campo => $request->file($campo)->store('empresa', 'public')];
        }

        if ($request->boolean('remove_'.$campo) && $empresa?->{$campo}) {
            Storage::disk('public')->delete($empresa->{$campo});

            return [$campo => null];
        }

        return [];
    }
}
