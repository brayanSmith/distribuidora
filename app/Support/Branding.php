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

    /**
     * The app's colors the company chose for everyone (null keeps the app's
     * own, set in app.css). The same for every user.
     *
     * @return array{menu: ?string, plataforma: ?string, plataforma_oscuro: ?string}
     */
    public function tema(): array
    {
        return [
            'menu' => $this->empresa()?->color_menu,
            'plataforma' => $this->empresa()?->color_plataforma,
            'plataforma_oscuro' => $this->empresa()?->color_plataforma_oscuro,
        ];
    }

    /**
     * The company's colors as CSS variable overrides, for the first paint (the
     * browser keeps them up to date afterwards: resources/js/hooks/use-theme-color.ts).
     */
    public function temaCss(): string
    {
        ['menu' => $menu, 'plataforma' => $plataforma, 'plataforma_oscuro' => $oscuro] = $this->tema();

        $claro = $plataforma ? self::reglasPlataforma($plataforma) : [];

        if ($menu) {
            $sobreOscuro = Empresa::textoSobre($menu) === '#ffffff';

            array_push(
                $claro,
                "--sidebar: {$menu}",
                '--sidebar-foreground: '.Empresa::textoSobre($menu),
                '--sidebar-accent: '.($sobreOscuro ? 'rgb(255 255 255 / 0.14)' : 'rgb(0 0 0 / 0.07)'),
                '--sidebar-accent-foreground: '.Empresa::textoSobre($menu),
                '--sidebar-border: '.($sobreOscuro ? 'rgb(255 255 255 / 0.18)' : 'rgb(0 0 0 / 0.1)'),
            );
        }

        $bloques = array_filter([
            $claro !== [] ? ':root:not(.dark) { '.implode('; ', $claro).'; }' : null,
            $oscuro ? ':root.dark { '.implode('; ', self::reglasPlataforma($oscuro)).'; }' : null,
        ]);

        return implode("\n", $bloques);
    }

    /**
     * The "platform color" bundle: buttons, selected menu item, focus ring.
     *
     * @return list<string>
     */
    private static function reglasPlataforma(string $color): array
    {
        $texto = Empresa::textoSobre($color);

        return [
            "--primary: {$color}",
            "--primary-foreground: {$texto}",
            "--sidebar-primary: {$color}",
            "--sidebar-primary-foreground: {$texto}",
            "--ring: {$color}",
        ];
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
