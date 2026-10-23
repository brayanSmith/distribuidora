<?php

namespace App\Modules\Ventas;

use App\Modules\ModuleServiceProvider;
use App\Modules\Ventas\Console\AvisarEntregasPendientesCommand;

class VentasServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }

    protected function consoleCommands(): array
    {
        return [AvisarEntregasPendientesCommand::class];
    }
}
