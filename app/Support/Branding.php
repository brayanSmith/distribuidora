<?php

namespace App\Support;

use App\Modules\Administracion\Models\Empresa;

/**
 * The company saved in "Empresas" brands the app: its name replaces the
 * framework name, its icon is the app icon and its logo goes on what is printed. Resolved once per request
 * (scoped binding) and shared by the Inertia props and the root Blade view.
 */
class Branding
{
    private ?Empresa $empresa = null;

    private bool $cargada = false;

    public function name(): string
    {
        return $this->empresa()?->nombre_empresa ?: config('app.name', 'Laravel');
    }

    public function logoUrl(): ?string
    {
        return $this->empresa()?->logo_empresa_url;
    }

    /**
     * The square icon (browser tab, sidebar, notifications); the logo while
     * no icon was uploaded.
     */
    public function iconoUrl(): ?string
    {
        return $this->empresa()?->icono_empresa_url ?? $this->logoUrl();
    }

    private function empresa(): ?Empresa
    {
        if (! $this->cargada) {
            $this->empresa = Empresa::first();
            $this->cargada = true;
        }

        return $this->empresa;
    }
}
