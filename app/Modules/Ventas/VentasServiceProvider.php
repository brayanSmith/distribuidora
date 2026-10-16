<?php

namespace App\Modules\Ventas;

use App\Modules\ModuleServiceProvider;

class VentasServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
