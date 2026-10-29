import type { Auth } from '@/types/auth';
import type { TipoImportacion } from '@/types/importaciones';
import type { TemaEmpresa } from '@/hooks/use-theme-color';

declare module 'react' {
    interface InputHTMLAttributes<T> {
        passwordrules?: string;
    }
}

declare module '@inertiajs/core' {
    export interface InertiaConfig {
        sharedPageProps: {
            name: string;
            /** The company logo from "Empresas", when one was uploaded. */
            logoUrl: string | null;
            /** The company's app colors (menu and platform), from "Empresas". */
            tema: TemaEmpresa;
            /** The company icon (or its logo while there is none): tab, sidebar, notifications. */
            iconoUrl: string | null;
            auth: Auth;
            sidebarOpen: boolean;
            /** Product prices the user may see: valor_detal, valor_mayorista, costo. */
            tiposPrecioPermitidos: string[];
            canViewRoles: boolean;
            canViewClientes: boolean;
            canViewUsuarios: boolean;
            canViewBodegas: boolean;
            canViewProveedores: boolean;
            canViewCategorias: boolean;
            canViewSubCategorias: boolean;
            canViewPucs: boolean;
            canViewEmpresa: boolean;
            canViewGastos: boolean;
            canViewProductos: boolean;
            /** What the user may import from a file, with the columns of each. */
            tiposImportacion: TipoImportacion[];
            /** Finished imports of the user not marked as read. */
            importacionesSinLeer: number;
            /** Imports of the user still queued or running. */
            importacionesEnCurso: number;
            canViewPos: boolean;
            canViewCompras: boolean;
            canCreateCompras: boolean;
            canRecibirCompras: boolean;
            canViewEntregas: boolean;
            canViewSeparados: boolean;
            canExportarCatalogo: boolean;
            /** Public VAPID key for push notifications (null signed out). */
            vapidPublicKey: string | null;
            canViewPedidos: boolean;
            canViewStockIniciales: boolean;
            canViewStockBodegas: boolean;
            canViewTraslados: boolean;
            canViewAjustesInventario: boolean;
            canViewHistorial: boolean;
            canViewIniciosSesion: boolean;
            /** Record totals shown as sidebar badges. */
            navCounts: {
                pedidos: number;
                compras: number;
                comprasPendientes: number;
                comprasVencidas: number;
                comprasPorPagar: number;
                pedidosPorCobrar: number;
                pedidosVencidos: number;
                entregasActivas: number;
                entregasDevueltas: number;
                separadosPorRecoger: number;
                separadosVencidos: number;
            };
            [key: string]: unknown;
        };
    }
}
