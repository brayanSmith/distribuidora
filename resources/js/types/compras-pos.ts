/** A product of the compras POS catalog: only those that carry stock. */
export type CompraPosProducto = {
    id: number;
    nombre: string;
    sku: string | null;
    categoria_id: number | null;
    sub_categoria: string | null;
    /** Last purchase cost; null when the user may not see costs. */
    costo_producto: number | null;
    /** Sale prices; null when the user may not see them. */
    valor_detal: number | null;
    valor_mayorista: number | null;
    imagen_producto_url: string | null;
    /** Every image, the cover first. */
    imagenes: string[];
    stock_total: number;
    /** Stock by bodega id. */
    stock_por_bodega: Record<string, number>;
};

/** A proveedor as the compras POS picker shows it. */
export type ProveedorPos = {
    id: number;
    nombre_proveedor: string;
    razon_social_proveedor: string | null;
    nit_proveedor: string | null;
    telefono_proveedor: string | null;
    ciudad_proveedor: string | null;
    direccion_proveedor: string | null;
    tipo_proveedor: string | null;
    dias_credito: number;
};

/** A line of the compra being built: a product into a bodega. */
export type CompraPosLinea = {
    /** producto + bodega: the same product may go to several bodegas. */
    key: string;
    productoId: number;
    nombre: string;
    bodegaId: number;
    cantidad: number;
    costoUnitario: number;
};

/** The header of the compra being built. */
export type CompraPosEncabezado = {
    proveedorId: string;
    factura: string;
    /** Bodega the new lines go to. */
    bodegaId: string;
    /** Whether the goods already arrived (adds the stock now). */
    recibido: boolean;
    descuento: string;
    observaciones: string;
};
