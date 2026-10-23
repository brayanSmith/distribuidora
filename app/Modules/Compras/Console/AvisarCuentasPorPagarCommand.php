<?php

namespace App\Modules\Compras\Console;

use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Notifications\CuentasPorPagarPorVencer;
use App\Support\EnCadaTenant;
use App\Support\Notificaciones\Destinatarios;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Notification;

/**
 * Tells whoever sees the compras which ones are overdue or due soon
 * (scheduled every morning). Nothing is sent when everything is up to date.
 */
class AvisarCuentasPorPagarCommand extends Command
{
    use EnCadaTenant;

    protected $signature = 'cuentas-por-pagar:avisar';

    protected $description = 'Send a push notification with the compras overdue or due soon';

    public function handle(): int
    {
        $this->enCadaTenant(function (): void {
            $resumen = [
                'vencidas' => Compra::vencidas()->count(),
                'totalVencidas' => round((float) Compra::vencidas()->sum('saldo_pendiente'), 2),
                'proximas' => Compra::proximasAVencer()->count(),
                'totalProximas' => round((float) Compra::proximasAVencer()->sum('saldo_pendiente'), 2),
            ];

            $destinatarios = $resumen['vencidas'] + $resumen['proximas'] > 0
                ? Destinatarios::conPermiso('compras.view')
                : collect();

            Notification::send($destinatarios, new CuentasPorPagarPorVencer($resumen));

            $this->components->twoColumnDetail('Usuarios avisados', (string) $destinatarios->count());
        });

        return self::SUCCESS;
    }
}
