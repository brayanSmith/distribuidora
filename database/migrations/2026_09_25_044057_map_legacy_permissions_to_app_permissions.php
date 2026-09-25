<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\PermissionRegistrar;

return new class extends Migration
{
    /**
     * Only on a database coming from the previous (Filament) system: its roles
     * hold Filament Shield permissions ("ViewAny:ProductoResource") that this
     * app does not know, so each role gets this app's equivalent permissions.
     * The Filament permissions are kept, since that system may still use them.
     */
    public function up(): void
    {
        if (! DB::table('migrations')->where('migration', '2025_11_28_152404_create_permission_tables')->exists()) {
            return;
        }

        $equivalencias = $this->equivalencias();

        $permisoIds = collect($equivalencias)
            ->flatten()
            ->unique()
            ->mapWithKeys(fn (string $nombre) => [$nombre => Permission::findOrCreate($nombre, 'web')->id]);

        $permisosApp = DB::table('permissions')->where('name', 'not like', '%:%')->pluck('id');

        foreach (DB::table('roles')->get() as $role) {
            $permisosLegacy = DB::table('role_has_permissions')
                ->join('permissions', 'permissions.id', '=', 'role_has_permissions.permission_id')
                ->where('role_has_permissions.role_id', $role->id)
                ->pluck('permissions.name');

            $nuevos = $role->name === 'super_admin'
                ? $permisosApp->merge($permisoIds->values())
                : $permisosLegacy
                    ->flatMap(fn (string $nombre) => $equivalencias[$nombre] ?? [])
                    ->map(fn (string $nombre) => $permisoIds[$nombre]);

            DB::table('role_has_permissions')
                ->where('role_id', $role->id)
                ->whereIn('permission_id', $permisosApp->merge($permisoIds->values()))
                ->delete();

            DB::table('role_has_permissions')->insertOrIgnore(
                $nuevos->unique()->map(fn (int $permisoId) => ['permission_id' => $permisoId, 'role_id' => $role->id])->values()->all(),
            );
        }

        app(PermissionRegistrar::class)->forgetCachedPermissions();
    }

    public function down(): void
    {
        //
    }

    /**
     * Filament permission => this app's permissions.
     *
     * @return array<string, list<string>>
     */
    private function equivalencias(): array
    {
        $recursos = [
            'ClienteResource' => ['clientes', ['view', 'create', 'update', 'delete', 'view-deleted', 'restore']],
            'UserResource' => ['usuarios', ['view', 'create', 'update', 'delete']],
            'BodegaResource' => ['bodegas', ['view', 'create', 'update', 'delete']],
            'ProveedorResource' => ['proveedores', ['view', 'create', 'update', 'delete', 'view-deleted', 'restore']],
            'MarcaResource' => ['marcas', ['view', 'create', 'update', 'delete']],
            'PucResource' => ['puc', ['view', 'create', 'update', 'delete']],
            'EmpresaResource' => ['empresa', ['view', 'update']],
            'ProductoResource' => ['productos', ['view', 'create', 'update', 'delete', 'view-deleted', 'restore']],
            'GastoResource' => ['gastos', ['view', 'create', 'update', 'delete', 'view-deleted', 'restore']],
            'CompraResource' => ['compras', ['view', 'create', 'update', 'delete', 'view-deleted', 'restore']],
            'ComprasPendientesResource' => ['compras', ['view', 'create', 'update', 'delete', 'view-deleted', 'restore']],
            'StockInicialResource' => ['stock-iniciales', ['view', 'create', 'update', 'delete']],
            'StockBodegaResource' => ['stock-bodegas', ['view']],
            'TrasladoResource' => ['traslados', ['view', 'create', 'update', 'delete']],
            'RoleResource' => ['roles', ['view', 'create', 'update', 'delete']],
            'InicioSesionResource' => ['inicios-sesion', ['view']],
        ];

        $pedidos = ['view', 'create', 'update', 'delete', 'view-deleted', 'restore', 'view-detalle', 'create-abono', 'update-abono', 'delete-abono', 'create-detalle', 'update-detalle', 'delete-detalle', 'update-datos'];

        foreach (['PedidoResource', 'PedidosOutletResource', 'PedidosEconomicResource', 'PedidosConsignacionResource', 'PedidosEnCarteraResource'] as $recurso) {
            $recursos[$recurso] = ['pedidos', $pedidos];
        }

        $recursos['PedidosMayoristaResource'] = ['pedidos-mayoristas', $pedidos];

        $acciones = [
            'ViewAny' => ['view'],
            'View' => ['view', 'view-detalle'],
            'Create' => ['create'],
            'Update' => ['update'],
            'Delete' => ['delete'],
            'DeleteAny' => ['delete'],
            'ForceDelete' => ['delete'],
            'ForceDeleteAny' => ['delete'],
            'Restore' => ['restore', 'view-deleted'],
            'RestoreAny' => ['restore', 'view-deleted'],
            'FiltrarRegistrosEliminados' => ['view-deleted'],
            'CrearAbono' => ['create-abono'],
            'EditarAbono' => ['update-abono'],
            'EliminarAbono' => ['delete-abono'],
            'AgregarProductos' => ['create-detalle'],
            'EditarDetallePedido' => ['update-detalle'],
            'EliminarDetallePedido' => ['delete-detalle'],
            'ModificarDetallePedido' => ['create-detalle', 'update-detalle', 'delete-detalle'],
            'EditarDatosGenerales' => ['update-datos'],
        ];

        $equivalencias = [];

        foreach ($recursos as $recurso => [$modulo, $permitidas]) {
            foreach ($acciones as $accion => $nuevas) {
                $validas = array_values(array_intersect($nuevas, $permitidas));

                if ($validas !== []) {
                    $equivalencias["{$accion}:{$recurso}"] = array_map(fn (string $nueva) => "{$modulo}.{$nueva}", $validas);
                }
            }
        }

        $extras = [
            'Create:ProductoResource' => ['pos.create-producto'],
            'Create:ClienteResource' => ['pos.create-cliente'],
            'CrearTraslado:ProductoResource' => ['traslados.create'],
            'CrearTraslado:StockBodegaResource' => ['stock-bodegas.create-traslado'],
            'VerColumnaStockTotal:ProductoResource' => ['productos.view-stock-total'],
            'VerColumnaPendiente:ProductoResource' => ['productos.view-pendiente'],
            'VerColumnaAlmacenP:ProductoResource' => ['productos.view-almacen-p'],
            'VerColumnaSinInstalacion:ProductoResource' => ['productos.view-sin-instalacion'],
            'VerStockPorBodega:ProductoResource' => ['productos.view-stock-bodegas'],
            'VerProductosSinStock:ProductoResource' => ['productos.view-sin-stock'],
            'ViewAny:RoleResource' => ['historial.view'],
            'View:Pos' => ['pos.view', 'pos.create', 'pos.view-all-pedidos'],
            'View:Cotizacion' => ['cotizador.view'],
            'View:Dashboard' => ['dashboard.alerta-stock'],
            'View:StatsOverview' => ['dashboard.widget-productos', 'dashboard.widget-ganancia', 'dashboard.widget-ajustes'],
            'View:ProductosPorBodegaCantidades' => ['dashboard.tabla-bodegas'],
            'View:ProductosPorBodegaValores' => ['stock-bodegas.view-inversion'],
            'View:PedidosPiePorCategoriaChart' => ['dashboard.chart-categorias'],
            'View:ProductosChart' => ['dashboard.chart-top-productos'],
            'View:PedidosAreaChart' => ['dashboard.chart-pedidos'],
        ];

        foreach ($extras as $legacy => $nuevas) {
            $equivalencias[$legacy] = [...$equivalencias[$legacy] ?? [], ...$nuevas];
        }

        return $equivalencias;
    }
};
