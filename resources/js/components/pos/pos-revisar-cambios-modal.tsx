import { ArrowRight, Minus, Pencil, Plus } from 'lucide-react';
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
import { Textarea } from '@/components/ui/textarea';
import type { PosCartLine } from '@/hooks/use-pos-cart';
import type { PosHeaderState } from '@/hooks/use-pos-header';
import { cn } from '@/lib/utils';

/** A change to one line, from what the pedido had to what it will have. */
export type CambioLinea = {
    key: string;
    nombre: string;
    tipo: 'agregada' | 'quitada' | 'modificada';
    antes?: PosCartLine;
    despues?: PosCartLine;
};

type Ajuste = 'descuento' | 'flete' | 'reteica' | 'retefuente';

type Props = {
    header: PosHeaderState;
    onFieldChange: <K extends keyof PosHeaderState>(
        key: K,
        value: PosHeaderState[K],
    ) => void;
    /** Descuento, flete and retenciones (pedidos.update-datos). */
    puedeCambiarAjustes: boolean;
    cambiosLineas: CambioLinea[];
    /** Changes to the pedido's data, already worded ("Cliente: A → B"). */
    cambiosDatos: string[];
    totalAntes: number;
    totalDespues: number;
    abonado: number;
    errors: Partial<Record<string, string>>;
    processing: boolean;
    onGuardar: () => void;
    onClose: () => void;
};

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

const AJUSTES: { clave: Ajuste; label: string }[] = [
    { clave: 'descuento', label: 'Descuento' },
    { clave: 'flete', label: 'Flete' },
    { clave: 'reteica', label: 'ReteICA' },
    { clave: 'retefuente', label: 'Retefuente' },
];

function lineaTexto(linea: PosCartLine): string {
    return `${linea.cantidad} × ${moneda.format(linea.precioUnitario)}`;
}

/**
 * The last step of editing a pedido: what changed, the adjustments, the new
 * total and what the cliente will owe (or was overpaid), before saving.
 */
export default function PosRevisarCambiosModal({
    header,
    onFieldChange,
    puedeCambiarAjustes,
    cambiosLineas,
    cambiosDatos,
    totalAntes,
    totalDespues,
    abonado,
    errors,
    processing,
    onGuardar,
    onClose,
}: Props) {
    const saldo = totalDespues - abonado;
    const sinCambios =
        cambiosLineas.length === 0 &&
        cambiosDatos.length === 0 &&
        totalAntes === totalDespues;

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>Revisar y guardar cambios</DialogTitle>
                    <DialogDescription>
                        Así queda el pedido. Los abonos que ya tiene se
                        conservan.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-4" data-test="pos-revisar-cambios">
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
                                        data-test="pos-cambio-linea"
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

                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                        {AJUSTES.map((ajuste) => (
                            <div key={ajuste.clave} className="grid gap-1.5">
                                <Label htmlFor={`editar-${ajuste.clave}`}>
                                    {ajuste.label}
                                </Label>
                                <Input
                                    id={`editar-${ajuste.clave}`}
                                    type="number"
                                    min="0"
                                    value={header[ajuste.clave]}
                                    onChange={(event) =>
                                        onFieldChange(
                                            ajuste.clave,
                                            event.target.value,
                                        )
                                    }
                                    disabled={!puedeCambiarAjustes}
                                />
                                <InputError message={errors[ajuste.clave]} />
                            </div>
                        ))}
                    </div>

                    <div className="grid gap-1.5">
                        <Label htmlFor="editar-observacion-pago">
                            Observación de pago
                        </Label>
                        <Textarea
                            id="editar-observacion-pago"
                            rows={2}
                            value={header.observacionPago ?? ''}
                            onChange={(event) =>
                                onFieldChange(
                                    'observacionPago',
                                    event.target.value,
                                )
                            }
                        />
                    </div>

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
                                Ya abonado
                            </span>
                            <span className="text-emerald-600 tabular-nums dark:text-emerald-400">
                                {moneda.format(abonado)}
                            </span>
                        </div>
                        <div className="flex justify-between font-semibold">
                            <span>
                                {saldo >= 0
                                    ? 'Queda debiendo'
                                    : 'Saldo a favor del cliente'}
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

                    {saldo < 0 ? (
                        <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                            El cliente ya pagó más que el nuevo total. Recuerda
                            devolverle {moneda.format(-saldo)} o ajustar sus
                            abonos.
                        </p>
                    ) : null}

                    <InputError message={errors.pedido ?? errors.detalles} />
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
                        data-test="pos-guardar-cambios"
                    >
                        Guardar cambios
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
