<?php

namespace App\Modules\Tenancy\Actions;

use App\Modules\Tenancy\Models\Tenant;
use Database\Seeders\PermissionSeeder;
use Illuminate\Support\Facades\Artisan;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use InvalidArgumentException;

class ProvisionTenant
{
    /**
     * Register the tenant, create its database, run the tenant migrations
     * and seed its permissions.
     */
    public function execute(string $name, string $domain, ?string $database = null): Tenant
    {
        $database ??= 'tenant_'.Str::of($domain)->before('.')->slug('_');

        $this->createDatabase($database);

        $tenant = Tenant::create([
            'name' => $name,
            'domain' => $domain,
            'database' => $database,
        ]);

        $tenant->execute(function (): void {
            $connection = config('multitenancy.tenant_database_connection_name');

            Artisan::call('migrate', ['--database' => $connection, '--force' => true]);
            Artisan::call('db:seed', [
                '--class' => PermissionSeeder::class,
                '--database' => $connection,
                '--force' => true,
            ]);
        });

        return $tenant;
    }

    protected function createDatabase(string $database): void
    {
        $landlord = DB::connection(config('multitenancy.landlord_database_connection_name'));

        if ($landlord->getDriverName() === 'sqlite') {
            touch($database);

            return;
        }

        if (! preg_match('/^[A-Za-z0-9_]+$/', $database)) {
            throw new InvalidArgumentException("Invalid database name [{$database}].");
        }

        $landlord->statement("CREATE DATABASE IF NOT EXISTS `{$database}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
    }
}
