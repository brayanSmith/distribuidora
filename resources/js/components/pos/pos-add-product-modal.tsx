import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import TipoPrecioToggle from '@/components/pos/tipo-precio-toggle';
import ProductoGaleria from '@/components/productos/producto-galeria';
import type { TipoPrecioLinea } from '@/hooks/use-pos-cart';
import {
    precioDeLinea,
    precioParaTipo,
    tipoLineaDe,
} from '@/lib/pedido-pricing';
import { cn } from '@/lib/utils';
import type {
    BodegaOption,
    PosCatalogoProducto,
    TipoPrecioPedido,
} from '@/types';

export type PosAddSelection = {
    bodegaId: number;
    bodegaNombre: string;
    cantidad: number;
    precioUnitario: number;
    tipoPrecio: TipoPrecioLinea;
};

type Props = {
    producto: PosCatalogoProducto;
    bodegas: BodegaOption[];
    defaultBodegaId: string;
    tipoPrecio: TipoPrecioPedido;
    /** The cart line for this product in a bodega, if it is already there. */
    lineFor: (
        productoId: number,
        bodegaId: number,
    ) =>
        | {
              cantidad: number;
              precioUnitario: number;
              tipoPrecio?: TipoPrecioLinea;
          }
        | undefined;
    onConfirm: (selection: PosAddSelection) => void;
    onClose: () => void;
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

function initialBodegaId(
    producto: PosCatalogoProducto,
    bodegas: BodegaOption[],
    defaultBodegaId: string,
): string {
    if (defaultBodegaId) {
        return defaultBodegaId;
    }

    const conStock = bodegas.find(
        (bodega) => (producto.stock_por_bodega[bodega.id] ?? 0) > 0,
    );

    return String((conStock ?? bodegas[0])?.id ?? '');
}

/**
 * Asks for the quantity (with − / + buttons), the unit price (editable, for
 * custom prices) and the bodega to sell from before a catalog product goes
 * into the cart. Mount it with a `key` per product so the fields reset.
 */
export default function PosAddProductModal({
    producto,
    bodegas,
    defaultBodegaId,
    tipoPrecio,
    lineFor,
    onConfirm,
    onClose,
}: Props) {
    const [bodegaId, setBodegaId] = useState(() =>
        initialBodegaId(producto, bodegas, defaultBodegaId),
    );
    // Reopening a product that is already in the cart shows what was saved.
    const existente = lineFor(producto.id, Number(bodegaId));
    // Sold at the pedido's price unless this product was set to the other one.
    const [tipoLinea, setTipoLinea] = useState<TipoPrecioLinea>(
        existente?.tipoPrecio ?? tipoLineaDe(tipoPrecio),
    );
    const precioDefault = String(
        precioDeLinea(producto, tipoLinea) ??
            precioParaTipo(producto, tipoLineaDe(tipoPrecio)),
    );
    // Kept as text so the field can be emptied while typing a new number.
    const [cantidadTexto, setCantidadTexto] = useState(
        String(existente?.cantidad ?? 1),
    );
    const cantidad = Math.max(Math.floor(Number(cantidadTexto)) || 0, 0);
    const setCantidad = (siguiente: number | ((prev: number) => number)) =>
        setCantidadTexto(
            String(
                typeof siguiente === 'function'
                    ? siguiente(cantidad)
                    : siguiente,
            ),
        );
    const [precio, setPrecio] = useState(
        existente ? String(existente.precioUnitario) : precioDefault,
    );

    const handleBodegaChange = (value: string) => {
        setBodegaId(value);

        const guardada = lineFor(producto.id, Number(value));

        setCantidad(guardada?.cantidad ?? 1);

        const tipo = guardada?.tipoPrecio ?? tipoLinea;
        setTipoLinea(tipo);

        // A hand-typed price stays when moving to a bodega without the product.
        const precioLista = precioDeLinea(producto, tipo);

        if (guardada) {
            setPrecio(String(guardada.precioUnitario));
        } else if (precioLista !== undefined) {
            setPrecio(String(precioLista));
        }
    };

    // Detal / Mayorista take their list price; Personalizado keeps the one
    // in the field so it can be changed.
    const handleTipoChange = (tipo: TipoPrecioLinea) => {
        setTipoLinea(tipo);

        const precioLista = precioDeLinea(producto, tipo);

        if (precioLista !== undefined) {
            setPrecio(String(precioLista));
        }
    };

    const nombre =
        producto.concatenar_codigo_nombre ??
        producto.referencia_producto ??
        `Producto ${producto.id}`;

    const disponibleEn = (id: number): number =>
        producto.stock_por_bodega[id] ?? 0;

    const bodega = bodegas.find((item) => String(item.id) === bodegaId);
    const disponible = bodega ? disponibleEn(bodega.id) : 0;
    const precioNum = Number(precio) || 0;
    const sobrepasaStock = producto.inventariable && cantidad > disponible;

    const handleConfirm = () => {
        if (!bodega || cantidad <= 0) {
            return;
        }

        onConfirm({
            bodegaId: bodega.id,
            bodegaNombre: bodega.nombre_bodega,
            cantidad,
            precioUnitario: precioNum,
            tipoPrecio: tipoLinea,
        });
    };

    // Keyboard: + / − change the quantity, Enter adds to the cart. The
    // "valor unitario" field keeps its own typing (only Enter is taken).
    const handleKeyDown = (event: React.KeyboardEvent) => {
        const target = event.target as HTMLElement;
        const enPrecio = target.id === 'pos-add-precio';

        if (event.key === 'Enter' && target.tagName !== 'BUTTON') {
            event.preventDefault();
            handleConfirm();

            return;
        }

        if (enPrecio) {
            return;
        }

        if (event.key === '+') {
            event.preventDefault();
            setCantidad((prev) => prev + 1);
        } else if (event.key === '-') {
            event.preventDefault();
            setCantidad((prev) => Math.max(prev - 1, 1));
        }
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
                data-test="pos-add-modal"
                onKeyDown={handleKeyDown}
            >
                <DialogHeader>
                    <DialogTitle className="pr-6 text-base">
                        {nombre}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 sm:grid-cols-2">
                    <ProductoGaleria
                        imagenes={producto.imagenes ?? []}
                        alt={nombre}
                    />

                    <div className="grid content-start gap-4">
                        <div className="grid gap-2">
                            <Label required>Bodega</Label>
                            <Select
                                value={bodegaId}
                                onValueChange={handleBodegaChange}
                            >
                                <SelectTrigger
                                    className="w-full"
                                    data-test="pos-add-bodega"
                                >
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {bodegas.map((item) => (
                                        <SelectItem
                                            key={item.id}
                                            value={String(item.id)}
                                        >
                                            {item.nombre_bodega}
                                            {producto.inventariable
                                                ? ` · ${disponibleEn(item.id)} disp.`
                                                : ''}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                            <p
                                className={cn(
                                    'text-xs',
                                    sobrepasaStock
                                        ? 'text-destructive'
                                        : 'text-muted-foreground',
                                )}
                            >
                                {producto.inventariable
                                    ? `Disponible en esta bodega: ${disponible}`
                                    : 'Servicio: no maneja stock'}
                                {sobrepasaStock
                                    ? ' — la cantidad supera el stock'
                                    : ''}
                            </p>
                        </div>

                        <div className="grid gap-2">
                            <Label required>Cantidad</Label>
                            <div className="flex items-center gap-2">
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="border-red-200 bg-red-100 text-red-700 hover:bg-red-200 hover:text-red-800 dark:border-red-900 dark:bg-red-950 dark:text-red-300 dark:hover:bg-red-900"
                                    onClick={() =>
                                        setCantidad((prev) =>
                                            Math.max(prev - 1, 1),
                                        )
                                    }
                                    disabled={cantidad <= 1}
                                    data-test="pos-add-minus"
                                >
                                    <Minus className="size-4" />
                                </Button>
                                <Input
                                    type="number"
                                    min={1}
                                    value={cantidadTexto}
                                    onChange={(event) =>
                                        setCantidadTexto(event.target.value)
                                    }
                                    onBlur={() => {
                                        if (cantidad < 1) {
                                            setCantidad(1);
                                        }
                                    }}
                                    className="text-center"
                                    autoFocus
                                    onFocus={(event) => event.target.select()}
                                    data-test="pos-add-cantidad"
                                />
                                <Button
                                    type="button"
                                    variant="outline"
                                    size="icon"
                                    className="border-emerald-200 bg-emerald-100 text-emerald-700 hover:bg-emerald-200 hover:text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300 dark:hover:bg-emerald-900"
                                    onClick={() =>
                                        setCantidad((prev) => prev + 1)
                                    }
                                    data-test="pos-add-plus"
                                >
                                    <Plus className="size-4" />
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-2">
                            <Label>Tipo de precio</Label>
                            <TipoPrecioToggle
                                value={tipoLinea}
                                onChange={handleTipoChange}
                                size="full"
                                dataTest="pos-add-tipo"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label required htmlFor="pos-add-precio">
                                Valor unitario
                            </Label>
                            <Input
                                id="pos-add-precio"
                                type="number"
                                min={0}
                                value={precio}
                                onChange={(event) => {
                                    // A price typed by hand is a personalizado one.
                                    setPrecio(event.target.value);
                                    setTipoLinea('PERSONALIZADO');
                                }}
                                data-test="pos-add-precio"
                            />
                        </div>

                        <div className="flex justify-between border-t pt-3 font-semibold">
                            <span>Subtotal</span>
                            <span>
                                {currencyFormatter.format(cantidad * precioNum)}
                            </span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={handleConfirm}
                        disabled={!bodega}
                        data-test="pos-add-confirm"
                    >
                        {existente ? 'Guardar cambios' : 'Agregar al carrito'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
