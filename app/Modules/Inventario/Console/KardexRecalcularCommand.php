<?php

namespace App\Modules\Inventario\Console;

use App\Modules\Inventario\Services\Kardex;
use App\Support\EnCadaTenant;
use Illuminate\Console\Command;

/**
 * Checks that each bodega's stock is what its movements add up to and, unless
 * only asked to check, fixes the ones that don't match.
 */
class KardexRecalcularCommand extends Command
{
    use EnCadaTenant;

    protected $signature = 'kardex:recalcular {--revisar : Only list the differences, without fixing them}';

    protected $description = 'Rebuild each stock balance from its kardex movements';

    public function handle(Kardex $kardex): int
    {
        $corregir = ! $this->option('revisar');

        $this->enCadaTenant(function () use ($kardex, $corregir): void {
            $diferencias = $kardex->recalcular($corregir);

            if ($diferencias === []) {
                $this->components->info('Todo cuadra con los movimientos.');

                return;
            }

            $this->table(
                ['Producto', 'Bodega', 'Stock', 'Según movimientos'],
                array_map(fn (array $fila): array => [$fila['producto_id'], $fila['bodega_id'], $fila['antes'], $fila['despues']], $diferencias),
            );
            $this->components->warn(count($diferencias).($corregir ? ' saldos corregidos.' : ' saldos no cuadran.'));
        });

        return self::SUCCESS;
    }
}
