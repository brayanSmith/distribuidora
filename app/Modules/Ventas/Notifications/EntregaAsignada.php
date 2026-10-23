<?php

namespace App\Modules\Ventas\Notifications;

use App\Modules\Ventas\Models\Entrega;
use Illuminate\Support\Facades\Notification;

/**
 * A delivery was given to someone to take: only they are told, with where
 * it goes and what to collect.
 */
class EntregaAsignada extends NuevaEntrega
{
    /**
     * Tells who takes it, also when they assigned it to themselves (whoever
     * sells and delivers gets the address and what to collect on their phone).
     */
    public static function avisar(Entrega $entrega): void
    {
        $mensajero = $entrega->mensajero;

        if ($mensajero === null || ! $mensajero->pushSubscriptions()->exists()) {
            return;
        }

        // Once it is saved: a rolled back sale tells nobody.
        Notification::send($mensajero, (new self($entrega))->afterCommit());
    }

    protected function titulo(object $notifiable): string
    {
        return 'Te asignaron una entrega';
    }
}
