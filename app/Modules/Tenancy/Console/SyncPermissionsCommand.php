<?php

namespace App\Modules\Tenancy\Console;

use App\Modules\Tenancy\Models\Tenant;
use Database\Seeders\PermissionSeeder;
use Illuminate\Console\Command;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;

class SyncPermissionsCommand extends Command
{
    protected $signature = 'permisos:sincronizar
        {--rol=* : Roles que reciben todos los permisos (por defecto, Owner)}';

    protected $description = 'Create the missing permissions and give all of them to the Owner role, in every tenant';

    public function handle(): int
    {
        $roles = $this->option('rol') ?: ['Owner'];

        if (config('multitenancy.tenant_finder') === null) {
            $this->sincronizar($roles);

            return self::SUCCESS;
        }

        Tenant::all()->each(function (Tenant $tenant) use ($roles): void {
            $tenant->execute(function () use ($tenant, $roles): void {
                $this->components->info("Tenant [{$tenant->name}]");
                $this->sincronizar($roles);
            });
        });

        return self::SUCCESS;
    }

    /**
     * @param  list<string>  $roles
     */
    private function sincronizar(array $roles): void
    {
        $this->callSilently('db:seed', ['--class' => PermissionSeeder::class, '--force' => true]);

        $permisos = Permission::pluck('name')->all();

        foreach ($roles as $nombre) {
            Role::findOrCreate($nombre, 'web')->syncPermissions($permisos);

            $this->components->twoColumnDetail($nombre, count($permisos).' permisos');
        }
    }
}
