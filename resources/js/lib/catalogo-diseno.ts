/**
 * The design of the product catalog: blocks printed top to bottom (as
 * App\Modules\Catalogo\Services\DisenoCatalogo knows them). Categorías keep
 * only which one to show and how: their productos are read when printing.
 */

import type { RedSocialEmpresa } from '@/types';

export type TipoBloqueCatalogo = 'categoria' | 'texto' | 'salto';

export type TamanoTarjetas = 'auto' | '2' | '3' | '4';

export type OrdenProductos = 'nombre' | 'precio_asc' | 'precio_desc';

export type BloqueCatalogo = {
    id: string;
    tipo: TipoBloqueCatalogo;
    visible: boolean;
    titulo?: string | null;
    categoria_id?: number | null;
    tamano?: TamanoTarjetas;
    orden?: OrdenProductos;
    solo_con_stock?: boolean;
    /** Categoría: its productos split by subcategoría. */
    subcategorias?: boolean;
    texto?: string | null;
    alineacion?: 'left' | 'center';
    /** Texto: on a tinted box. */
    destacado?: boolean;
};

export type PlantillaCatalogo = {
    id: number;
    nombre: string;
    bloques: BloqueCatalogo[];
    columnas: 2 | 3 | 4;
    encabezado: boolean;
    pie: boolean;
    ajustes: AjustesCatalogo;
};

export type CategoriaOpcion = { id: number; nombre_categoria: string };

export const BLOQUES_CATALOGO: Record<
    TipoBloqueCatalogo,
    { label: string; descripcion: string }
> = {
    categoria: {
        label: 'Categoría',
        descripcion: 'Los productos de una categoría.',
    },
    texto: {
        label: 'Texto',
        descripcion: 'Condiciones, formas de pago, horarios…',
    },
    salto: {
        label: 'Salto de página',
        descripcion: 'Lo que sigue empieza en una página nueva.',
    },
};

export const TAMANOS_TARJETAS: { value: TamanoTarjetas; label: string }[] = [
    { value: 'auto', label: 'Como la plantilla' },
    { value: '2', label: 'Grandes' },
    { value: '3', label: 'Medianas' },
    { value: '4', label: 'Pequeñas' },
];

export const ORDENES_PRODUCTOS: { value: OrdenProductos; label: string }[] = [
    { value: 'nombre', label: 'Nombre' },
    { value: 'precio_asc', label: 'Menor precio' },
    { value: 'precio_desc', label: 'Mayor precio' },
];

const nuevoId = () =>
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `b-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function nuevoBloque(
    tipo: TipoBloqueCatalogo,
    categoriaId: number | null = null,
): BloqueCatalogo {
    switch (tipo) {
        case 'categoria':
            return {
                id: nuevoId(),
                tipo,
                visible: true,
                categoria_id: categoriaId,
                titulo: null,
                tamano: 'auto',
                orden: 'nombre',
                solo_con_stock: false,
                subcategorias: true,
            };
        case 'texto':
            return {
                id: nuevoId(),
                tipo,
                visible: true,
                titulo: null,
                texto: '',
                alineacion: 'left',
                destacado: true,
            };
        default:
            return { id: nuevoId(), tipo, visible: true };
    }
}

/** Where a new design starts: every categoría, by name. */
export function bloquesIniciales(
    categorias: CategoriaOpcion[],
): BloqueCatalogo[] {
    return categorias.map((categoria) =>
        nuevoBloque('categoria', categoria.id),
    );
}

/**
 * What the page header and footer say. Empty texts take the company's own
 * (slogan, description, "En colaboración de…").
 */
export type AjustesCatalogo = {
    /** The band that opens the catalog: title, figures and the index. */
    presentacion: boolean;
    encabezado_logo: boolean;
    encabezado_titulo: string | null;
    encabezado_subtitulo: string | null;
    encabezado_mostrar_subtitulo: boolean;
    /** The company's networks left out of the footer ("red|valor"). */
    pie_ocultar_redes: string[];
    pie_texto: string | null;
    pie_mostrar_texto: boolean;
    pie_paginas: boolean;
};

export const AJUSTES_POR_DEFECTO: AjustesCatalogo = {
    presentacion: true,
    encabezado_logo: true,
    encabezado_titulo: null,
    encabezado_subtitulo: null,
    encabezado_mostrar_subtitulo: true,
    pie_ocultar_redes: [],
    pie_texto: null,
    pie_mostrar_texto: true,
    pie_paginas: true,
};

/** The company's data the header and footer fall back on. */
export type EmpresaCatalogo = {
    nombre: string | null;
    logo_url: string | null;
    eslogan: string | null;
    descripcion: string | null;
    colaboracion: string | null;
    redes: (RedSocialEmpresa & { id: string })[];
};
