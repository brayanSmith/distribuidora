<?php

namespace App\Support;

use App\Modules\Tenancy\Models\Tenant;

/**
 * For console commands that work on each company's data: runs the work in
 * every tenant, or once when the app runs without tenancy (tests).
 */
trait EnCadaTenant
{
    protected function enCadaTenant(callable $trabajo): void
    {
        if (config('multitenancy.tenant_finder') === null) {
            $trabajo();

            return;
        }

        Tenant::all()->each(fn (Tenant $tenant) => $tenant->execute(function () use ($tenant, $trabajo): void {
            $this->components->info("Tenant [{$tenant->name}]");
            $trabajo();
        }));
    }
}
