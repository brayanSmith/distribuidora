<?php

namespace App\Modules\Administracion\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Administracion\Http\Requests\UpdateEmpresaRequest;
use App\Modules\Administracion\Models\Empresa;
use App\Support\RedesSociales;
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
            'redesDisponibles' => RedesSociales::catalogo(),
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
        $data = $request->safe()->except(['logo_empresa', 'remove_logo_empresa', 'icono_empresa', 'remove_icono_empresa', 'redes_sociales', 'redes_sociales_enviadas']);

        if ($request->boolean('redes_sociales_enviadas')) {
            $data['redes_sociales'] = $this->redes($request, $empresa);
        }

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
     * The networks as sent, in their order. A custom one keeps its uploaded
     * icon (a new file replaces it); icons no longer used are deleted.
     *
     * @return list<array{red: string, valor: string, nombre?: string, icono?: string}>|null
     */
    private function redes(UpdateEmpresaRequest $request, ?Empresa $empresa): ?array
    {
        $anteriores = collect($empresa?->redes_sociales ?? [])->pluck('icono')->filter()->values();
        $redes = [];

        foreach (array_values($request->input('redes_sociales', [])) as $indice => $red) {
            $personalizada = $red['red'] === RedesSociales::PERSONALIZADA;
            $icono = null;

            if ($personalizada && $request->hasFile("redes_sociales.{$indice}.icono_archivo")) {
                $icono = $request->file("redes_sociales.{$indice}.icono_archivo")->store('empresa/redes', 'public');
            } elseif ($personalizada && $anteriores->contains($red['icono'] ?? null)) {
                // Only an icon the company already had: never any other file.
                $icono = $red['icono'];
            }

            $redes[] = array_filter([
                'red' => $red['red'],
                'valor' => trim($red['valor']),
                'nombre' => $personalizada ? trim((string) ($red['nombre'] ?? '')) : null,
                'icono' => $icono,
            ], fn (?string $valor): bool => $valor !== null && $valor !== '');
        }

        Storage::disk('public')->delete($anteriores->diff(array_column($redes, 'icono'))->all());

        return $redes === [] ? null : $redes;
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
