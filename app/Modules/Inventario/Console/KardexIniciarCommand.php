<?php

namespace App\Modules\Inventario\Console;

use App\Modules\Inventario\Services\Kardex;
use App\Support\EnCadaTenant;
use Illuminate\Console\Command;

/**
 * Starts the kardex from the stock each bodega has today. Safe to run again:
 * balances that already have movements are left alone.
 */
class KardexIniciarCommand extends Command
{
    use EnCadaTenant;

    protected $signature = 'kardex:iniciar';

    protected $description = 'Create the starting movement of every stock balance that has none yet';

    public function handle(Kardex $kardex): int
    {
        $this->enCadaTenant(function () use ($kardex): void {
            $this->components->twoColumnDetail('Saldos iniciales creados', (string) $kardex->iniciar());
        });

        return self::SUCCESS;
    }
}
