import { ArrowRight, Minus, Pencil, Plus, Undo2 } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type { CompraPosLinea } from '@/types';

/** A change to one line, from what the compra had to what it will have. */
export type CambioLineaCompra = {
    key: string;
    nombre: string;
    tipo: 'agregada' | 'quitada' | 'modificada';
    antes?: CompraPosLinea;
    despues?: CompraPosLinea;
    /** Units that had arrived and leave the bodega with this change. */
    devueltas: number;
};

export type DatosFactura = {
    factura: string;
    fecha: string;
    fechaVencimiento: string;
};

type Props = {
    datos: DatosFactura;
    onDatos: (datos: DatosFactura) => void;
    cambiosLineas: CambioLineaCompra[];
    cambiosDatos: string[];
    totalAntes: number;
    totalDespues: number;
    pagado: number;
    errors: Record<string, string>;
    processing: boolean;
    onGuardar: () => void;
    onClose: () => void;
};

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

const lineaTexto = (linea: CompraPosLinea) =>
    `${linea.cantidad} × ${moneda.format(linea.costoUnitario)}`;

/**
 * The last step of editing a compra: the invoice data, what changed, the new
 * total against what was paid, and the goods that leave the bodega because
 * a received line was removed or cut.
 */
export default function CompraRevisarCambiosModal({
    datos,
    onDatos,
    cambiosLineas,
    cambiosDatos,
    totalAntes,
    totalDespues,
    pagado,
    errors,
    processing,
    onGuardar,
    onClose,
}: Props) {
    const saldo = totalDespues - pagado;
    const devueltas = cambiosLineas.filter((cambio) => cambio.devueltas > 0);
    const sinCambios =
        cambiosLineas.length === 0 &&
        cambiosDatos.length === 0 &&
        totalAntes === totalDespues;

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Revisar y guardar la compra</DialogTitle>
                    <DialogDescription>
                        Así queda la compra. Los pagos al proveedor se
                        conservan.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4" data-test="compra-revisar-cambios">
                    <div className="grid gap-3 sm:grid-cols-3">
                        <div className="grid gap-1.5">
                            <Label htmlFor="editar-factura" required>
                                Factura
                            </Label>
                            <Input
                                id="editar-factura"
                                value={datos.factura}
                                onChange={(event) =>
                                    onDatos({
                                        ...datos,
                                        factura: event.target.value,
                                    })
                                }
                            />
                            <InputError message={errors.factura} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="editar-fecha" required>
                                Fecha
                            </Label>
                            <Input
                                id="editar-fecha"
                                type="date"
                                value={datos.fecha}
                                onChange={(event) =>
                                    onDatos({
                                        ...datos,
                                        fecha: event.target.value,
                                    })
                                }
                            />
                            <InputError message={errors.fecha} />
                        </div>
                        <div className="grid gap-1.5">
                            <Label htmlFor="editar-vencimiento">Vence</Label>
                            <Input
                                id="editar-vencimiento"
                                type="date"
                                value={datos.fechaVencimiento}
                                onChange={(event) =>
                                    onDatos({
                                        ...datos,
                                        fechaVencimiento: event.target.value,
                                    })
                                }
                            />
                            <InputError message={errors.fecha_vencimiento} />
                        </div>
                    </div>

                    <div className="grid gap-1.5">
                        <Label>Qué cambió</Label>
                        {sinCambios ? (
                            <p className="text-muted-foreground text-sm">
                                Todavía no has cambiado nada.
                            </p>
                        ) : (
                            <ul className="divide-y rounded-md border text-sm">
                                {cambiosDatos.map((cambio) => (
                                    <li
                                        key={cambio}
                                        className="flex items-center gap-2 px-3 py-2"
                                    >
                                        <Pencil className="size-3.5 shrink-0 text-sky-600" />
                                        {cambio}
                                    </li>
                                ))}
                                {cambiosLineas.map((cambio) => (
                                    <li
                                        key={cambio.key}
                                        className="flex items-center gap-2 px-3 py-2"
                                    >
                                        {cambio.tipo === 'agregada' ? (
                                            <Plus className="size-3.5 shrink-0 text-emerald-600" />
                                        ) : cambio.tipo === 'quitada' ? (
                                            <Minus className="size-3.5 shrink-0 text-red-600" />
                                        ) : (
                                            <Pencil className="size-3.5 shrink-0 text-sky-600" />
                                        )}
                                        <span className="min-w-0 flex-1 truncate">
                                            {cambio.nombre}
                                        </span>
                                        <span className="text-muted-foreground flex shrink-0 items-center gap-1 text-xs tabular-nums">
                                            {cambio.antes ? (
                                                <span
                                                    className={cn(
                                                        cambio.tipo ===
                                                            'quitada' &&
                                                            'line-through',
                                                    )}
                                                >
                                                    {lineaTexto(cambio.antes)}
                                                </span>
                                            ) : null}
                                            {cambio.tipo === 'modificada' ? (
                                                <ArrowRight className="size-3" />
                                            ) : null}
                                            {cambio.despues ? (
                                                <span className="text-foreground font-medium">
                                                    {lineaTexto(cambio.despues)}
                                                </span>
                                            ) : null}
                                        </span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>

                    {devueltas.length > 0 ? (
                        <div
                            className="grid gap-1 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300"
                            data-test="compra-devoluciones"
                        >
                            <div className="flex items-center gap-2 font-medium">
                                <Undo2 className="size-4" />
                                Sale mercancía que ya había llegado
                            </div>
                            {devueltas.map((cambio) => (
                                <div key={cambio.key}>
                                    {cambio.devueltas} × {cambio.nombre}
                                </div>
                            ))}
                            <div className="text-xs">
                                Se descuenta de la bodega y queda en los
                                movimientos del producto.
                            </div>
                        </div>
                    ) : null}

                    <div className="bg-muted/40 grid gap-1 rounded-md border p-3 text-sm">
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Total antes
                            </span>
                            <span className="tabular-nums">
                                {moneda.format(totalAntes)}
                            </span>
                        </div>
                        <div className="flex justify-between text-base font-semibold">
                            <span>Total nuevo</span>
                            <span className="tabular-nums">
                                {moneda.format(totalDespues)}
                            </span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-muted-foreground">
                                Ya pagado
                            </span>
                            <span className="text-emerald-600 tabular-nums dark:text-emerald-400">
                                {moneda.format(pagado)}
                            </span>
                        </div>
                        <div className="flex justify-between font-semibold">
                            <span>
                                {saldo >= 0
                                    ? 'Se le debe al proveedor'
                                    : 'Saldo a favor (pagado de más)'}
                            </span>
                            <span
                                className={cn(
                                    'tabular-nums',
                                    saldo > 0 &&
                                        'text-red-600 dark:text-red-400',
                                    saldo < 0 &&
                                        'text-amber-600 dark:text-amber-400',
                                )}
                            >
                                {moneda.format(Math.abs(saldo))}
                            </span>
                        </div>
                    </div>

                    <InputError message={errors.detalles} />
                </div>

                <DialogFooter className="gap-2">
                    <Button type="button" variant="outline" onClick={onClose}>
                        Seguir editando
                    </Button>
                    <Button
                        type="button"
                        onClick={onGuardar}
                        loading={processing}
                        disabled={sinCambios}
                        data-test="compra-guardar-cambios"
                    >
                        Guardar cambios
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
