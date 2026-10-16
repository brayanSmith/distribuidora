<?php

namespace App\Modules;

use Illuminate\Support\Facades\Route;
use Illuminate\Support\ServiceProvider;

abstract class ModuleServiceProvider extends ServiceProvider
{
    /**
     * Absolute path of the module's directory.
     */
    abstract protected function modulePath(): string;

    public function boot(): void
    {
        Route::middleware(['web', 'auth', 'verified'])
            ->group($this->modulePath().'/routes.php');
    }
}
