<?php

namespace App\Support\Notificaciones;

use App\Support\Branding;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Notification;
use NotificationChannels\WebPush\WebPushChannel;
use NotificationChannels\WebPush\WebPushMessage;

/**
 * A notification shown by the operating system (Web Push), even with the
 * app closed. Each one says its title, text and the page it opens; sending
 * goes through the queue so it never slows down whoever triggered it.
 */
abstract class NotificacionPush extends Notification implements ShouldQueue
{
    use Queueable;

    abstract protected function titulo(object $notifiable): string;

    abstract protected function cuerpo(object $notifiable): string;

    /** The page it opens, relative so it works on every tenant's domain. */
    abstract protected function url(): string;

    /** Notifications with the same tag replace each other instead of piling up. */
    abstract protected function etiqueta(): string;

    /**
     * @return list<class-string>
     */
    public function via(object $notifiable): array
    {
        return [WebPushChannel::class];
    }

    public function toWebPush(object $notifiable, mixed $notification): WebPushMessage
    {
        return (new WebPushMessage)
            ->title($this->titulo($notifiable))
            ->body($this->cuerpo($notifiable))
            ->icon($this->icono())
            ->tag($this->etiqueta())
            ->renotify()
            ->lang('es')
            ->data(['url' => $this->url()])
            // Kept by the push service up to a day while the device is off.
            ->options(['TTL' => 86400]);
    }

    /**
     * The company icon (Empresas), or the app icon when there is none. Only
     * its path: the browser loads it from the tenant domain the app runs on.
     */
    protected function icono(): string
    {
        $icono = app(Branding::class)->iconoUrl();

        return $icono ? (parse_url($icono, PHP_URL_PATH) ?: $icono) : '/apple-touch-icon.png';
    }
}
