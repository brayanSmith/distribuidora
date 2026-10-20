import { Badge } from '@/components/ui/badge';
import type { TipoPrecioLinea } from '@/hooks/use-pos-cart';
import { useTiposPrecio } from '@/hooks/use-tipos-precio';
import { tipoLineaDe } from '@/lib/pedido-pricing';
import { cn } from '@/lib/utils';
import type { PosCatalogoProducto, TipoPrecioPedido } from '@/types';

type Props = {
    producto: PosCatalogoProducto;
    /** Stock still left after what the cart already reserved. */
    stockDisponible: number;
    /** Units of this product already in the cart (0 when it is not). */
    enCarrito: number;
    /** The pedido's tipo de precio: the one a product not yet in the cart takes. */
    tipoPrecio: TipoPrecioPedido;
    /** How the product is sold when it is in the cart; its price is highlighted. */
    enCarritoComo?: { tipoPrecio?: TipoPrecioLinea; precioUnitario: number };
    onAdd: (producto: PosCatalogoProducto) => void;
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

function PrecioRow({
    label,
    value,
    colorClassName,
    active = false,
}: {
    label: string;
    value: string | null;
    colorClassName: string;
    active?: boolean;
}) {
    return (
        <div
            className={cn(
                'flex items-center justify-between rounded px-1 text-xs',
                active && 'bg-primary/10 ring-primary/40 ring-1',
            )}
        >
            <span className="text-muted-foreground">{label}</span>
            <span className={cn('font-semibold', colorClassName)}>
                {currencyFormatter.format(Number(value ?? 0))}
            </span>
        </div>
    );
}

export default function PosProductCard({
    producto,
    stockDisponible,
    enCarrito,
    tipoPrecio,
    enCarritoComo,
    onAdd,
}: Props) {
    const { puedeDetal, puedeMayorista } = useTiposPrecio();
    const nombre =
        producto.concatenar_codigo_nombre ??
        producto.referencia_producto ??
        `Producto ${producto.id}`;
    const hasStock = stockDisponible > 0;
    const seleccionado = enCarritoComo?.tipoPrecio ?? tipoLineaDe(tipoPrecio);

    return (
        <button
            type="button"
            onClick={() => onAdd(producto)}
            data-test="pos-product-card"
            className={cn(
                'hover:border-primary flex w-full min-w-0 flex-col gap-2 rounded-lg border p-2 text-left transition',
                enCarrito > 0
                    ? 'border-primary bg-primary/10 ring-primary/40 ring-2'
                    : 'bg-card',
            )}
        >
            <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-md">
                {producto.imagen_producto_url ? (
                    <img
                        src={producto.imagen_producto_url}
                        alt={nombre}
                        loading="lazy"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="text-muted-foreground flex h-full w-full items-center justify-center text-center text-[10px]">
                        Sin imagen
                    </div>
                )}

                {enCarrito > 0 ? (
                    <Badge
                        className="bg-primary text-primary-foreground absolute top-1 left-1 border-transparent"
                        data-test="pos-card-en-carrito"
                    >
                        {enCarrito} en carrito
                    </Badge>
                ) : null}

                <Badge
                    className={cn(
                        'absolute top-1 right-1 border-transparent',
                        !producto.inventariable
                            ? 'bg-sky-100 text-sky-700 hover:bg-sky-100'
                            : hasStock
                              ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                              : 'bg-red-100 text-red-700 hover:bg-red-100',
                    )}
                >
                    {producto.inventariable ? stockDisponible : 'Servicio'}
                </Badge>
            </div>

            <p className="text-xs font-medium break-words" title={nombre}>
                {nombre}
            </p>

            <div className="space-y-0.5">
                {puedeDetal ? (
                    <PrecioRow
                        label="Detal"
                        active={seleccionado === 'DETAL'}
                        value={producto.valor_detal}
                        colorClassName="text-emerald-600 dark:text-emerald-400"
                    />
                ) : null}
                {puedeMayorista ? (
                    <PrecioRow
                        label="Mayorista"
                        active={seleccionado === 'MAYORISTA'}
                        value={producto.valor_mayorista}
                        colorClassName="text-amber-600 dark:text-amber-400"
                    />
                ) : null}
                {enCarritoComo && seleccionado === 'PERSONALIZADO' ? (
                    <PrecioRow
                        label="Personalizado"
                        active
                        value={String(enCarritoComo.precioUnitario)}
                        colorClassName="text-sky-600 dark:text-sky-400"
                    />
                ) : null}
            </div>
        </button>
    );
}
