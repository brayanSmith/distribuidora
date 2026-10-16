<?php

use App\Modules\Finanzas\FinanzasServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\FortifyServiceProvider;

return [
    AppServiceProvider::class,
    FortifyServiceProvider::class,
    FinanzasServiceProvider::class,
];
