<?php

namespace App\Modules\Ventas\Console;

use App\Models\User;
use App\Modules\Ventas\Models\Entrega;
use App\Modules\Ventas\Notifications\EntregasPendientes;
use App\Support\EnCadaTenant;
use App\Support\Notificaciones\Destinatarios;
use Illuminate\Console\Command;

/**
 * Sends each user that handles deliveries a summary of the ones still
 * pending in their bodegas (scheduled every morning).
 */
class AvisarEntregasPendientesCommand extends Command
{
    use EnCadaTenant;

    protected $signature = 'entregas:avisar-pendientes';

    protected $description = 'Send a push notification with the pending deliveries to whoever handles them';

    public function handle(): int
    {
        $this->enCadaTenant(function (): void {
            $avisados = 0;

            Destinatarios::conPermiso('entregas.view')->each(function (User $usuario) use (&$avisados): void {
                $conteo = $this->conteo($usuario);

                if ($conteo['porDespachar'] + $conteo['enCamino'] + $conteo['devueltas'] > 0) {
                    $usuario->notify(new EntregasPendientes($conteo));
                    $avisados++;
                }
            });

            $this->components->twoColumnDetail('Usuarios avisados', (string) $avisados);
        });

        return self::SUCCESS;
    }

    /**
     * @return array{porDespachar: int, enCamino: int, devueltas: int, atrasadas: int}
     */
    private function conteo(User $usuario): array
    {
        $porEstado = Entrega::visiblesPara($usuario)
            ->whereIn('estado', Entrega::PENDIENTES)
            ->selectRaw('estado, count(*) as total')
            ->groupBy('estado')
            ->pluck('total', 'estado');

        return [
            'porDespachar' => (int) ($porEstado[Entrega::POR_DESPACHAR] ?? 0),
            'enCamino' => (int) ($porEstado[Entrega::EN_CAMINO] ?? 0),
            'devueltas' => (int) ($porEstado[Entrega::DEVUELTO] ?? 0),
            'atrasadas' => Entrega::visiblesPara($usuario)
                ->whereIn('estado', Entrega::ACTIVAS)
                ->whereDate('fecha_programada', '<', today())
                ->count(),
        ];
    }
}
