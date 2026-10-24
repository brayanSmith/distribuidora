<?php

namespace App\Support\Importaciones;

use App\Modules\Catalogo\Models\Importacion;
use App\Support\Notificaciones\NotificacionPush;

/**
 * An import running in the background finished, well or not: whoever
 * started it finds out without staying on the app.
 */
class ImportacionTerminada extends NotificacionPush
{
    public function __construct(public Importacion $importacion) {}

    /**
     * Tells whoever started the import, if they turned notifications on.
     */
    public static function avisar(Importacion $importacion): void
    {
        $usuario = $importacion->user;

        if ($usuario?->pushSubscriptions()->exists()) {
            $usuario->notify(new self($importacion));
        }
    }

    protected function titulo(object $notifiable): string
    {
        $tipo = TiposImportacion::etiqueta($this->importacion->tipo);

        if ($this->importacion->estado === Importacion::FALLIDA) {
            return "Falló la importación de {$tipo}";
        }

        return $this->importacion->con_error > 0
            ? "Importación de {$tipo} terminada con errores"
            : "Importación de {$tipo} completada";
    }

    protected function cuerpo(object $notifiable): string
    {
        $archivo = $this->importacion->nombre_original;

        if ($this->importacion->estado === Importacion::FALLIDA) {
            $motivo = $this->importacion->errores[0]['mensaje'] ?? 'No se pudo procesar el archivo.';

            return "{$archivo}\n{$motivo}";
        }

        $partes = array_filter([
            "{$this->importacion->creados} creados",
            "{$this->importacion->actualizados} actualizados",
            $this->importacion->con_error > 0 ? "{$this->importacion->con_error} con error" : null,
        ]);

        return "{$archivo}\n".implode(' · ', $partes);
    }

    /** Opens the app with the import's result on screen. */
    protected function url(): string
    {
        return route('dashboard', ['importaciones' => 1], absolute: false);
    }

    protected function etiqueta(): string
    {
        return 'importacion-'.$this->importacion->id;
    }
}
