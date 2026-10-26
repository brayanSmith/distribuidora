import { X } from 'lucide-react';
import CantidadStepper from '@/components/pos/cantidad-stepper';
import TipoPrecioToggle from '@/components/pos/tipo-precio-toggle';
import type { PosCartLine, TipoPrecioLinea } from '@/hooks/use-pos-cart';

type Props = {
    line: PosCartLine;
    onCantidadChange: (cantidad: number) => void;
    onPrecioChange: (precio: number) => void;
    tipoPrecio: TipoPrecioLinea;
    onTipoPrecioChange: (tipoPrecio: TipoPrecioLinea) => void;
    onEdit: () => void;
    onRemove: () => void;
    /** Quantity, price and tipo can change (editing a pedido may not allow it). */
    editable?: boolean;
    /** It can be taken out of the cart. */
    removible?: boolean;
};

const ETIQUETAS: Record<TipoPrecioLinea, string> = {
    DETAL: 'Detal',
    MAYORISTA: 'Mayorista',
    PERSONALIZADO: 'Personalizado',
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

/**
 * A product in the cart: its name and line total on top, and below how it
 * is sold (tipo de precio), how many and at what unit price.
 */
export default function PosCartItem({
    line,
    onCantidadChange,
    onPrecioChange,
    tipoPrecio,
    onTipoPrecioChange,
    onEdit,
    onRemove,
    editable = true,
    removible = true,
}: Props) {
    return (
        <div
            className="hover:border-primary/40 grid gap-2 rounded-md border p-2.5 transition-colors"
            data-test="pos-cart-item"
        >
            <div className="flex items-start gap-2">
                <button
                    type="button"
                    onClick={onEdit}
                    disabled={!editable}
                    title={
                        editable
                            ? 'Editar cantidad, valor o bodega'
                            : 'No tienes permiso para modificar esta línea'
                    }
                    data-test="pos-cart-item-edit"
                    className="min-w-0 flex-1 text-left enabled:hover:underline disabled:cursor-default"
                >
                    <p
                        className="line-clamp-2 text-sm leading-snug font-medium break-words"
                        title={line.nombre}
                    >
                        {line.nombre}
                    </p>
                    <p className="text-muted-foreground text-xs">
                        {ETIQUETAS[tipoPrecio]} · {line.bodegaNombre}
                    </p>
                </button>
                <span className="shrink-0 text-sm font-semibold tabular-nums">
                    {currencyFormatter.format(
                        line.cantidad * line.precioUnitario,
                    )}
                </span>
                {removible ? (
                    <button
                        type="button"
                        onClick={onRemove}
                        aria-label="Quitar del carrito"
                        data-test="pos-cart-item-remove"
                        className="text-muted-foreground hover:text-destructive -mt-0.5 -mr-0.5 rounded p-0.5"
                    >
                        <X className="size-4" />
                    </button>
                ) : null}
            </div>

            <div className="flex items-center gap-2">
                <TipoPrecioToggle
                    value={tipoPrecio}
                    onChange={onTipoPrecioChange}
                    dataTest="pos-cart-item-tipo"
                    disabled={!editable}
                />
                <CantidadStepper
                    value={line.cantidad}
                    onChange={onCantidadChange}
                    disabled={!editable}
                    dataTest="pos-cart-item-cantidad"
                />
                <div className="relative min-w-0 flex-1">
                    <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs">
                        $
                    </span>
                    <input
                        type="number"
                        min={0}
                        value={line.precioUnitario}
                        onChange={(event) =>
                            onPrecioChange(Number(event.target.value) || 0)
                        }
                        disabled={!editable}
                        aria-label="Precio unitario"
                        className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-md border bg-transparent pr-2 pl-5 text-right text-sm tabular-nums outline-none focus-visible:ring-[3px] disabled:opacity-60"
                        data-test="pos-cart-item-precio"
                    />
                </div>
            </div>
        </div>
    );
}
