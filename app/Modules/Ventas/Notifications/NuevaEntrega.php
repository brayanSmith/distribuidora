<?php

namespace App\Modules\Ventas\Notifications;

use App\Models\User;
use App\Modules\Ventas\Models\Entrega;
use App\Support\Notificaciones\Destinatarios;
use App\Support\Notificaciones\NotificacionPush;
use Illuminate\Support\Facades\Notification;

/**
 * A contra entrega pedido was sold: there is something new to dispatch.
 */
class NuevaEntrega extends NotificacionPush
{
    public function __construct(public Entrega $entrega) {}

    /**
     * Tells who takes it, when it is assigned; otherwise whoever handles
     * deliveries of the pedido's bodega (but not who sold it).
     */
    public static function avisar(Entrega $entrega): void
    {
        // Someone already takes it: only they need to know.
        if ($entrega->mensajero_id !== null) {
            EntregaAsignada::avisar($entrega);

            return;
        }

        $pedido = $entrega->pedido;

        $destinatarios = Destinatarios::conPermiso('entregas.view')
            ->reject(fn (User $usuario): bool => $usuario->id === $pedido->user_id)
            ->filter(fn (User $usuario): bool => in_array($pedido->bodega_id, $usuario->idsBodegasPermitidas() ?? [$pedido->bodega_id]));

        if ($destinatarios->isNotEmpty()) {
            // Once the sale is saved: a rolled back sale tells nobody.
            Notification::send($destinatarios, (new self($entrega))->afterCommit());
        }
    }

    protected function titulo(object $notifiable): string
    {
        return 'Nueva entrega por despachar';
    }

    protected function cuerpo(object $notifiable): string
    {
        $pedido = $this->entrega->pedido;
        $lineas = [
            "Pedido #{$pedido->id} · ".($pedido->cliente?->razon_social ?? 'Sin cliente'),
            $this->entrega->direccion.($this->entrega->ciudad ? ', '.$this->entrega->ciudad : ''),
        ];

        if ($this->entrega->fecha_programada !== null) {
            $lineas[] = 'Entregar el '.$this->entrega->fecha_programada->format('d/m/Y');
        }

        if ((float) $pedido->saldo_pendiente > 0) {
            $lineas[] = 'Cobrar $'.number_format((float) $pedido->saldo_pendiente, 0, ',', '.');
        }

        return implode("\n", $lineas);
    }

    protected function url(): string
    {
        return route('entregas.index', absolute: false);
    }

    protected function etiqueta(): string
    {
        return 'entrega-'.$this->entrega->id;
    }
}
