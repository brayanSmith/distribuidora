<?php

namespace App\Modules\Compras\Notifications;

use App\Modules\Compras\Models\Compra;
use App\Support\Notificaciones\NotificacionPush;

/**
 * The compras already overdue or due soon, so the proveedores get paid on
 * time without opening the app to check.
 */
class CuentasPorPagarPorVencer extends NotificacionPush
{
    /**
     * @param  array{vencidas: int, totalVencidas: float, proximas: int, totalProximas: float}  $resumen
     */
    public function __construct(public array $resumen) {}

    protected function titulo(object $notifiable): string
    {
        return $this->resumen['vencidas'] > 0
            ? 'Cuentas por pagar vencidas'
            : 'Cuentas por pagar por vencer';
    }

    protected function cuerpo(object $notifiable): string
    {
        $lineas = [];

        if ($this->resumen['vencidas'] > 0) {
            $lineas[] = $this->linea($this->resumen['vencidas'], $this->resumen['totalVencidas'], 'vencida', 'vencidas');
        }

        if ($this->resumen['proximas'] > 0) {
            $lineas[] = $this->linea(
                $this->resumen['proximas'],
                $this->resumen['totalProximas'],
                'vence en los próximos '.Compra::DIAS_PROXIMOS_A_VENCER.' días',
                'vencen en los próximos '.Compra::DIAS_PROXIMOS_A_VENCER.' días',
            );
        }

        return implode("\n", $lineas);
    }

    protected function url(): string
    {
        return route('compras.cuentas-por-pagar', absolute: false);
    }

    protected function etiqueta(): string
    {
        return 'cuentas-por-pagar';
    }

    /** "2 compras vencidas: $1.250.000". */
    private function linea(int $cantidad, float $total, string $singular, string $plural): string
    {
        return $cantidad === 1
            ? "1 compra {$singular}: $".number_format($total, 0, ',', '.')
            : "{$cantidad} compras {$plural}: $".number_format($total, 0, ',', '.');
    }
}
