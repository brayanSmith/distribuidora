<?php

namespace App\Modules\Finanzas;

use App\Modules\ModuleServiceProvider;

class FinanzasServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
