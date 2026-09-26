import type { Bodega } from './bodegas';

export type Gasto = {
    id: number;
    bodega_id: number | null;
    user_id: number | null;
    descripcion: string;
    monto: string;
    fecha_gasto: string;
    bodega?: Bodega | null;
    /** Who registered the gasto. */
    user?: { id: number; name: string } | null;
};

export type GastoPermissions = {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canViewDeleted: boolean;
    canRestore: boolean;
};
