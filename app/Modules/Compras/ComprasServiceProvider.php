<?php

namespace App\Modules\Compras;

use App\Modules\ModuleServiceProvider;

class ComprasServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
