<?php

namespace App\Modules\Tenancy;

use App\Modules\Tenancy\Console\CreateTenantCommand;
use App\Modules\Tenancy\Console\SyncPermissionsCommand;
use Illuminate\Support\ServiceProvider;

class TenancyServiceProvider extends ServiceProvider
{
    public function boot(): void
    {
        if ($this->app->runningInConsole()) {
            $this->commands([CreateTenantCommand::class, SyncPermissionsCommand::class]);
        }
    }
}
