import { Plus, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import Combobox from '@/components/combobox';
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
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { useHotkeys } from '@/hooks/use-hotkeys';
import type { PucOption } from '@/types';

/** Cash: paid in full now. Credit: paid later, by its due date. */
export type TipoPagoCompra = 'CONTADO' | 'CREDITO';

const TIPOS_PAGO: { value: TipoPagoCompra; label: string }[] = [
    { value: 'CONTADO', label: 'Contado' },
    { value: 'CREDITO', label: 'Crédito' },
];

/** A payment to the proveedor taken while registering the compra. */
export type PagoCompra = {
    id: number;
    pucId: number;
    pucNombre: string;
    monto: number;
    descripcion: string;
};

type Props = {
    total: number;
    pucs: PucOption[];
    pagos: PagoCompra[];
    onAgregar: (pago: Omit<PagoCompra, 'id'>) => void;
    onQuitar: (id: number) => void;
    onRegistrar: () => void;
    tipoPago: TipoPagoCompra;
    onTipoPago: (tipo: TipoPagoCompra) => void;
    /** Due date (Y-m-d) of what stays owed. */
    vencimiento: string;
    onVencimiento: (fecha: string) => void;
    /** Days of credit the proveedor gives, to explain the suggested date. */
    diasCredito: number;
    procesando: boolean;
    errores: Record<string, string>;
    onClose: () => void;
};

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

/**
 * Last step of the compras POS: what is paid to the proveedor now — in full,
 * part of it or nothing (on credit) — before registering the compra.
 */
export default function CompraPagoModal({
    total,
    pucs,
    pagos,
    onAgregar,
    onQuitar,
    onRegistrar,
    tipoPago,
    onTipoPago,
    vencimiento,
    onVencimiento,
    diasCredito,
    procesando,
    errores,
    onClose,
}: Props) {
    const pagado = pagos.reduce((suma, pago) => suma + pago.monto, 0);
    const saldo = Math.max(total - pagado, 0);
    const [pucId, setPucId] = useState('');
    const [monto, setMonto] = useState('');
    const [descripcion, setDescripcion] = useState('');
    const registrarRef = useRef<HTMLButtonElement>(null);

    useHotkeys([{ key: 'F9', handler: () => registrarRef.current?.click() }]);

    const opciones = useMemo(
        () =>
            pucs.map((puc) => ({
                value: String(puc.id),
                label: puc.concatenar_subcuenta_concepto ?? `Cuenta ${puc.id}`,
            })),
        [pucs],
    );

    // Empty "monto" pays the whole balance.
    const montoNum = monto === '' ? saldo : Number(monto) || 0;
    const puedeAgregar =
        pucId !== '' && montoNum > 0 && montoNum <= saldo + 0.001;

    const agregar = () => {
        const puc = pucs.find((item) => String(item.id) === pucId);

        if (!puc || !puedeAgregar) {
            return;
        }

        onAgregar({
            pucId: puc.id,
            pucNombre: puc.concatenar_subcuenta_concepto ?? `Cuenta ${puc.id}`,
            monto: montoNum,
            descripcion: descripcion.trim(),
        });
        setMonto('');
        setDescripcion('');
    };

    const errorList = Object.values(errores).filter(Boolean);

    return (
        <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
            <DialogContent className="sm:max-w-lg" data-test="compras-pos-pago">
                <DialogHeader>
                    <DialogTitle>Pagar al proveedor</DialogTitle>
                    <DialogDescription>
                        {tipoPago === 'CONTADO'
                            ? 'De contado se paga el total ahora.'
                            : 'A crédito se paga después, antes de su vencimiento. Puedes dar un anticipo.'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-2">
                    <Label>Tipo de pago</Label>
                    <ToggleGroup
                        type="single"
                        variant="outline"
                        value={tipoPago}
                        onValueChange={(valor) => {
                            if (valor) {
                                onTipoPago(valor as TipoPagoCompra);
                            }
                        }}
                        className="justify-start"
                        data-test="compras-pos-tipo-pago"
                    >
                        {TIPOS_PAGO.map((tipo) => (
                            <ToggleGroupItem
                                key={tipo.value}
                                value={tipo.value}
                                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground data-[state=on]:hover:bg-primary/90"
                                data-test={`compras-pos-tipo-pago-${tipo.value}`}
                            >
                                {tipo.label}
                            </ToggleGroupItem>
                        ))}
                    </ToggleGroup>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-md border p-3 text-center text-sm">
                    <div>
                        <div className="text-muted-foreground text-xs">
                            Total
                        </div>
                        <div className="font-semibold">
                            {moneda.format(total)}
                        </div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs">
                            Pagado
                        </div>
                        <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                            {moneda.format(pagado)}
                        </div>
                    </div>
                    <div>
                        <div className="text-muted-foreground text-xs">
                            Saldo
                        </div>
                        <div className="font-semibold text-red-600 dark:text-red-400">
                            {moneda.format(saldo)}
                        </div>
                    </div>
                </div>

                {saldo > 0 ? (
                    <div className="grid gap-3 rounded-md border p-3">
                        <div className="grid gap-2">
                            <Label>Medio de pago</Label>
                            <Combobox
                                options={opciones}
                                value={pucId}
                                onValueChange={setPucId}
                                placeholder="Elige el medio de pago"
                                searchPlaceholder="Buscar..."
                                emptyText="Sin medios de pago."
                                dataTest="compras-pos-pago-puc"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                            <div className="grid gap-2">
                                <Label htmlFor="compras-pos-pago-monto">
                                    Monto
                                </Label>
                                <Input
                                    id="compras-pos-pago-monto"
                                    type="number"
                                    min={0}
                                    max={saldo}
                                    value={monto}
                                    placeholder={String(saldo)}
                                    onChange={(event) =>
                                        setMonto(event.target.value)
                                    }
                                    data-test="compras-pos-pago-monto"
                                />
                            </div>
                            <div className="grid gap-2">
                                <Label htmlFor="compras-pos-pago-descripcion">
                                    Descripción
                                </Label>
                                <Input
                                    id="compras-pos-pago-descripcion"
                                    value={descripcion}
                                    onChange={(event) =>
                                        setDescripcion(event.target.value)
                                    }
                                    placeholder="Ej.: transferencia"
                                />
                            </div>
                        </div>
                        {montoNum > saldo + 0.001 ? (
                            <p className="text-destructive text-sm">
                                Supera el saldo ({moneda.format(saldo)}).
                            </p>
                        ) : null}
                        <Button
                            type="button"
                            variant="outline"
                            onClick={agregar}
                            disabled={!puedeAgregar}
                            data-test="compras-pos-pago-agregar"
                        >
                            <Plus />
                            {monto === ''
                                ? `Pagar todo (${moneda.format(saldo)})`
                                : 'Agregar pago'}
                        </Button>
                    </div>
                ) : null}

                {pagos.length > 0 ? (
                    <ul className="divide-y rounded-md border text-sm">
                        {pagos.map((pago) => (
                            <li
                                key={pago.id}
                                className="flex items-center justify-between gap-2 p-2"
                                data-test="compras-pos-pago"
                            >
                                <div className="min-w-0">
                                    <div className="truncate font-medium">
                                        {pago.pucNombre}
                                    </div>
                                    {pago.descripcion ? (
                                        <div className="text-muted-foreground truncate text-xs">
                                            {pago.descripcion}
                                        </div>
                                    ) : null}
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                                        {moneda.format(pago.monto)}
                                    </span>
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        aria-label="Quitar pago"
                                        onClick={() => onQuitar(pago.id)}
                                    >
                                        <Trash2 className="size-4" />
                                    </Button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : null}

                {tipoPago === 'CREDITO' && saldo > 0 ? (
                    <div className="grid gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 dark:border-amber-900 dark:bg-amber-950/30">
                        <Label htmlFor="compras-pos-vencimiento">
                            El saldo de {moneda.format(saldo)} vence el
                        </Label>
                        <Input
                            id="compras-pos-vencimiento"
                            type="date"
                            value={vencimiento}
                            onChange={(event) =>
                                onVencimiento(event.target.value)
                            }
                            data-test="compras-pos-vencimiento"
                        />
                        <p className="text-muted-foreground text-xs">
                            {diasCredito > 0
                                ? `El proveedor da ${diasCredito} días de crédito.`
                                : 'El proveedor no tiene días de crédito configurados.'}
                        </p>
                    </div>
                ) : null}

                {tipoPago === 'CONTADO' && saldo > 0 ? (
                    <p className="text-sm text-amber-700 dark:text-amber-400">
                        Agrega pagos por {moneda.format(saldo)} más para
                        registrarla de contado, o cámbiala a crédito.
                    </p>
                ) : null}

                {errorList.map((mensaje) => (
                    <InputError key={mensaje} message={mensaje} />
                ))}

                <DialogFooter>
                    <Button type="button" variant="outline" onClick={onClose}>
                        Volver
                    </Button>
                    <Button
                        ref={registrarRef}
                        type="button"
                        onClick={onRegistrar}
                        loading={procesando}
                        disabled={tipoPago === 'CONTADO' && saldo > 0}
                        data-test="compras-pos-pago-registrar"
                    >
                        {tipoPago === 'CONTADO'
                            ? 'Registrar de contado'
                            : pagado > 0
                              ? 'Registrar a crédito con anticipo'
                              : 'Registrar a crédito'}
                        <kbd className="text-xs opacity-70">F9</kbd>
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
