export type Categoria = {
    id: number;
    nombre_categoria: string;
    sub_categorias_count: number;
    productos_count: number;
};

export type SubCategoria = {
    id: number;
    categoria_id: number;
    nombre_sub_categoria: string;
    productos_count: number;
    categoria: { id: number; nombre_categoria: string } | null;
};

export type CategoriaPermissions = {
    canCreate: boolean;
    canUpdate: boolean;
    canDelete: boolean;
};
