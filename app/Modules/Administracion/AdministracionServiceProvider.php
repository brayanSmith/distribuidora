<?php

namespace App\Modules\Administracion;

use App\Modules\ModuleServiceProvider;

class AdministracionServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
