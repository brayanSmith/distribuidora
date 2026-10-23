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

    /**
     * The module's Artisan commands.
     *
     * @return list<class-string>
     */
    protected function consoleCommands(): array
    {
        return [];
    }

    public function boot(): void
    {
        Route::middleware(['web', 'auth', 'verified'])
            ->group($this->modulePath().'/routes.php');

        if ($this->app->runningInConsole()) {
            $this->commands($this->consoleCommands());
        }
    }
}
