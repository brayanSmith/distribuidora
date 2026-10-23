<?php

namespace App\Modules\Ventas\Notifications;

use App\Support\Notificaciones\NotificacionPush;

/**
 * The day's summary of what is still to deliver, so nobody has to open the
 * app to find out.
 */
class EntregasPendientes extends NotificacionPush
{
    /**
     * @param  array{porDespachar: int, enCamino: int, devueltas: int, atrasadas: int}  $conteo
     */
    public function __construct(public array $conteo) {}

    protected function titulo(object $notifiable): string
    {
        $total = $this->conteo['porDespachar'] + $this->conteo['enCamino'] + $this->conteo['devueltas'];

        return $total === 1 ? '1 entrega pendiente' : "{$total} entregas pendientes";
    }

    protected function cuerpo(object $notifiable): string
    {
        $partes = array_filter([
            $this->conteo['porDespachar'] ? "{$this->conteo['porDespachar']} por despachar" : null,
            $this->conteo['enCamino'] ? "{$this->conteo['enCamino']} en camino" : null,
            $this->conteo['devueltas'] ? "{$this->conteo['devueltas']} devueltas sin resolver" : null,
        ]);

        $cuerpo = implode(' · ', $partes);

        if ($this->conteo['atrasadas'] > 0) {
            $cuerpo .= "\n⚠ {$this->conteo['atrasadas']} ya pasaron su fecha de entrega";
        }

        return $cuerpo;
    }

    protected function url(): string
    {
        return route('entregas.index', absolute: false);
    }

    protected function etiqueta(): string
    {
        return 'entregas-pendientes';
    }
}
