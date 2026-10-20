import type { TipoPrecioPedido } from '@/types';

type ProductoConPrecios = {
    valor_detal?: string | null;
    valor_mayorista?: string | null;
    costo_producto?: string | null;
};

/** The tipo de precio a cart line starts with: the pedido's, with OTRO as DETAL. */
export function tipoLineaDe(
    tipoPrecio: TipoPrecioPedido,
): 'DETAL' | 'MAYORISTA' {
    return tipoPrecio === 'MAYORISTA' ? 'MAYORISTA' : 'DETAL';
}

/**
 * The price of a product for a cart line's tipo de precio; a PERSONALIZADO
 * line has no list price (it keeps the one typed by hand).
 */
export function precioDeLinea(
    producto: ProductoConPrecios,
    tipoPrecio: 'DETAL' | 'MAYORISTA' | 'PERSONALIZADO',
): number | undefined {
    return tipoPrecio === 'PERSONALIZADO'
        ? undefined
        : precioParaTipo(producto, tipoPrecio);
}

/**
 * The unit price a product should default to for a given tipo_precio.
 * Shared by the line-by-line pedido form and the POS catalog so both stay
 * in sync with a single pricing rule.
 */
export function precioParaTipo(
    producto: ProductoConPrecios,
    tipoPrecio: TipoPrecioPedido,
): number {
    if (tipoPrecio === 'MAYORISTA') {
        return Number(producto.valor_mayorista ?? producto.valor_detal ?? 0);
    }

    if (tipoPrecio === 'OTRO') {
        return Number(producto.costo_producto ?? 0);
    }

    return Number(producto.valor_detal ?? 0);
}
