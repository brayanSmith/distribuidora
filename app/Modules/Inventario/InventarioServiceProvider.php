<?php

namespace App\Modules\Inventario;

use App\Modules\Inventario\Console\KardexIniciarCommand;
use App\Modules\Inventario\Console\KardexRecalcularCommand;
use App\Modules\ModuleServiceProvider;

class InventarioServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }

    protected function consoleCommands(): array
    {
        return [KardexIniciarCommand::class, KardexRecalcularCommand::class];
    }
}
