<?php

namespace App\Modules\Inventario;

use App\Modules\ModuleServiceProvider;

class InventarioServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
