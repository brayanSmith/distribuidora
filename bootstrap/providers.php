<?php

use App\Modules\Administracion\AdministracionServiceProvider;
use App\Modules\Catalogo\CatalogoServiceProvider;
use App\Modules\Compras\ComprasServiceProvider;
use App\Modules\Finanzas\FinanzasServiceProvider;
use App\Modules\Inventario\InventarioServiceProvider;
use App\Modules\Tenancy\TenancyServiceProvider;
use App\Modules\Ventas\VentasServiceProvider;
use App\Providers\AppServiceProvider;
use App\Providers\FortifyServiceProvider;

return [
    AppServiceProvider::class,
    FortifyServiceProvider::class,
    AdministracionServiceProvider::class,
    CatalogoServiceProvider::class,
    ComprasServiceProvider::class,
    FinanzasServiceProvider::class,
    InventarioServiceProvider::class,
    TenancyServiceProvider::class,
    VentasServiceProvider::class,
];
