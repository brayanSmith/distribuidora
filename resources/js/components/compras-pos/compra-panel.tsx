import { PackagePlus, Plus, RotateCcw, Trash2, Truck, X } from 'lucide-react';
import InputError from '@/components/input-error';
import { ProveedorCard } from '@/components/compras-pos/proveedor-modal';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type {
    BodegaOption,
    CompraPosEncabezado,
    CompraPosLinea,
    ProveedorPos,
} from '@/types';

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

/**
 * Editing a saved compra: its title and what of each line already arrived
 * (that part can't be undone by lowering the quantity or moving it).
 */
export type CompraPanelEdicion = {
    /** E.g. "Editando compra FAC-55". */
    titulo: string;
    /** Units already received of each line, by its key. */
    recibidas: Map<string, number>;
};

type Props = {
    /** Present while editing a saved compra. */
    edicion?: CompraPanelEdicion;
    /** The proveedor picked, if any. */
    proveedor: ProveedorPos | null;
    /** Opens the proveedor picker. */
    onElegirProveedor: () => void;
    bodegas: BodegaOption[];
    encabezado: CompraPosEncabezado;
    onCampo: <K extends keyof CompraPosEncabezado>(
        campo: K,
        valor: CompraPosEncabezado[K],
    ) => void;
    lineas: CompraPosLinea[];
    onLinea: (key: string, cambios: Partial<CompraPosLinea>) => void;
    onQuitar: (key: string) => void;
    onLimpiar: () => void;
    onRegistrar: () => void;
    procesando: boolean;
    errores: Record<string, string>;
};

/**
 * The compra being built: who sells, the invoice, where the goods go, the
 * lines (quantity, unit cost and bodega each) and the totals.
 */
export default function CompraPanel({
    edicion,
    proveedor,
    onElegirProveedor,
    bodegas,
    encabezado,
    onCampo,
    lineas,
    onLinea,
    onQuitar,
    onLimpiar,
    onRegistrar,
    procesando,
    errores,
}: Props) {
    const subtotal = lineas.reduce(
        (suma, linea) => suma + linea.cantidad * linea.costoUnitario,
        0,
    );
    const descuento = Number(encabezado.descuento) || 0;
    const total = Math.max(subtotal - descuento, 0);
    const unidades = lineas.reduce((suma, linea) => suma + linea.cantidad, 0);
    const puedeRegistrar =
        lineas.length > 0 &&
        encabezado.proveedorId !== '' &&
        encabezado.factura.trim() !== '';

    return (
        <div className="bg-card flex flex-col overflow-hidden rounded-lg border lg:max-h-[calc(100svh-6rem)]">
            <div className="bg-primary text-primary-foreground flex shrink-0 items-center justify-between p-4">
                <span className="flex items-center gap-2 font-semibold">
                    <PackagePlus className="size-4" />
                    {edicion ? edicion.titulo : 'Nueva compra'}
                </span>
                <span className="font-semibold">
                    {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
                </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-4 overflow-y-auto p-4">
                <div className="grid gap-2">
                    <Label required>Proveedor</Label>
                    <Button
                        type="button"
                        variant="outline"
                        className="justify-start"
                        onClick={onElegirProveedor}
                        data-test="compras-pos-proveedor"
                    >
                        <Truck className="size-4" />
                        {proveedor
                            ? 'Cambiar proveedor'
                            : 'Seleccionar proveedor'}
                        <kbd className="text-muted-foreground ml-auto text-xs">
                            F3
                        </kbd>
                    </Button>
                    {proveedor ? <ProveedorCard proveedor={proveedor} /> : null}
                    <InputError message={errores.proveedor_id} />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                        <Label required htmlFor="compras-pos-factura">
                            Factura
                        </Label>
                        <Input
                            id="compras-pos-factura"
                            value={encabezado.factura}
                            onChange={(event) =>
                                onCampo('factura', event.target.value)
                            }
                            data-test="compras-pos-factura"
                        />
                        <InputError message={errores.factura} />
                    </div>
                    <div className="grid gap-2">
                        <Label required>Bodega</Label>
                        <Select
                            value={encabezado.bodegaId}
                            onValueChange={(valor) =>
                                onCampo('bodegaId', valor)
                            }
                        >
                            <SelectTrigger
                                className="w-full"
                                data-test="compras-pos-bodega"
                            >
                                <SelectValue placeholder="Bodega" />
                            </SelectTrigger>
                            <SelectContent>
                                {bodegas.map((bodega) => (
                                    <SelectItem
                                        key={bodega.id}
                                        value={String(bodega.id)}
                                    >
                                        {bodega.nombre_bodega}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid gap-1">
                    <div className="flex items-center justify-between">
                        <Label>Productos</Label>
                        {lineas.length > 0 && !edicion ? (
                            <button
                                type="button"
                                onClick={onLimpiar}
                                className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-xs"
                            >
                                <Trash2 className="size-3.5" />
                                Vaciar
                            </button>
                        ) : null}
                    </div>

                    {lineas.length === 0 ? (
                        <p className="text-muted-foreground flex flex-col items-center gap-1 py-6 text-center text-sm">
                            <Plus className="size-5" />
                            Toca un producto del catálogo para agregarlo.
                        </p>
                    ) : (
                        <div>
                            {lineas.map((linea) => {
                                // What already arrived can't be undone here.
                                const recibida =
                                    edicion?.recibidas.get(linea.key) ?? 0;

                                return (
                                    <div
                                        key={linea.key}
                                        className="space-y-1.5 border-b py-2 last:border-b-0"
                                        data-test="compras-pos-linea"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-medium break-words">
                                                    {linea.nombre}
                                                </p>
                                                {edicion && recibida > 0 ? (
                                                    <p
                                                        className="text-xs text-emerald-700 dark:text-emerald-400"
                                                        data-test="compras-pos-linea-recibida"
                                                    >
                                                        Recibido {recibida} de{' '}
                                                        {linea.cantidad}
                                                    </p>
                                                ) : null}
                                            </div>
                                            <button
                                                type="button"
                                                aria-label="Quitar"
                                                onClick={() =>
                                                    onQuitar(linea.key)
                                                }
                                                className="text-muted-foreground hover:text-destructive"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        </div>
                                        <div className="grid grid-cols-[4rem_1fr_1fr] gap-2">
                                            <Input
                                                type="number"
                                                min={Math.max(1, recibida)}
                                                aria-label="Cantidad"
                                                value={linea.cantidad}
                                                onChange={(event) =>
                                                    onLinea(linea.key, {
                                                        cantidad: Math.max(
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ) || 1,
                                                            1,
                                                            recibida,
                                                        ),
                                                    })
                                                }
                                                className="h-8 text-right"
                                                data-test="compras-pos-linea-cantidad"
                                            />
                                            <Input
                                                type="number"
                                                min={0}
                                                aria-label="Costo unitario"
                                                value={linea.costoUnitario}
                                                onChange={(event) =>
                                                    onLinea(linea.key, {
                                                        costoUnitario:
                                                            Number(
                                                                event.target
                                                                    .value,
                                                            ) || 0,
                                                    })
                                                }
                                                className="h-8 text-right"
                                                data-test="compras-pos-linea-costo"
                                            />
                                            <Select
                                                disabled={recibida > 0}
                                                value={String(linea.bodegaId)}
                                                onValueChange={(valor) =>
                                                    onLinea(linea.key, {
                                                        bodegaId: Number(valor),
                                                    })
                                                }
                                            >
                                                <SelectTrigger
                                                    className="h-8 w-full"
                                                    aria-label="Bodega de la línea"
                                                >
                                                    <SelectValue />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {bodegas.map((bodega) => (
                                                        <SelectItem
                                                            key={bodega.id}
                                                            value={String(
                                                                bodega.id,
                                                            )}
                                                        >
                                                            {
                                                                bodega.nombre_bodega
                                                            }
                                                        </SelectItem>
                                                    ))}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        <p className="text-muted-foreground text-right text-xs">
                                            {moneda.format(
                                                linea.cantidad *
                                                    linea.costoUnitario,
                                            )}
                                        </p>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <InputError message={errores.detalles} />
                </div>

                <div className="flex items-center justify-between gap-4 rounded-md border p-3">
                    <div>
                        <Label htmlFor="compras-pos-recibido">
                            {edicion
                                ? 'Los productos nuevos ya llegaron'
                                : 'Mercancía recibida'}
                        </Label>
                        <p className="text-muted-foreground text-xs">
                            {encabezado.recibido
                                ? 'El stock se suma al guardar.'
                                : 'Queda pendiente por recibir.'}
                        </p>
                    </div>
                    <Switch
                        id="compras-pos-recibido"
                        checked={encabezado.recibido}
                        onCheckedChange={(valor) => onCampo('recibido', valor)}
                        data-test="compras-pos-recibido"
                    />
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <div className="grid gap-2">
                        <Label htmlFor="compras-pos-descuento">Descuento</Label>
                        <Input
                            id="compras-pos-descuento"
                            type="number"
                            min={0}
                            value={encabezado.descuento}
                            onChange={(event) =>
                                onCampo('descuento', event.target.value)
                            }
                        />
                    </div>
                    <div className="grid gap-2">
                        <Label htmlFor="compras-pos-observaciones">
                            Observaciones
                        </Label>
                        <Textarea
                            id="compras-pos-observaciones"
                            rows={1}
                            value={encabezado.observaciones}
                            onChange={(event) =>
                                onCampo('observaciones', event.target.value)
                            }
                        />
                    </div>
                </div>
            </div>

            <div className="bg-card shrink-0 space-y-3 border-t p-4">
                <div className="space-y-1 text-sm">
                    <div className="flex justify-between">
                        <span className="text-muted-foreground">Subtotal:</span>
                        <span>{moneda.format(subtotal)}</span>
                    </div>
                    {descuento > 0 ? (
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Descuento:
                            </span>
                            <span>-{moneda.format(descuento)}</span>
                        </div>
                    ) : null}
                    <div className="flex justify-between text-base font-semibold">
                        <span>Total:</span>
                        <span>{moneda.format(total)}</span>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                    <Button
                        type="button"
                        onClick={onRegistrar}
                        disabled={!puedeRegistrar}
                        loading={procesando}
                        data-test="compras-pos-registrar"
                    >
                        {edicion ? 'Revisar y guardar' : 'Registrar compra'}
                        <kbd className="text-xs opacity-70">F9</kbd>
                    </Button>
                    <Button
                        type="button"
                        variant="outline"
                        onClick={onLimpiar}
                        className="text-destructive hover:text-destructive"
                    >
                        <RotateCcw className="size-4" />
                        {edicion ? 'Descartar cambios' : 'Limpiar'}
                        <kbd className="text-xs opacity-70">F8</kbd>
                    </Button>
                </div>
            </div>
        </div>
    );
}
