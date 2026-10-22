export type EstadoCompra = 'PENDIENTE' | 'RECIBIDA';

/** Whether the proveedor was paid in full. */
export type EstadoPagoCompra = 'POR_PAGAR' | 'PAGADA';

/** A payment made to the proveedor of a compra. */
export type AbonoCompra = {
    id: number;
    fecha: string;
    monto: string;
    descripcion: string | null;
    puc?: { id: number; concatenar_subcuenta_concepto: string | null } | null;
    user?: { id: number; name: string } | null;
};

export type ProveedorOption = {
    id: number;
    nombre_proveedor: string;
};

export type ProductoOption = {
    id: number;
    referencia_producto: string | null;
    concatenar_codigo_nombre: string | null;
    costo_producto: string;
};

export type BodegaOption = {
    id: number;
    nombre_bodega: string;
};

export type CompraDetalle = {
    id: number;
    producto_id: number;
    bodega_id: number;
    cantidad: string;
    /** How much of it already arrived. */
    cantidad_recibida: string;
    precio_unitario: string;
    subtotal: string;
    estado_entrega: EstadoCompra;
    producto?: ProductoOption | null;
    bodega?: BodegaOption | null;
};

export type Compra = {
    id: number;
    factura: string;
    proveedor_id: number;
    fecha: string | null;
    estado: EstadoCompra;
    observaciones: string | null;
    subtotal: string;
    descuento: string;
    total_a_pagar: string;
    /** Paid so far, still owed and whether it is paid. */
    abono: string;
    saldo_pendiente: string;
    estado_pago: EstadoPagoCompra;
    tipo_pago: 'CONTADO' | 'CREDITO';
    /** When it must be paid (Y-m-d), and whether it is past it with a balance. */
    fecha_vencimiento: string | null;
    vencida: boolean;
    proveedor?: ProveedorOption | null;
    detalles_compra?: CompraDetalle[];
};

export type CompraPermissions = {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canViewDeleted: boolean;
    canRestore: boolean;
    canCreateAbono: boolean;
    canDeleteAbono: boolean;
};
