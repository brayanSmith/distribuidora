/** A catalog entry on the POS screen — a richer view of a product than
 * `ProductoPedidoOption`, adding the image, stock and extra price fields
 * the catalog cards need. */
export type PosCatalogoProducto = {
    id: number;
    referencia_producto: string | null;
    concatenar_codigo_nombre: string | null;
    categoria_id: number | null;
    categoria: string | null;
    sub_categoria: string | null;
    /** False for servicios: they have no stock. */
    inventariable: boolean;
    sku: string | null;
    valor_detal: string | null;
    valor_mayorista: string | null;
    costo_producto: string | null;
    imagen_producto_url: string | null;
    /** Every image of the product, the cover first. */
    imagenes: string[];
    stock_total: number;
    /** Stock per bodega id (as returned by the backend, keys are bodega ids). */
    stock_por_bodega: Record<string, number>;
};

export type TipoPagoPedido =
    | 'CONTADO'
    | 'SEPARADO'
    | 'CREDITO'
    | 'CONTRA_ENTREGA';

/** One row of a cliente's order history in the POS history modal. */
export type PosPedidoHistorial = {
    id: number;
    fecha: string | null;
    cliente: string | null;
    vendedor: string | null;
    tipo_precio: string;
    tipo_pago: string;
    estado: string;
    estado_pago: string;
    total_a_pagar: string;
    saldo_pendiente: string;
    productos: string[];
};

/** What the payment voucher prints; built by the backend's `PedidoVoucher`. */
export type PosVoucher = {
    empresa: {
        nombre: string | null;
        direccion: string | null;
        telefono: string | null;
        nit: string | null;
        logo_url: string | null;
        /** How the logo is printed. */
        formato_logo: 'CUADRADO' | 'RECTANGULAR';
    };
    pedido: {
        id: number;
        turno: string | null;
        fecha: string | null;
        facturacion_electronica: boolean;
        observacion: string | null;
        observacion_pago: string | null;
        subtotal: number;
        descuento: number;
        flete: number;
        retefuente: number;
        reteica: number;
        total_a_pagar: number;
        abono: number;
        saldo_pendiente: number;
    };
    vendedor: string | null;
    cliente: {
        razon_social: string | null;
        numero_documento: string | null;
        ciudad: string | null;
        direccion: string | null;
        telefono: string | null;
        email: string | null;
    };
    /** Where a contra entrega goes (null for the rest). */
    entrega?: {
        direccion: string;
        ciudad: string | null;
        telefono: string;
        recibe: string | null;
        nota: string | null;
        fecha_programada: string | null;
        mensajero: string | null;
    } | null;
    detalles: { nombre: string; cantidad: number; total: number }[];
    /** The company's voucher design as saved (null: the default one). */
    diseno?: unknown;
};
