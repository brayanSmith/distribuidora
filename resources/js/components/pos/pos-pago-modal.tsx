import { Plus, Trash2 } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Combobox from '@/components/combobox';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import PosEntregaFields from '@/components/pos/pos-entrega-fields';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import type { PosAbono, PosNewAbono } from '@/hooks/use-pos-abonos';
import type { PosEntrega, PosHeaderState } from '@/hooks/use-pos-header';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { calcularTotales } from '@/lib/pos-totals';
import { fechaMasDias } from '@/lib/vencimiento';
import { cn } from '@/lib/utils';
import type { ClienteOption, PucOption, TipoPagoPedido } from '@/types';

/** The id of the checkout `<form>`; the submit button lives in this modal. */
export const POS_CHECKOUT_FORM_ID = 'pos-checkout-form';

type Props = {
    header: PosHeaderState;
    /** Days of credit of the cliente, for the suggested due date. */
    diasCredito: number;
    /** The cliente, to start the delivery data of a contra entrega with. */
    cliente: ClienteOption | null;
    onFieldChange: <K extends keyof PosHeaderState>(
        key: K,
        value: PosHeaderState[K],
    ) => void;
    totalBruto: number;
    pucs: PucOption[];
    abonos: PosAbono[];
    onAddAbono: (abono: PosNewAbono) => void;
    onRemoveAbono: (id: number) => void;
    totalAbonado: number;
    /** Built from the abonos' descriptions until it is edited by hand. */
    observacionPago: string;
    onObservacionPagoChange: (observacion: string) => void;
    errors: Partial<Record<string, string>>;
    processing: boolean;
    onClose: () => void;
};

const TIPOS_PAGO: { value: TipoPagoPedido; label: string }[] = [
    { value: 'CONTADO', label: 'Contado' },
    { value: 'SEPARADO', label: 'Separado' },
    { value: 'CREDITO', label: 'Crédito' },
    { value: 'CONTRA_ENTREGA', label: 'Contra entrega' },
];

const currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

/**
 * The delivery data of a contra entrega, taken from the cliente.
 */
function entregaDelCliente(
    cliente: ClienteOption | null,
    clienteId: string,
): PosEntrega {
    return {
        clienteId,
        direccion: cliente?.direccion ?? '',
        ciudad: cliente?.ciudad ?? '',
        telefono: cliente?.telefono ?? '',
        recibe: cliente?.razon_social ?? '',
        nota: '',
        fecha_programada: '',
    };
}

/**
 * Checkout step ("Proceder al Pago"): how the sale is paid (tipo de pago),
 * the adjustments (descuento, flete, reteica, retefuente), the resulting
 * total to pay and the payments (abonos) collected now. Submitting it
 * submits the POS form.
 */
export default function PosPagoModal({
    header,
    diasCredito,
    cliente,
    onFieldChange,
    totalBruto,
    pucs,
    abonos,
    onAddAbono,
    onRemoveAbono,
    totalAbonado,
    observacionPago,
    onObservacionPagoChange,
    errors,
    processing,
    onClose,
}: Props) {
    const finalizarRef = useRef<HTMLButtonElement>(null);

    // Contra entrega takes the cliente's address and phone, and takes them
    // again whenever another cliente is picked.
    useEffect(() => {
        if (
            header.tipoPago === 'CONTRA_ENTREGA' &&
            header.entrega?.clienteId !== header.clienteId
        ) {
            onFieldChange(
                'entrega',
                entregaDelCliente(cliente, header.clienteId),
            );
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [header.tipoPago, header.clienteId, header.entrega?.clienteId]);
    // F9 finalizes (the button ignores it while it is disabled).
    useHotkeys([{ key: 'F9', handler: () => finalizarRef.current?.click() }]);

    const [pucId, setPucId] = useState('');
    const [conCuantoPago, setConCuantoPago] = useState('');
    const [descripcion, setDescripcion] = useState('');

    const { total } = calcularTotales(totalBruto, header);
    const saldo = Math.max(total - totalAbonado, 0);
    // What the customer actually handed over across every abono, before
    // splitting it into what got applied (pagado) and what came back
    // (cambio) — shown separately so cash and applied amounts aren't confused.
    const totalPagoCon = useMemo(
        () => abonos.reduce((sum, abono) => sum + abono.conCuantoPago, 0),
        [abonos],
    );
    const cambioTotal = totalPagoCon - totalAbonado;
    const errorMessages = useMemo(
        () => Object.values(errors).filter(Boolean),
        [errors],
    );

    const pucOptions = useMemo(
        () =>
            pucs.map((item) => ({
                value: String(item.id),
                label:
                    item.concatenar_subcuenta_concepto ?? `Cuenta ${item.id}`,
            })),
        [pucs],
    );

    const puc = pucs.find((item) => String(item.id) === pucId);
    // The monto is calculated, not typed: what the customer pays now
    // ("Paga con", capped at the balance), or the whole balance when
    // "Paga con" is empty.
    const pagaConNum = Number(conCuantoPago) || 0;
    const montoNum = pagaConNum > 0 ? Math.min(pagaConNum, saldo) : saldo;
    const conCuantoNum = pagaConNum > 0 ? pagaConNum : montoNum;
    const cambioPreview = Math.max(conCuantoNum - montoNum, 0);
    const sobrepagado = totalAbonado > total;
    const canAddAbono = Boolean(puc) && montoNum > 0;

    // The totals include the abono being filled in (not yet added) so they
    // update live as the person types, the same way "Cambio" already does.
    const pendienteMonto = pagaConNum > 0 ? montoNum : 0;
    const displayPagoCon = totalPagoCon + (pagaConNum > 0 ? conCuantoNum : 0);
    const displayCambio = cambioTotal + (pagaConNum > 0 ? cambioPreview : 0);
    const displaySaldo = Math.max(saldo - pendienteMonto, 0);

    const handleAddAbono = () => {
        if (!puc || !canAddAbono) {
            return;
        }

        onAddAbono({
            pucId: puc.id,
            pucNombre: puc.concatenar_subcuenta_concepto ?? `Cuenta ${puc.id}`,
            monto: montoNum,
            conCuantoPago: conCuantoNum,
            descripcion: descripcion.trim(),
        });
        setConCuantoPago('');
        setDescripcion('');
    };

    const numberField = (
        key: 'descuento' | 'flete' | 'reteica' | 'retefuente',
        label: string,
    ) => (
        <div className="grid gap-2">
            <Label htmlFor={`pos-pago-${key}`}>{label}</Label>
            <Input
                id={`pos-pago-${key}`}
                type="number"
                min={0}
                value={header[key]}
                onChange={(event) => onFieldChange(key, event.target.value)}
                data-test={`pos-pago-${key}`}
            />
        </div>
    );

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent
                className="w-full max-w-none p-4 sm:w-[calc(100%-1.5rem)] sm:max-w-2xl sm:p-6"
                data-test="pos-pago-modal"
            >
                <DialogHeader>
                    <DialogTitle>Proceder al pago</DialogTitle>
                    <DialogDescription>
                        Confirma cómo se paga la venta antes de finalizarla.
                    </DialogDescription>
                </DialogHeader>

                {errorMessages.length > 0 ? (
                    <ul className="bg-destructive/10 text-destructive list-disc rounded-md p-3 pl-6 text-sm">
                        {errorMessages.map((message) => (
                            <li key={message}>{message}</li>
                        ))}
                    </ul>
                ) : null}

                <div className="grid gap-2">
                    <Label>Tipo de pago</Label>
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        value={header.tipoPago}
                        onValueChange={(value) => {
                            if (value) {
                                onFieldChange(
                                    'tipoPago',
                                    value as TipoPagoPedido,
                                );

                                if (
                                    value === 'CREDITO' &&
                                    !header.fechaVencimiento
                                ) {
                                    onFieldChange(
                                        'fechaVencimiento',
                                        fechaMasDias(diasCredito),
                                    );
                                }
                            }
                        }}
                        className="flex-wrap justify-start"
                        data-test="pos-pago-tipo"
                    >
                        {TIPOS_PAGO.map((tipo) => (
                            <ToggleGroupItem
                                key={tipo.value}
                                value={tipo.value}
                                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
                            >
                                {tipo.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>

                {header.tipoPago === 'CONTRA_ENTREGA' && header.entrega ? (
                    <PosEntregaFields
                        entrega={header.entrega}
                        onChange={(entrega) =>
                            onFieldChange('entrega', entrega)
                        }
                        onUsarDatosCliente={
                            cliente
                                ? () =>
                                      onFieldChange(
                                          'entrega',
                                          entregaDelCliente(
                                              cliente,
                                              header.clienteId,
                                          ),
                                      )
                                : undefined
                        }
                        errors={errors}
                    />
                ) : null}

                {header.tipoPago === 'CREDITO' ? (
                    <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                        <Label htmlFor="pos-pago-vencimiento">
                            El saldo vence el
                        </Label>
                        <Input
                            id="pos-pago-vencimiento"
                            type="date"
                            value={
                                header.fechaVencimiento ||
                                fechaMasDias(diasCredito)
                            }
                            onChange={(event) =>
                                onFieldChange(
                                    'fechaVencimiento',
                                    event.target.value,
                                )
                            }
                            data-test="pos-pago-vencimiento"
                        />
                        <p className="text-muted-foreground text-xs">
                            {diasCredito > 0
                                ? `El cliente tiene ${diasCredito} días de crédito.`
                                : 'El cliente no tiene días de crédito configurados.'}
                        </p>
                    </div>
                ) : null}

                <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                    {numberField('descuento', 'Descuento')}
                    {numberField('flete', 'Flete')}
                    {numberField('reteica', 'Reteica')}
                    {numberField('retefuente', 'Retefuente')}
                </div>

                <div className="bg-muted/40 flex flex-wrap items-center justify-between gap-2 rounded-md border p-3">
                    <span className="text-muted-foreground text-sm">
                        Total Bruto: {currencyFormatter.format(totalBruto)}
                    </span>
                    <span className="text-lg font-semibold">
                        Total a pagar: {currencyFormatter.format(total)}
                    </span>
                </div>

                <div className="grid gap-4 rounded-md border p-4">
                    <p className="text-sm font-semibold">Abonos</p>

                    <div className="grid gap-3 md:grid-cols-2">
                        <div className="grid min-w-0 gap-2">
                            <Label>Método de pago</Label>
                            <Combobox
                                // A long name wraps onto more lines instead of widening the modal.
                                className="h-auto min-h-9 whitespace-normal [&>span]:line-clamp-none [&>span]:min-w-0 [&>span]:break-words"
                                options={pucOptions}
                                value={pucId}
                                onValueChange={setPucId}
                                searchPlaceholder="Buscar método de pago..."
                                emptyText="No se encontraron métodos de pago."
                                dataTest="pos-abono-puc"
                            />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="pos-abono-con-cuanto">
                                Paga con
                            </Label>
                            <Input
                                id="pos-abono-con-cuanto"
                                type="number"
                                min={0}
                                value={conCuantoPago}
                                placeholder={String(montoNum)}
                                onChange={(event) =>
                                    setConCuantoPago(event.target.value)
                                }
                                data-test="pos-abono-con-cuanto"
                            />
                        </div>

                        <div className="grid gap-2 md:col-span-2">
                            <Label htmlFor="pos-abono-descripcion">
                                Descripción
                            </Label>
                            <Input
                                id="pos-abono-descripcion"
                                value={descripcion}
                                placeholder="Referencia del pago, banco, nota..."
                                onChange={(event) =>
                                    setDescripcion(event.target.value)
                                }
                                data-test="pos-abono-descripcion"
                            />
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-end gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            disabled={!canAddAbono}
                            onClick={handleAddAbono}
                            data-test="pos-abono-agregar"
                        >
                            <Plus /> Agregar abono
                        </Button>
                    </div>

                    {abonos.length > 0 ? (
                        <div className="grid gap-3 sm:grid-cols-2">
                            {abonos.map((abono) => (
                                <div
                                    key={abono.id}
                                    className="bg-muted/40 grid gap-1 rounded-md border p-3 text-sm"
                                    data-test="pos-abono-item"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <span className="font-medium break-words">
                                            {abono.pucNombre}
                                        </span>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            className="-mt-1 -mr-2 shrink-0"
                                            onClick={() =>
                                                onRemoveAbono(abono.id)
                                            }
                                        >
                                            <Trash2 className="size-4" />
                                        </Button>
                                    </div>
                                    <span className="text-lg font-semibold">
                                        {currencyFormatter.format(abono.monto)}
                                    </span>
                                    <span className="text-muted-foreground text-xs">
                                        Paga con{' '}
                                        {currencyFormatter.format(
                                            abono.conCuantoPago,
                                        )}{' '}
                                        · Cambio{' '}
                                        {currencyFormatter.format(
                                            abono.conCuantoPago - abono.monto,
                                        )}
                                    </span>
                                    {abono.descripcion ? (
                                        <span className="text-muted-foreground text-xs break-words">
                                            {abono.descripcion}
                                        </span>
                                    ) : null}
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-sm">
                            Sin abonos: el pedido quedará pendiente de pago.
                        </p>
                    )}

                    <div className="border-t pt-3 text-sm">
                        <div className="divide-y sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0 lg:grid-cols-4">
                            <span className="block py-1.5 first:pt-0 sm:px-3 sm:py-0 sm:first:pl-0">
                                Total a pagar:{' '}
                                <strong>
                                    {currencyFormatter.format(total)}
                                </strong>
                            </span>
                            <span className="block py-1.5 sm:px-3 sm:py-0">
                                Pagó con:{' '}
                                <strong>
                                    {currencyFormatter.format(displayPagoCon)}
                                </strong>
                            </span>
                            <span
                                className={cn(
                                    'block py-1.5 sm:px-3 sm:py-0',
                                    displayCambio > 0 && 'text-emerald-600',
                                )}
                            >
                                Cambio a entregar:{' '}
                                <strong>
                                    {currencyFormatter.format(displayCambio)}
                                </strong>
                            </span>
                            <span
                                className={cn(
                                    'block py-1.5 last:pb-0 sm:px-3 sm:py-0',
                                    displaySaldo > 0 && 'text-destructive',
                                )}
                            >
                                Saldo pendiente:{' '}
                                <strong>
                                    {currencyFormatter.format(displaySaldo)}
                                </strong>
                            </span>
                        </div>
                        {sobrepagado ? (
                            <p className="text-destructive mt-2">
                                Los abonos superan el total a pagar por{' '}
                                {currencyFormatter.format(totalAbonado - total)}
                                ; elimina o reduce un abono.
                            </p>
                        ) : null}
                    </div>
                </div>

                <div className="grid gap-2">
                    <Label htmlFor="pos-observacion-pago">
                        Observación de pago
                    </Label>
                    <Textarea
                        id="pos-observacion-pago"
                        rows={Math.max(observacionPago.split('\n').length, 2)}
                        value={observacionPago}
                        onChange={(event) =>
                            onObservacionPagoChange(event.target.value)
                        }
                        placeholder="Se llena con las descripciones de los abonos; puedes editarla."
                        data-test="pos-observacion-pago"
                    />
                </div>

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Volver
                    </Button>
                    <Button
                        ref={finalizarRef}
                        type="submit"
                        form={POS_CHECKOUT_FORM_ID}
                        disabled={processing || sobrepagado}
                        data-test="pos-facturar"
                    >
                        Finalizar venta
                        <kbd className="text-xs opacity-70">F9</kbd>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
