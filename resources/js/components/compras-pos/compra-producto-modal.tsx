import { Minus, Plus, Tag } from 'lucide-react';
import { useState } from 'react';
import ProductoGaleria from '@/components/productos/producto-galeria';
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
import type { BodegaOption, CompraPosLinea, CompraPosProducto } from '@/types';

export type CompraPosSeleccion = {
    bodegaId: number;
    cantidad: number;
    costoUnitario: number;
    /** New sale prices to save on the producto; null keeps the current one. */
    valorDetal: number | null;
    valorMayorista: number | null;
};

type Props = {
    producto: CompraPosProducto;
    bodegas: BodegaOption[];
    defaultBodegaId: string;
    /** The line of the product in a bodega, if it is already in the compra. */
    lineaEn: (bodegaId: number) => CompraPosLinea | undefined;
    /** Whether the user may change the sale prices of the product. */
    canUpdatePrecios: boolean;
    onConfirm: (seleccion: CompraPosSeleccion) => void;
    onClose: () => void;
};

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

/**
 * What to buy of a product: bodega, quantity and unit cost, and — to avoid
 * going to Productos — its retail and wholesale sale prices.
 */
export default function CompraProductoModal({
    producto,
    bodegas,
    defaultBodegaId,
    lineaEn,
    canUpdatePrecios,
    onConfirm,
    onClose,
}: Props) {
    const [bodegaId, setBodegaId] = useState(
        defaultBodegaId || (bodegas[0] ? String(bodegas[0].id) : ''),
    );
    const existente = lineaEn(Number(bodegaId));
    const [cantidadTexto, setCantidadTexto] = useState(
        String(existente?.cantidad ?? 1),
    );
    const [costo, setCosto] = useState(
        String(existente?.costoUnitario ?? producto.costo_producto ?? 0),
    );
    const [detal, setDetal] = useState(
        producto.valor_detal === null ? '' : String(producto.valor_detal),
    );
    const [mayorista, setMayorista] = useState(
        producto.valor_mayorista === null
            ? ''
            : String(producto.valor_mayorista),
    );

    const cantidad = Math.max(Math.floor(Number(cantidadTexto)) || 0, 0);
    const costoNum = Number(costo) || 0;
    const stockEn = (id: number) => producto.stock_por_bodega[id] ?? 0;

    const cambiarBodega = (valor: string) => {
        setBodegaId(valor);

        const guardada = lineaEn(Number(valor));

        if (guardada) {
            setCantidadTexto(String(guardada.cantidad));
            setCosto(String(guardada.costoUnitario));
        }
    };

    // A sale price is only sent when it changed, so nothing is rewritten
    // by accident.
    const nuevoPrecio = (texto: string, actual: number | null) => {
        if (actual === null || texto.trim() === '') {
            return null;
        }

        const valor = Number(texto);

        return Number.isFinite(valor) && valor !== actual ? valor : null;
    };

    // With the product already in the compra, there is only something to
    // save once the quantity, the cost or a sale price changes.
    const preciosCambiados =
        canUpdatePrecios &&
        (nuevoPrecio(detal, producto.valor_detal) !== null ||
            nuevoPrecio(mayorista, producto.valor_mayorista) !== null);
    const hayCambios =
        !existente ||
        cantidad !== existente.cantidad ||
        costoNum !== existente.costoUnitario ||
        preciosCambiados;

    const confirmar = () => {
        if (!bodegaId || cantidad <= 0 || !hayCambios) {
            return;
        }

        onConfirm({
            bodegaId: Number(bodegaId),
            cantidad,
            costoUnitario: costoNum,
            valorDetal: canUpdatePrecios
                ? nuevoPrecio(detal, producto.valor_detal)
                : null,
            valorMayorista: canUpdatePrecios
                ? nuevoPrecio(mayorista, producto.valor_mayorista)
                : null,
        });
    };

    const margen = (venta: string) => {
        const valor = Number(venta);

        return costoNum > 0 && valor > 0
            ? Math.round(((valor - costoNum) / costoNum) * 100)
            : null;
    };

    const verPrecios =
        producto.valor_detal !== null || producto.valor_mayorista !== null;

    return (
        <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
            <DialogContent
                className="max-h-[90vh] overflow-y-auto sm:max-w-3xl"
                data-test="compras-pos-modal"
                onKeyDown={(event) => {
                    if (
                        event.key === 'Enter' &&
                        (event.target as HTMLElement).tagName !== 'BUTTON'
                    ) {
                        event.preventDefault();
                        confirmar();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle className="pr-6 text-base">
                        {producto.nombre}
                    </DialogTitle>
                </DialogHeader>

                <div className="grid gap-6 sm:grid-cols-2">
                    <ProductoGaleria
                        imagenes={producto.imagenes}
                        alt={producto.nombre}
                    />

                    <div className="grid content-start gap-4">
                        <div className="grid gap-2">
                            <Label required>Bodega</Label>
                            <Select
                                value={bodegaId}
                                onValueChange={cambiarBodega}
                            >
                                <SelectTrigger
                                    className="w-full"
                                    data-test="compras-pos-modal-bodega"
                                >
                                    <SelectValue placeholder="Seleccione..." />
                                </SelectTrigger>
                                <SelectContent>
                                    {bodegas.map((bodega) => (
                                        <SelectItem
                                            key={bodega.id}
                                            value={String(bodega.id)}
                                        >
                                            {bodega.nombre_bodega} · stock{' '}
                                            {stockEn(bodega.id)}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                            <div className="grid gap-2">
                                <Label required>Cantidad</Label>
                                <div className="flex items-center gap-1">
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() =>
                                            setCantidadTexto(
                                                String(
                                                    Math.max(cantidad - 1, 1),
                                                ),
                                            )
                                        }
                                        disabled={cantidad <= 1}
                                        aria-label="Menos"
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
                                        className="text-center"
                                        data-test="compras-pos-modal-cantidad"
                                    />
                                    <Button
                                        type="button"
                                        variant="outline"
                                        size="icon"
                                        onClick={() =>
                                            setCantidadTexto(
                                                String(cantidad + 1),
                                            )
                                        }
                                        aria-label="Más"
                                    >
                                        <Plus className="size-4" />
                                    </Button>
                                </div>
                            </div>
                            <div className="grid gap-2">
                                <Label
                                    required
                                    htmlFor="compras-pos-modal-costo"
                                >
                                    Costo unitario
                                </Label>
                                <Input
                                    id="compras-pos-modal-costo"
                                    type="number"
                                    min={0}
                                    value={costo}
                                    onChange={(event) =>
                                        setCosto(event.target.value)
                                    }
                                    data-test="compras-pos-modal-costo"
                                />
                            </div>
                        </div>

                        {verPrecios ? (
                            <div className="space-y-3 rounded-md border p-3">
                                <div className="flex items-center gap-2 text-sm font-semibold">
                                    <Tag className="size-4" />
                                    Precios de venta
                                </div>
                                <div className="grid grid-cols-2 gap-3">
                                    {producto.valor_detal !== null ? (
                                        <PrecioVenta
                                            id="compras-pos-modal-detal"
                                            label="Valor detal"
                                            valor={detal}
                                            onChange={setDetal}
                                            margen={margen(detal)}
                                            editable={canUpdatePrecios}
                                            colorClassName="text-emerald-600 dark:text-emerald-400"
                                        />
                                    ) : null}
                                    {producto.valor_mayorista !== null ? (
                                        <PrecioVenta
                                            id="compras-pos-modal-mayorista"
                                            label="Valor mayorista"
                                            valor={mayorista}
                                            onChange={setMayorista}
                                            margen={margen(mayorista)}
                                            editable={canUpdatePrecios}
                                            colorClassName="text-amber-600 dark:text-amber-400"
                                        />
                                    ) : null}
                                </div>
                                <p className="text-muted-foreground text-xs">
                                    {canUpdatePrecios
                                        ? 'Si los cambias, se guardan en el producto al agregarlo.'
                                        : 'No tienes permiso para cambiar los precios.'}
                                </p>
                            </div>
                        ) : null}

                        <div className="flex justify-between border-t pt-3 font-semibold">
                            <span>Subtotal</span>
                            <span>{moneda.format(cantidad * costoNum)}</span>
                        </div>
                    </div>
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Cancelar
                    </Button>
                    <Button
                        type="button"
                        onClick={confirmar}
                        disabled={!bodegaId || cantidad <= 0 || !hayCambios}
                        data-test="compras-pos-modal-confirmar"
                    >
                        {!existente
                            ? 'Agregar a la compra'
                            : hayCambios
                              ? 'Guardar cambios'
                              : 'Sin cambios'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}

function PrecioVenta({
    id,
    label,
    valor,
    onChange,
    margen,
    editable,
    colorClassName,
}: {
    id: string;
    label: string;
    valor: string;
    onChange: (valor: string) => void;
    margen: number | null;
    editable: boolean;
    colorClassName: string;
}) {
    return (
        <div className="grid gap-1">
            <Label htmlFor={id} className={colorClassName}>
                {label}
            </Label>
            <Input
                id={id}
                type="number"
                min={0}
                value={valor}
                disabled={!editable}
                onChange={(event) => onChange(event.target.value)}
                data-test={id}
            />
            {margen !== null ? (
                <span
                    className={
                        margen < 0
                            ? 'text-destructive text-xs'
                            : 'text-muted-foreground text-xs'
                    }
                >
                    Margen sobre el costo: {margen}%
                </span>
            ) : null}
        </div>
    );
}
