<?php

namespace App\Modules\Compras;

use App\Modules\Compras\Console\AvisarCuentasPorPagarCommand;
use App\Modules\ModuleServiceProvider;

class ComprasServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }

    protected function consoleCommands(): array
    {
        return [AvisarCuentasPorPagarCommand::class];
    }
}
