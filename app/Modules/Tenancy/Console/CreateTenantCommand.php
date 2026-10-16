<?php

namespace App\Modules\Tenancy\Console;

use App\Modules\Tenancy\Actions\ProvisionTenant;
use Illuminate\Console\Command;

class CreateTenantCommand extends Command
{
    protected $signature = 'tenancy:create
        {name : Business name}
        {domain : Domain that serves this tenant (e.g. mi-distribuidora.test or localhost)}
        {--database= : Database name (defaults to tenant_<first label of the domain>)}';

    protected $description = 'Create a tenant: register it, create its database, migrate and seed it';

    public function handle(ProvisionTenant $provisionTenant): int
    {
        $tenant = $provisionTenant->execute(
            $this->argument('name'),
            $this->argument('domain'),
            $this->option('database'),
        );

        $this->components->info("Tenant [{$tenant->name}] ready at {$tenant->domain} (database {$tenant->database}).");

        return self::SUCCESS;
    }
}
