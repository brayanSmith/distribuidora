import { Link, usePage } from '@inertiajs/react';
import {
    ArrowLeftRight,
    Boxes,
    Building2,
    Calculator,
    ClipboardList,
    ClipboardPen,
    FileText,
    HandCoins,
    History,
    LayoutGrid,
    LogIn,
    MonitorSmartphone,
    Package,
    PackageOpen,
    PackagePlus,
    Receipt,
    Search,
    Shield,
    ShoppingCart,
    Layers,
    Shapes,
    Truck,
    UserCog,
    Users,
    Wallet,
    Warehouse,
    Bike,
    ShoppingBag,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import AppLogo from '@/components/app-logo';
import { NavMain } from '@/components/nav-main';
import { NavUser } from '@/components/nav-user';
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarHeader,
    SidebarInput,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/components/ui/sidebar';
import { dashboard } from '@/routes';
import { index as bodegasIndex } from '@/routes/bodegas';
import { index as clientesIndex } from '@/routes/clientes';
import {
    cuentasPorPagar,
    index as comprasIndex,
    pendientes as comprasPendientes,
    pos as comprasPos,
} from '@/routes/compras';
import { index as entregasIndex } from '@/routes/entregas';
import { index as separadosIndex } from '@/routes/separados';
import { edit as empresaEdit } from '@/routes/empresa';
import { index as gastosIndex } from '@/routes/gastos';
import { index as historialIndex } from '@/routes/historial';
import { index as iniciosSesionIndex } from '@/routes/inicios-sesion';
import { index as categoriasIndex } from '@/routes/categorias';
import { index as subCategoriasIndex } from '@/routes/sub-categorias';
import { cuentasPorCobrar, index as pedidosIndex } from '@/routes/pedidos';
import { index as posIndex } from '@/routes/pos';
import { index as productosIndex } from '@/routes/productos';
import { index as proveedoresIndex } from '@/routes/proveedores';
import { index as pucsIndex } from '@/routes/pucs';
import { index as rolesIndex } from '@/routes/roles';
import { index as stockBodegasIndex } from '@/routes/stock-bodegas';
import { index as ajustesInventarioIndex } from '@/routes/ajustes-inventario';
import { index as stockInicialesIndex } from '@/routes/stock-iniciales';
import { index as trasladosIndex } from '@/routes/traslados';
import { index as usuariosIndex } from '@/routes/usuarios';
import type { NavGroup, NavItem } from '@/types';

export function AppSidebar() {
    const page = usePage();
    const dashboardUrl = dashboard();

    // Every entry is shown only when the user has the permission for it.
    const entry = (
        visible: boolean,
        title: string,
        href: () => NavItem['href'],
        icon: NavItem['icon'],
        badge?: number,
        badgePendiente?: number,
        badgePendienteTitulo?: string,
    ): NavItem[] =>
        visible
            ? [
                  {
                      title,
                      href: href(),
                      icon,
                      badge,
                      badgePendiente,
                      badgePendienteTitulo,
                  },
              ]
            : [];

    const groups: NavGroup[] = [
        {
            items: [
                { title: 'Escritorio', href: dashboardUrl, icon: LayoutGrid },
                ...entry(
                    page.props.canViewEmpresa,
                    'Empresas',
                    empresaEdit,
                    Building2,
                ),
            ],
        },
        {
            label: 'Sistema',
            items: [
                ...entry(
                    page.props.canViewPos,
                    'POS',
                    posIndex,
                    MonitorSmartphone,
                ),
                ...entry(
                    page.props.canViewGastos,
                    'Gastos',
                    gastosIndex,
                    Receipt,
                ),
                ...entry(
                    page.props.canViewPucs,
                    'Medios de pago',
                    pucsIndex,
                    Calculator,
                ),
            ],
        },
        {
            label: 'Pedidos',
            items: [
                ...entry(
                    page.props.canViewPedidos,
                    'Pedidos General',
                    pedidosIndex,
                    FileText,
                    page.props.navCounts?.pedidos,
                ),
                ...entry(
                    page.props.canViewPedidos,
                    'Cuentas por cobrar',
                    cuentasPorCobrar,
                    HandCoins,
                    page.props.navCounts?.pedidosPorCobrar || undefined,
                    page.props.navCounts?.pedidosVencidos || undefined,
                    'Pedidos vencidos',
                ),
                ...entry(
                    page.props.canViewEntregas,
                    'Entregas',
                    entregasIndex,
                    Bike,
                    page.props.navCounts?.entregasActivas || undefined,
                    page.props.navCounts?.entregasDevueltas || undefined,
                    'Entregas devueltas sin resolver',
                ),
                ...entry(
                    page.props.canViewSeparados,
                    'Separados',
                    separadosIndex,
                    ShoppingBag,
                    page.props.navCounts?.separadosPorRecoger || undefined,
                    page.props.navCounts?.separadosVencidos || undefined,
                    'Separados que no vinieron a tiempo',
                ),
            ],
        },
        {
            label: 'Compras',
            items: [
                ...entry(
                    page.props.canCreateCompras,
                    'POS Compras',
                    comprasPos,
                    PackagePlus,
                ),
                ...entry(
                    page.props.canViewCompras,
                    'Compras',
                    comprasIndex,
                    ShoppingCart,
                    page.props.navCounts?.compras,
                    page.props.navCounts?.comprasPendientes,
                    'Compras pendientes de recibir',
                ),
                ...entry(
                    page.props.canRecibirCompras,
                    'Pendientes por recibir',
                    comprasPendientes,
                    PackageOpen,
                    page.props.navCounts?.comprasPendientes || undefined,
                ),
                ...entry(
                    page.props.canViewCompras,
                    'Cuentas por pagar',
                    cuentasPorPagar,
                    Wallet,
                    page.props.navCounts?.comprasPorPagar || undefined,
                    page.props.navCounts?.comprasVencidas || undefined,
                    'Compras vencidas',
                ),
            ],
        },
        {
            label: 'Productos',
            items: [
                ...entry(
                    page.props.canViewBodegas,
                    'Bodegas',
                    bodegasIndex,
                    Warehouse,
                ),
                ...entry(
                    page.props.canViewCategorias,
                    'Categorías',
                    categoriasIndex,
                    Shapes,
                ),
                ...entry(
                    page.props.canViewSubCategorias,
                    'Subcategorías',
                    subCategoriasIndex,
                    Layers,
                ),
                ...entry(
                    page.props.canViewProductos,
                    'Productos',
                    productosIndex,
                    Package,
                ),
            ],
        },
        {
            label: 'Stock',
            items: [
                ...entry(
                    page.props.canViewStockBodegas,
                    'Stock Bodegas',
                    stockBodegasIndex,
                    Boxes,
                ),
                ...entry(
                    page.props.canViewStockIniciales,
                    'Stocks Iniciales',
                    stockInicialesIndex,
                    ClipboardList,
                ),
                ...entry(
                    page.props.canViewTraslados,
                    'Traslados',
                    trasladosIndex,
                    ArrowLeftRight,
                ),
                ...entry(
                    page.props.canViewAjustesInventario,
                    'Ajustes de inventario',
                    ajustesInventarioIndex,
                    ClipboardPen,
                ),
            ],
        },
        {
            label: 'Users',
            items: [
                ...entry(
                    page.props.canViewClientes,
                    'Clientes',
                    clientesIndex,
                    Users,
                ),
                ...entry(
                    page.props.canViewProveedores,
                    'Proveedores',
                    proveedoresIndex,
                    Truck,
                ),
                ...entry(
                    page.props.canViewUsuarios,
                    'Users',
                    usuariosIndex,
                    UserCog,
                ),
            ],
        },
        {
            label: 'Seguridad',
            items: [
                ...entry(
                    page.props.canViewRoles,
                    'Roles y Permisos',
                    rolesIndex,
                    Shield,
                ),
                ...entry(
                    page.props.canViewHistorial,
                    'Historial de cambios',
                    historialIndex,
                    History,
                ),
                ...entry(
                    page.props.canViewIniciosSesion,
                    'Inicios de sesión',
                    iniciosSesionIndex,
                    LogIn,
                ),
            ],
        },
    ].filter((group) => group.items.length > 0);

    const [search, setSearch] = useState('');
    const query = search.trim().toLowerCase();
    const filteredGroups = useMemo(() => {
        if (!query) {
            return groups;
        }

        return groups
            .map((group) => ({
                ...group,
                items: group.items.filter((item) =>
                    item.title.toLowerCase().includes(query),
                ),
            }))
            .filter((group) => group.items.length > 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [groups, query]);

    return (
        <Sidebar collapsible="icon" variant="inset">
            <SidebarHeader>
                <SidebarMenu>
                    <SidebarMenuItem>
                        <SidebarMenuButton size="lg" asChild>
                            <Link href={dashboardUrl} prefetch>
                                <AppLogo />
                            </Link>
                        </SidebarMenuButton>
                    </SidebarMenuItem>
                </SidebarMenu>

                <div className="relative px-1 group-data-[collapsible=icon]:hidden">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <SidebarInput
                        value={search}
                        onChange={(event) => setSearch(event.target.value)}
                        placeholder="Buscar módulo..."
                        className="text-foreground pl-8"
                        data-test="nav-search-input"
                    />
                </div>
            </SidebarHeader>

            <SidebarContent>
                <NavMain groups={filteredGroups} forceOpen={query !== ''} />
                {query !== '' && filteredGroups.length === 0 ? (
                    <p className="text-muted-foreground px-4 py-2 text-sm">
                        Ningún módulo coincide con la búsqueda.
                    </p>
                ) : null}
            </SidebarContent>

            <SidebarFooter>
                <NavUser />
            </SidebarFooter>
        </Sidebar>
    );
}
