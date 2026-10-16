<?php

namespace App\Modules\Catalogo;

use App\Modules\ModuleServiceProvider;

class CatalogoServiceProvider extends ModuleServiceProvider
{
    protected function modulePath(): string
    {
        return __DIR__;
    }
}
