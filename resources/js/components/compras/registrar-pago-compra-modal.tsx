import { router } from '@inertiajs/react';
import { useMemo, useState } from 'react';
import Combobox from '@/components/combobox';
import InputError from '@/components/input-error';
import { currencyFormatter } from '@/components/record-view';
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
import { store } from '@/routes/compras/abonos';
import type { Compra, PucOption } from '@/types';

type Props = {
    /** The compra to pay, or null while the modal is closed. */
    compra: Compra | null;
    pucs: PucOption[];
    onClose: () => void;
};

/** A payment to the proveedor of a compra: medio de pago, amount and note. */
export default function RegistrarPagoCompraModal({
    compra,
    pucs,
    onClose,
}: Props) {
    return (
        <Dialog
            open={compra !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent
                className="sm:max-w-md"
                data-test="registrar-pago-compra"
            >
                {compra ? (
                    <Formulario
                        key={compra.id}
                        compra={compra}
                        pucs={pucs}
                        onClose={onClose}
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

function Formulario({
    compra,
    pucs,
    onClose,
}: {
    compra: Compra;
    pucs: PucOption[];
    onClose: () => void;
}) {
    const saldo = Number(compra.saldo_pendiente);
    const [pucId, setPucId] = useState('');
    const [monto, setMonto] = useState(String(saldo));
    const [descripcion, setDescripcion] = useState('');
    const [procesando, setProcesando] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});

    const opciones = useMemo(
        () =>
            pucs.map((puc) => ({
                value: String(puc.id),
                label: puc.concatenar_subcuenta_concepto ?? `Cuenta ${puc.id}`,
            })),
        [pucs],
    );

    const montoNum = Number(monto) || 0;
    const valido = pucId !== '' && montoNum > 0 && montoNum <= saldo;

    const registrar = () => {
        if (!valido) {
            return;
        }

        router.post(
            store.url([compra.id]),
            { puc_id: pucId, monto: montoNum, descripcion },
            {
                preserveScroll: true,
                onStart: () => setProcesando(true),
                onFinish: () => setProcesando(false),
                onError: (errors) => setErrores(errors),
                onSuccess: onClose,
            },
        );
    };

    return (
        <>
            <DialogHeader>
                <DialogTitle>Registrar pago</DialogTitle>
                <DialogDescription>
                    Compra {compra.factura}
                    {compra.proveedor
                        ? ` · ${compra.proveedor.nombre_proveedor}`
                        : ''}
                </DialogDescription>
            </DialogHeader>

            <div className="grid grid-cols-3 gap-2 rounded-md border p-3 text-center text-sm">
                <div>
                    <div className="text-muted-foreground text-xs">Total</div>
                    <div className="font-semibold">
                        {currencyFormatter.format(Number(compra.total_a_pagar))}
                    </div>
                </div>
                <div>
                    <div className="text-muted-foreground text-xs">Pagado</div>
                    <div className="font-semibold text-emerald-600 dark:text-emerald-400">
                        {currencyFormatter.format(Number(compra.abono))}
                    </div>
                </div>
                <div>
                    <div className="text-muted-foreground text-xs">Saldo</div>
                    <div className="font-semibold text-red-600 dark:text-red-400">
                        {currencyFormatter.format(saldo)}
                    </div>
                </div>
            </div>

            <div className="grid gap-4">
                <div className="grid gap-2">
                    <Label required>Medio de pago</Label>
                    <Combobox
                        options={opciones}
                        value={pucId}
                        onValueChange={setPucId}
                        placeholder="Elige el medio de pago"
                        searchPlaceholder="Buscar..."
                        emptyText="Sin medios de pago."
                        dataTest="pago-compra-puc"
                    />
                    <InputError message={errores.puc_id} />
                </div>
                <div className="grid gap-2">
                    <Label required htmlFor="pago-compra-monto">
                        Monto
                    </Label>
                    <div className="flex gap-2">
                        <Input
                            id="pago-compra-monto"
                            type="number"
                            min={0}
                            max={saldo}
                            value={monto}
                            onChange={(event) => setMonto(event.target.value)}
                            data-test="pago-compra-monto"
                        />
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => setMonto(String(saldo))}
                        >
                            Todo
                        </Button>
                    </div>
                    {montoNum > saldo ? (
                        <p className="text-destructive text-sm">
                            Supera lo que se debe (
                            {currencyFormatter.format(saldo)}).
                        </p>
                    ) : null}
                    <InputError message={errores.monto} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="pago-compra-descripcion">Descripción</Label>
                    <Input
                        id="pago-compra-descripcion"
                        value={descripcion}
                        onChange={(event) => setDescripcion(event.target.value)}
                        placeholder="Ej.: transferencia #123"
                    />
                </div>
            </div>

            <DialogFooter>
                <Button type="button" variant="outline" onClick={onClose}>
                    Cancelar
                </Button>
                <Button
                    type="button"
                    onClick={registrar}
                    disabled={!valido}
                    loading={procesando}
                    data-test="pago-compra-registrar"
                >
                    Registrar pago
                </Button>
            </DialogFooter>
        </>
    );
}
