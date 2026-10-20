import { X } from 'lucide-react';
import { useState } from 'react';
import TipoPrecioToggle from '@/components/pos/tipo-precio-toggle';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { PosCartLine, TipoPrecioLinea } from '@/hooks/use-pos-cart';

type Props = {
    line: PosCartLine;
    onCantidadChange: (cantidad: number) => void;
    onPrecioChange: (precio: number) => void;
    tipoPrecio: TipoPrecioLinea;
    onTipoPrecioChange: (tipoPrecio: TipoPrecioLinea) => void;
    onEdit: () => void;
    onRemove: () => void;
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

export default function PosCartItem({
    line,
    onCantidadChange,
    onPrecioChange,
    tipoPrecio,
    onTipoPrecioChange,
    onEdit,
    onRemove,
}: Props) {
    // What is being typed in the quantity field; null shows the line's own.
    const [cantidadTexto, setCantidadTexto] = useState<string | null>(null);

    return (
        <div
            className="flex items-start gap-2 border-b py-2 last:border-b-0"
            data-test="pos-cart-item"
        >
            <button
                type="button"
                onClick={onEdit}
                title="Editar cantidad, valor o bodega"
                data-test="pos-cart-item-edit"
                className="hover:bg-accent min-w-0 flex-1 rounded p-1 text-left"
            >
                <p
                    className="text-sm font-medium break-words"
                    title={line.nombre}
                >
                    {line.nombre}
                </p>
                <p className="text-muted-foreground text-xs">
                    {ETIQUETAS[tipoPrecio]} ·{line.bodegaNombre} ·
                    {currencyFormatter.format(
                        line.cantidad * line.precioUnitario,
                    )}
                </p>
            </button>

            <TipoPrecioToggle
                value={tipoPrecio}
                onChange={onTipoPrecioChange}
                dataTest="pos-cart-item-tipo"
            />

            <Input
                type="number"
                min={1}
                value={cantidadTexto ?? line.cantidad}
                onChange={(event) => {
                    setCantidadTexto(event.target.value);

                    // An emptied field waits for the new number instead of
                    // taking the line out of the cart.
                    const cantidad = Number(event.target.value);

                    if (cantidad > 0) {
                        onCantidadChange(cantidad);
                    }
                }}
                onBlur={() => setCantidadTexto(null)}
                className="h-8 w-16 text-right"
                data-test="pos-cart-item-cantidad"
            />

            <Input
                type="number"
                min={0}
                value={line.precioUnitario}
                onChange={(event) =>
                    onPrecioChange(Number(event.target.value) || 0)
                }
                className="h-8 w-24 text-right"
                data-test="pos-cart-item-precio"
            />

            <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRemove}
                data-test="pos-cart-item-remove"
            >
                <X className="size-4" />
            </Button>
        </div>
    );
}
