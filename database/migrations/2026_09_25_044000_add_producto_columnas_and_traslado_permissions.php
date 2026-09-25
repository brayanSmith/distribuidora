<?php

use App\Models\Role;
use Illuminate\Database\Migrations\Migration;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * New permission => the permission whose roles get it, so everybody keeps
     * seeing what they saw until someone turns it off from the roles page.
     *
     * @var array<string, string>
     */
    private array $herencia = [
        'productos.view-stock-total' => 'productos.view',
        'productos.view-pendiente' => 'productos.view',
        'productos.view-almacen-p' => 'productos.view',
        'productos.view-sin-instalacion' => 'productos.view',
        'productos.view-stock-bodegas' => 'productos.view',
        'productos.view-sin-stock' => 'productos.view',
        'stock-bodegas.create-traslado' => 'traslados.create',
    ];

    public function up(): void
    {
        foreach ($this->herencia as $nuevo => $origen) {
            $permiso = Permission::findOrCreate($nuevo, 'web');

            Role::query()
                ->whereHas('permissions', fn ($query) => $query->where('name', $origen))
                ->get()
                ->each(fn (Role $role) => $role->givePermissionTo($permiso));
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        Permission::whereIn('name', array_keys($this->herencia))->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }
};
