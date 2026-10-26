import {
    PackagePlus,
    PackageSearch,
    Plus,
    RotateCcw,
    Trash2,
    Truck,
    X,
} from 'lucide-react';
import { useState } from 'react';
import { ProveedorCard } from '@/components/compras-pos/proveedor-modal';
import InputError from '@/components/input-error';
import CantidadStepper from '@/components/pos/cantidad-stepper';
import PanelSeccion from '@/components/pos/panel-seccion';
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
    const [verObservaciones, setVerObservaciones] = useState(false);
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
        <div className="bg-card flex flex-col overflow-hidden rounded-lg border shadow-sm lg:max-h-[calc(100svh-6rem)]">
            <div className="bg-primary text-primary-foreground flex shrink-0 items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold">
                        <PackagePlus className="size-4 shrink-0" />
                        <span className="truncate">
                            {edicion ? edicion.titulo : 'Nueva compra'}
                        </span>
                    </div>
                    <div className="text-primary-foreground/75 text-xs">
                        {lineas.length}{' '}
                        {lineas.length === 1 ? 'producto' : 'productos'} ·{' '}
                        {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
                    </div>
                </div>
                <span className="text-lg font-bold tabular-nums">
                    {moneda.format(total)}
                </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
                <PanelSeccion
                    titulo="Proveedor"
                    accion={
                        proveedor ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-xs"
                                onClick={onElegirProveedor}
                                data-test="compras-pos-proveedor"
                            >
                                <Truck className="size-3.5" />
                                Cambiar
                                <kbd className="opacity-60">F3</kbd>
                            </Button>
                        ) : null
                    }
                >
                    {proveedor ? (
                        <ProveedorCard proveedor={proveedor} />
                    ) : (
                        <button
                            type="button"
                            onClick={onElegirProveedor}
                            data-test="compras-pos-proveedor"
                            className="hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-foreground flex w-full items-center gap-3 rounded-md border-2 border-dashed p-3 text-left text-sm transition-colors"
                        >
                            <Truck className="size-5 shrink-0" />
                            <span className="flex-1 font-medium">
                                Seleccionar proveedor
                            </span>
                            <kbd className="text-xs opacity-70">F3</kbd>
                        </button>
                    )}
                    <InputError message={errores.proveedor_id} />
                </PanelSeccion>

                <PanelSeccion titulo="Factura">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1.5">
                            <Label
                                required
                                htmlFor="compras-pos-factura"
                                className="text-xs"
                            >
                                Número
                            </Label>
                            <Input
                                id="compras-pos-factura"
                                value={encabezado.factura}
                                onChange={(event) =>
                                    onCampo('factura', event.target.value)
                                }
                                placeholder="Ej.: FAC-123"
                                data-test="compras-pos-factura"
                            />
                            <InputError message={errores.factura} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label required className="text-xs">
                                Bodega
                            </Label>
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
                </PanelSeccion>

                <PanelSeccion
                    titulo={`Productos${lineas.length > 0 ? ` (${lineas.length})` : ''}`}
                    accion={
                        lineas.length > 0 && !edicion ? (
                            <button
                                type="button"
                                onClick={onLimpiar}
                                className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-xs"
                            >
                                <Trash2 className="size-3.5" />
                                Vaciar
                            </button>
                        ) : null
                    }
                >
                    {lineas.length === 0 ? (
                        <div className="text-muted-foreground flex flex-col items-center gap-1.5 rounded-md border border-dashed py-6 text-center text-sm">
                            <PackageSearch className="size-6 opacity-60" />
                            Toca un producto del catálogo para agregarlo.
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {lineas.map((linea) => {
                                // What already arrived can't be undone here.
                                const recibida =
                                    edicion?.recibidas.get(linea.key) ?? 0;

                                return (
                                    <div
                                        key={linea.key}
                                        className="hover:border-primary/40 grid gap-2 rounded-md border p-2.5 transition-colors"
                                        data-test="compras-pos-linea"
                                    >
                                        <div className="flex items-start gap-2">
                                            <div className="min-w-0 flex-1">
                                                <p className="line-clamp-2 text-sm leading-snug font-medium break-words">
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
                                            <span className="shrink-0 text-sm font-semibold tabular-nums">
                                                {moneda.format(
                                                    linea.cantidad *
                                                        linea.costoUnitario,
                                                )}
                                            </span>
                                            <button
                                                type="button"
                                                aria-label="Quitar"
                                                onClick={() =>
                                                    onQuitar(linea.key)
                                                }
                                                className="text-muted-foreground hover:text-destructive -mt-0.5 -mr-0.5 rounded p-0.5"
                                            >
                                                <X className="size-4" />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <CantidadStepper
                                                value={linea.cantidad}
                                                min={Math.max(1, recibida)}
                                                onChange={(cantidad) =>
                                                    onLinea(linea.key, {
                                                        cantidad,
                                                    })
                                                }
                                                dataTest="compras-pos-linea-cantidad"
                                            />
                                            <div className="relative min-w-0 flex-1">
                                                <span className="text-muted-foreground pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs">
                                                    $
                                                </span>
                                                <input
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
                                                    className="border-input focus-visible:border-ring focus-visible:ring-ring/50 h-8 w-full rounded-md border bg-transparent pr-2 pl-5 text-right text-sm tabular-nums outline-none focus-visible:ring-[3px]"
                                                    data-test="compras-pos-linea-costo"
                                                />
                                            </div>
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
                                                    className="h-8 w-28 shrink-0"
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
                                    </div>
                                );
                            })}
                        </div>
                    )}
                    <InputError message={errores.detalles} />
                </PanelSeccion>

                <PanelSeccion titulo="Opciones">
                    <label
                        htmlFor="compras-pos-recibido"
                        className="flex cursor-pointer items-center justify-between gap-4 rounded-md border p-3"
                    >
                        <div>
                            <div className="text-sm font-medium">
                                {edicion
                                    ? 'Los productos nuevos ya llegaron'
                                    : 'Mercancía recibida'}
                            </div>
                            <p className="text-muted-foreground text-xs">
                                {encabezado.recibido
                                    ? 'El stock se suma al guardar.'
                                    : 'Queda pendiente por recibir.'}
                            </p>
                        </div>
                        <Switch
                            id="compras-pos-recibido"
                            checked={encabezado.recibido}
                            onCheckedChange={(valor) =>
                                onCampo('recibido', valor)
                            }
                            data-test="compras-pos-recibido"
                        />
                    </label>

                    <div className="grid gap-1.5">
                        <Label
                            htmlFor="compras-pos-descuento"
                            className="text-xs"
                        >
                            Descuento
                        </Label>
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

                    {verObservaciones || encabezado.observaciones ? (
                        <div className="grid gap-1.5">
                            <Label
                                htmlFor="compras-pos-observaciones"
                                className="text-xs"
                            >
                                Observaciones
                            </Label>
                            <Textarea
                                id="compras-pos-observaciones"
                                rows={2}
                                autoFocus={
                                    verObservaciones &&
                                    !encabezado.observaciones
                                }
                                value={encabezado.observaciones}
                                onChange={(event) =>
                                    onCampo('observaciones', event.target.value)
                                }
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setVerObservaciones(true)}
                            className="text-primary flex items-center gap-1 justify-self-start text-sm hover:underline"
                        >
                            <Plus className="size-3.5" />
                            Agregar observaciones
                        </button>
                    )}
                </PanelSeccion>
            </div>

            <div className="bg-muted/30 shrink-0 space-y-3 border-t p-4">
                <div className="space-y-0.5 text-sm">
                    <div className="text-muted-foreground flex justify-between">
                        <span>Subtotal</span>
                        <span className="tabular-nums">
                            {moneda.format(subtotal)}
                        </span>
                    </div>
                    {descuento > 0 ? (
                        <div className="text-muted-foreground flex justify-between">
                            <span>Descuento</span>
                            <span className="tabular-nums">
                                -{moneda.format(descuento)}
                            </span>
                        </div>
                    ) : null}
                    <div className="flex items-baseline justify-between pt-1">
                        <span className="font-semibold">Total</span>
                        <span className="text-2xl font-bold tabular-nums">
                            {moneda.format(total)}
                        </span>
                    </div>
                </div>

                <Button
                    type="button"
                    size="lg"
                    className="h-11 w-full text-base"
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
                    variant="ghost"
                    size="sm"
                    onClick={onLimpiar}
                    className="text-muted-foreground hover:text-destructive w-full"
                >
                    <RotateCcw className="size-4" />
                    {edicion ? 'Descartar cambios' : 'Limpiar'}
                    <kbd className="text-xs opacity-70">F8</kbd>
                </Button>
            </div>
        </div>
    );
}
