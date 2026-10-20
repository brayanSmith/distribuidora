export type SubCategoriaOption = {
    id: number;
    categoria_id: number;
    nombre_sub_categoria: string;
};

export type CategoriaOption = {
    id: number;
    nombre_categoria: string;
    sub_categorias: SubCategoriaOption[];
};

export type ProductoImagen = {
    id: number;
    url: string;
};

export type Producto = {
    id: number;
    categoria_id: number | null;
    categoria: string | null;
    sub_categoria_id: number | null;
    sub_categoria: string | null;
    inventariable: boolean;
    sku: string | null;
    marca: string | null;
    referencia_producto: string | null;
    descripcion_producto: string | null;
    costo_producto: string;
    valor_detal: string;
    valor_mayorista: string;
    imagenes: ProductoImagen[];
    imagen_producto_url: string | null;
    concatenar_codigo_nombre: string | null;
    stock_total?: number | null;
    pendiente?: number | null;
    proveedor_pendiente?: string | null;
    stock_por_bodega?: Record<string, number> | null;
};

export type ProductoPermissions = {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
    canViewDeleted: boolean;
    canRestore: boolean;
    canViewStockTotal: boolean;
    canViewPendiente: boolean;
    canViewAlmacenP: boolean;
    canViewStockBodegas: boolean;
    canImport: boolean;
    canExport: boolean;
    canCreateTraslado: boolean;
};

export type LaravelPaginator<T> = {
    data: T[];
    current_page: number;
    last_page: number;
    total: number;
    per_page: number;
};

export type ProductoDetallePedido = {
    id: number;
    pedido_id: number;
    cantidad: string;
    precio_unitario: string;
    subtotal: string;
    pedido?: {
        id: number;
        fecha: string | null;
        estado: string;
        cliente?: { id: number; razon_social: string } | null;
    } | null;
};

export type ProductoDetalleCompra = {
    id: number;
    compra_id: number;
    cantidad: string;
    precio_unitario: string;
    subtotal: string;
    estado_entrega: string;
    compra?: {
        id: number;
        factura: string;
        fecha: string | null;
        estado: string;
        proveedor?: { id: number; nombre_proveedor: string } | null;
    } | null;
    bodega?: { id: number; nombre_bodega: string } | null;
};

export type ProductoDetallesResponse = {
    detallePedidos: LaravelPaginator<ProductoDetallePedido>;
    detalleCompras: LaravelPaginator<ProductoDetalleCompra>;
    totalComprado: number;
    totalVendido: number;
};

export type CantidadPorBodegaFila = {
    almacen: string;
    cantidades: Record<string, number>;
    total: number;
    valores: Record<string, number>;
};

export type CantidadPorBodega = {
    categorias: string[];
    filas: CantidadPorBodegaFila[];
    totales: Record<string, number>;
};

export type DashboardResumen = {
    productosVendidos: {
        cantidad: number;
        valor: number;
        serie: { fecha: string; cantidad: number; valor: number }[];
    };
    valorPedidos: { valor: number; cantidad: number };
    inversion: number;
    gastos: number;
    ganancia: number;
    ajustes: { reteica: number; retefuente: number; descuento: number };
};

export type DashboardGraficos = {
    categorias: { categoria: string; cantidad: number; valor: number }[];
    topProductos: { producto: string; cantidad: number; valor: number }[];
    pedidosPorFecha: {
        fecha: string;
        pedidos: number;
        cantidad: number;
        valor: number;
        inversion: number;
    }[];
    gastosPorFecha: { fecha: string; gastos: number }[];
};

export type DashboardFiltros = {
    bodega_ids: string[];
    desde: string;
    hasta: string;
    producto_ids: string[];
};

export type DashboardParte =
    | 'widget-productos'
    | 'widget-ganancia'
    | 'widget-ajustes'
    | 'tabla-bodegas'
    | 'chart-categorias'
    | 'chart-top-productos'
    | 'chart-pedidos'
    | 'alerta-stock';

export type ProductoSinStock = {
    id: number;
    producto: string;
    vendidas: number;
    stock: number;
};

export type DashboardPermisos = Record<DashboardParte, boolean>;

export type DashboardBodegaOption = { id: number; nombre_bodega: string };

export type DashboardProductoOption = {
    id: number;
    concatenar_codigo_nombre: string | null;
};
