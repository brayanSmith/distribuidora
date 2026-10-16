<?php

namespace App\Modules\Administracion\Models;

use App\Modules\Inventario\Models\Bodega;
use App\Models\Concerns\LogsCambios;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Spatie\Permission\Models\Role as SpatieRole;

class Role extends SpatieRole
{
    use LogsCambios;

    /**
     * @return list<string>
     */
    protected function logCampos(): array
    {
        return ['name'];
    }

    /**
     * @return array{0: string, 1: bool}
     */
    protected function logEtiqueta(): array
    {
        return ['Rol', false];
    }

    /**
     * Whether the permission belongs to the previous (Filament) system, whose
     * permissions are named "Accion:Recurso" and share the same tables.
     */
    public static function esPermisoLegacy(string $permiso): bool
    {
        return str_contains($permiso, ':');
    }

    /**
     * Replaces the role's permissions of this app, keeping the ones of the
     * previous system, which that system still relies on.
     *
     * @param  list<string>  $permisos
     */
    public function syncPermisosApp(array $permisos): void
    {
        $legacy = $this->permissions()->pluck('name')->filter(fn (string $permiso) => self::esPermisoLegacy($permiso));

        $this->syncPermissions([
            ...array_filter($permisos, fn (string $permiso) => ! self::esPermisoLegacy($permiso)),
            ...$legacy,
        ]);
    }

    /**
     * What the role grants, as names: its permissions and its bodegas.
     *
     * @return array{permisos: list<string>, bodegas: list<string>}
     */
    public function acceso(): array
    {
        $this->unsetRelation('permissions');
        $this->unsetRelation('bodegas');

        return [
            'permisos' => $this->permissions()->pluck('name')->sort()->values()->all(),
            'bodegas' => $this->bodegas()->orderBy('nombre_bodega')->pluck('nombre_bodega')->all(),
        ];
    }

    /**
     * Writes to the history what changed in the permissions and bodegas of
     * the role (only what was added or removed).
     *
     * @param  array{permisos: list<string>, bodegas: list<string>}|null  $antes  Null when the role is new.
     */
    public function registrarCambioAcceso(?array $antes): void
    {
        $despues = $this->acceso();
        $antes ??= ['permisos' => [], 'bodegas' => []];

        if ($antes === $despues) {
            return;
        }

        activity('roles')
            ->performedOn($this)
            ->event('acceso')
            ->withProperties([
                'old' => ['permisos' => $antes['permisos'], 'bodegas' => $antes['bodegas']],
                'attributes' => ['permisos' => $despues['permisos'], 'bodegas' => $despues['bodegas']],
            ])
            ->log('Permisos y bodegas del rol modificados');
    }

    /**
     * Bodegas a las que este rol tiene acceso. Un rol sin bodegas asociadas
     * se interpreta como "sin restricción" (ve todas las bodegas).
     */
    public function bodegas(): BelongsToMany
    {
        return $this->belongsToMany(Bodega::class, 'bodega_role');
    }
}
