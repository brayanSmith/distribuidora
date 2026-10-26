<?php

namespace App\Modules\Catalogo\Notifications;

use App\Modules\Catalogo\Models\CatalogoPdf;
use App\Support\Notificaciones\NotificacionPush;

/**
 * A catalog PDF finished (or failed): whoever asked for it finds out without
 * staying on the app, and opens it from the notification.
 */
class CatalogoTerminado extends NotificacionPush
{
    public function __construct(public CatalogoPdf $catalogo) {}

    /**
     * Tells whoever asked for the catalog, if they turned notifications on.
     */
    public static function avisar(CatalogoPdf $catalogo): void
    {
        $usuario = $catalogo->user;

        if ($usuario?->pushSubscriptions()->exists()) {
            $usuario->notify(new self($catalogo));
        }
    }

    protected function titulo(object $notifiable): string
    {
        return $this->catalogo->estado === CatalogoPdf::COMPLETADO
            ? 'Catálogo listo'
            : 'No se pudo generar el catálogo';
    }

    protected function cuerpo(object $notifiable): string
    {
        return $this->catalogo->estado === CatalogoPdf::COMPLETADO
            ? "{$this->catalogo->total_productos} productos. Toca para descargarlo."
            : 'Inténtalo de nuevo; si se repite, revisa la configuración del servidor.';
    }

    protected function url(): string
    {
        return $this->catalogo->estado === CatalogoPdf::COMPLETADO
            ? route('catalogo-pdf.descargar', $this->catalogo, absolute: false)
            : route('dashboard', absolute: false);
    }

    protected function etiqueta(): string
    {
        return 'catalogo-'.$this->catalogo->id;
    }
}
