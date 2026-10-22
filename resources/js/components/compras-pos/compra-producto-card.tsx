import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import type { CompraPosProducto } from '@/types';

type Props = {
    producto: CompraPosProducto;
    /** Units of this product already in the compra. */
    enCompra: number;
    onAdd: (producto: CompraPosProducto) => void;
};

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

/** A catalog card: a click opens the product to add it to the compra. */
export default function CompraProductoCard({
    producto,
    enCompra,
    onAdd,
}: Props) {
    return (
        <button
            type="button"
            onClick={() => onAdd(producto)}
            data-test="compras-pos-producto"
            className={cn(
                'hover:border-primary flex w-full min-w-0 flex-col gap-2 rounded-lg border p-2 text-left transition',
                enCompra > 0
                    ? 'border-primary bg-primary/10 ring-primary/40 ring-2'
                    : 'bg-card',
            )}
        >
            <div className="bg-muted relative aspect-square w-full overflow-hidden rounded-md">
                {producto.imagen_producto_url ? (
                    <img
                        src={producto.imagen_producto_url}
                        alt={producto.nombre}
                        loading="lazy"
                        className="h-full w-full object-cover"
                    />
                ) : (
                    <div className="text-muted-foreground flex h-full w-full items-center justify-center text-[10px]">
                        Sin imagen
                    </div>
                )}

                {enCompra > 0 ? (
                    <Badge className="bg-primary text-primary-foreground absolute top-1 left-1 border-transparent">
                        +{enCompra}
                    </Badge>
                ) : null}

                <Badge
                    title="Stock actual"
                    className={cn(
                        'absolute top-1 right-1 border-transparent',
                        producto.stock_total > 0
                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                            : 'bg-red-100 text-red-700 hover:bg-red-100',
                    )}
                >
                    {producto.stock_total}
                </Badge>
            </div>

            <p
                className="text-xs font-medium break-words"
                title={producto.nombre}
            >
                {producto.nombre}
            </p>

            {producto.costo_producto !== null ? (
                <div className="flex items-center justify-between rounded px-1 text-xs">
                    <span className="text-muted-foreground">Último costo</span>
                    <span className="font-semibold text-blue-600 dark:text-blue-400">
                        {moneda.format(producto.costo_producto)}
                    </span>
                </div>
            ) : null}
        </button>
    );
}
