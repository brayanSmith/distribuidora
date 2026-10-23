<?php

namespace App\Http\Middleware;

use App\Models\User;
use App\Modules\Catalogo\Models\Importacion;
use App\Modules\Compras\Models\Compra;
use App\Modules\Ventas\Models\Entrega;
use App\Modules\Ventas\Models\Pedido;
use App\Support\Branding;
use App\Support\Importaciones\TiposImportacion;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Middleware;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     *
     * @see https://inertiajs.com/server-side-setup#root-template
     *
     * @var string
     */
    protected $rootView = 'app';

    /**
     * Determines the current asset version.
     *
     * @see https://inertiajs.com/asset-versioning
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * @see https://inertiajs.com/shared-data
     *
     * @return array<string, mixed>
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            // The app is branded with the company saved in "Empresas".
            'name' => fn () => app(Branding::class)->name(),
            'logoUrl' => fn () => app(Branding::class)->logoUrl(),
            'iconoUrl' => fn () => app(Branding::class)->iconoUrl(),
            'auth' => [
                'user' => $user,
            ],
            // Public VAPID key, for the browser to subscribe to push notifications.
            'vapidPublicKey' => fn () => $user ? config('webpush.vapid.public_key') : null,
            'sidebarOpen' => ! $request->hasCookie('sidebar_state') || $request->cookie('sidebar_state') === 'true',
            'tiposPrecioPermitidos' => fn () => $user?->tiposPrecioPermitidos() ?? [],
            'canViewRoles' => fn () => $user?->can('roles.view') ?? false,
            'canViewClientes' => fn () => $user?->can('clientes.view') ?? false,
            'canViewUsuarios' => fn () => $user?->can('usuarios.view') ?? false,
            'canViewBodegas' => fn () => $user?->can('bodegas.view') ?? false,
            'canViewProveedores' => fn () => $user?->can('proveedores.view') ?? false,
            'canViewCategorias' => fn () => $user?->can('categorias.view') ?? false,
            'canViewSubCategorias' => fn () => $user?->can('sub-categorias.view') ?? false,
            'canViewPucs' => fn () => $user?->can('puc.view') ?? false,
            'canViewEmpresa' => fn () => $user?->can('empresa.view') ?? false,
            'canViewGastos' => fn () => $user?->can('gastos.view') ?? false,
            'canViewCotizador' => fn () => $user?->can('cotizador.view') ?? false,
            'canViewPos' => fn () => $user?->can('pos.view') ?? false,
            'canViewCompras' => fn () => $user?->can('compras.view') ?? false,
            'canCreateCompras' => fn () => $user?->can('compras.create') ?? false,
            'canRecibirCompras' => fn () => $user?->can('compras.recibir') ?? false,
            'canViewEntregas' => fn () => $user?->can('entregas.view') ?? false,
            'canViewSeparados' => fn () => $user?->can('separados.view') ?? false,
            'canViewPedidos' => fn () => $user?->can('pedidos.view') ?? false,
            'canViewProductos' => fn () => $user?->can('productos.view') ?? false,
            // What the user may import from a file (productos, medios de pago...).
            'tiposImportacion' => fn () => TiposImportacion::para($user),
            // The import dialog lives in the header, so any page can ask for the user's
            // imports (partial reload) and show how many finished ones are unread.
            'importaciones' => Inertia::optional(fn () => $user ? Importacion::de($user)->latest('id')->limit(20)->get() : []),
            'importacionesSinLeer' => fn () => $user ? Importacion::de($user)->sinLeer()->count() : 0,
            'importacionesEnCurso' => fn () => $user ? Importacion::de($user)->enCurso()->count() : 0,
            'canViewStockIniciales' => fn () => $user?->can('stock-iniciales.view') ?? false,
            'canViewStockBodegas' => fn () => $user?->can('stock-bodegas.view') ?? false,
            'canViewTraslados' => fn () => $user?->can('traslados.view') ?? false,
            'canViewHistorial' => fn () => $user?->can('historial.view') ?? false,
            'canViewIniciosSesion' => fn () => $user?->can('inicios-sesion.view') ?? false,
            'navCounts' => fn () => $this->navCounts($user),
        ];
    }

    /**
     * The totals shown as badges in the sidebar: every pedido (of the
     * authorized bodegas, whatever its tipo de precio) and every compra, so
     * the badge matches what the listing shows. A count is only computed for
     * the modules the user can open. Compras also carries how many of them
     * are still PENDIENTE.
     *
     * @return array{pedidos: int, pedidosPorCobrar: int, pedidosVencidos: int, compras: int, comprasPendientes: int, comprasPorPagar: int, comprasVencidas: int, entregasActivas: int, entregasDevueltas: int, separadosPorRecoger: int, separadosVencidos: int}
     */
    private function navCounts(?User $user): array
    {
        return [
            'pedidos' => $user?->can('pedidos.view')
                ? Pedido::query()
                    ->when($user->idsBodegasPermitidas(), fn ($query, array $bodegaIds) => $query->whereIn('bodega_id', $bodegaIds))
                    ->count()
                : 0,
            'compras' => $user?->can('compras.view')
                ? Compra::count()
                : 0,
            'comprasPendientes' => $user?->can('compras.view')
                ? Compra::where('estado', 'PENDIENTE')->count()
                : 0,
            // Pedidos (of the authorized bodegas) that still owe something, and those past their due date.
            'pedidosPorCobrar' => $user?->can('pedidos.view')
                ? Pedido::where('saldo_pendiente', '>', 0)
                    ->when($user->idsBodegasPermitidas(), fn ($query, array $bodegaIds) => $query->whereIn('bodega_id', $bodegaIds))
                    ->count()
                : 0,
            'pedidosVencidos' => $user?->can('pedidos.view')
                ? Pedido::vencidos()
                    ->when($user->idsBodegasPermitidas(), fn ($query, array $bodegaIds) => $query->whereIn('bodega_id', $bodegaIds))
                    ->count()
                : 0,
            // Deliveries still to dispatch or on their way.
            'entregasActivas' => $user?->can('entregas.view')
                ? Entrega::visiblesPara($user)->whereIn('estado', Entrega::ACTIVAS)->count()
                : 0,
            'entregasDevueltas' => $user?->can('entregas.view')
                ? Entrega::visiblesPara($user)->where('estado', Entrega::DEVUELTO)->count()
                : 0,
            // Separados the cliente has not picked up, and those past their pickup day.
            'separadosPorRecoger' => $user?->can('separados.view')
                ? Pedido::separadosPorRecoger()->when($user->idsBodegasPermitidas(), fn ($query, array $bodegaIds) => $query->whereIn('bodega_id', $bodegaIds))->count()
                : 0,
            'separadosVencidos' => $user?->can('separados.view')
                ? Pedido::separadosPorRecoger()->when($user->idsBodegasPermitidas(), fn ($query, array $bodegaIds) => $query->whereIn('bodega_id', $bodegaIds))->whereDate('fecha_recogida', '<', today())->count()
                : 0,
            // Compras that still owe something to the proveedor, and those past their due date.
            'comprasPorPagar' => $user?->can('compras.view')
                ? Compra::where('saldo_pendiente', '>', 0)->count()
                : 0,
            'comprasVencidas' => $user?->can('compras.view')
                ? Compra::vencidas()->count()
                : 0,
        ];
    }
}
