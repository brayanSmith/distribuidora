import { Form } from '@inertiajs/react';
import { useEffect, useMemo, useState } from 'react';
import Combobox from '@/components/combobox';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import type {
    Pedido,
    PedidoAbono,
    PedidoRoutes,
    PucOption,
    VendedorOption,
} from '@/types';

type Props = {
    pedido: Pedido;
    routes: PedidoRoutes;
    abono: PedidoAbono | null;
    pucs: PucOption[];
    vendedores: VendedorOption[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export default function EditAbonoModal({
    pedido,
    routes,
    abono,
    pucs,
    vendedores,
    open,
    onOpenChange,
}: Props) {
    const [pucId, setPucId] = useState<string>(
        abono?.puc_id ? String(abono.puc_id) : '',
    );
    const [vendedorId, setVendedorId] = useState<string>(
        abono?.vendedor_id ? String(abono.vendedor_id) : '',
    );
    const [monto, setMonto] = useState<string>(abono?.monto ?? '');
    const [conCuantoPago, setConCuantoPago] = useState<string>(
        abono?.con_cuanto_pago ?? '',
    );

    const pucOptions = useMemo(
        () =>
            pucs.map((puc) => ({
                value: String(puc.id),
                label: puc.concatenar_subcuenta_concepto ?? `Puc ${puc.id}`,
            })),
        [pucs],
    );
    const vendedorOptions = useMemo(
        () =>
            vendedores.map((vendedor) => ({
                value: String(vendedor.id),
                label: vendedor.name,
            })),
        [vendedores],
    );

    useEffect(() => {
        if (abono) {
            setPucId(abono.puc_id ? String(abono.puc_id) : '');
            setVendedorId(abono.vendedor_id ? String(abono.vendedor_id) : '');
            setMonto(abono.monto ?? '');
            setConCuantoPago(abono.con_cuanto_pago ?? '');
        }
    }, [abono]);

    const montoNum = Number(monto) || 0;
    const conCuantoNum = Number(conCuantoPago) || montoNum;

    // Paying less than the monto registers a partial abono of what was paid.
    const abonoParcial =
        Number(conCuantoPago) > 0 && Number(conCuantoPago) < Number(monto)
            ? Number(conCuantoPago)
            : null;

    // The other abonos of the pedido, so the totals below reflect the whole
    // pedido and update live as this abono's monto / con cuánto pagó change.
    const { otrosMonto, otrosConCuanto } = useMemo(() => {
        const otros = (pedido.abonos ?? []).filter(
            (item) => item.id !== abono?.id,
        );

        return {
            otrosMonto: otros.reduce(
                (sum, item) => sum + Number(item.monto),
                0,
            ),
            otrosConCuanto: otros.reduce(
                (sum, item) => sum + Number(item.con_cuanto_pago ?? item.monto),
                0,
            ),
        };
    }, [pedido.abonos, abono?.id]);

    const totalPedido = Number(pedido.total_a_pagar);
    const totalPagado = otrosMonto + montoNum;
    const totalPagoCon = otrosConCuanto + conCuantoNum;
    const cambioTotal = totalPagoCon - totalPagado;
    const saldoPendiente = Math.max(totalPedido - totalPagado, 0);

    if (!abono) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <Form
                    key={String(open)}
                    {...routes.abonos.update.form([pedido.id, abono.id])}
                    className="space-y-6"
                    onSuccess={() => onOpenChange(false)}
                >
                    {({ errors, processing }) => (
                        <>
                            <DialogHeader>
                                <DialogTitle>Editar pago</DialogTitle>
                                <DialogDescription>
                                    Actualiza el abono registrado.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-4">
                                <div className="grid gap-2">
                                    <Label required>Método de pago</Label>
                                    <Combobox
                                        options={pucOptions}
                                        value={pucId}
                                        onValueChange={setPucId}
                                        searchPlaceholder="Buscar método de pago..."
                                        emptyText="No se encontraron métodos de pago."
                                        dataTest="edit-abono-puc"
                                    />
                                    <input
                                        type="hidden"
                                        name="puc_id"
                                        value={pucId}
                                    />
                                    <InputError message={errors.puc_id} />
                                </div>

                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label required htmlFor="edit_monto">
                                            Monto
                                        </Label>
                                        <Input
                                            id="edit_monto"
                                            name="monto"
                                            type="number"
                                            min="0.01"
                                            step="0.01"
                                            data-test="edit-abono-monto"
                                            value={monto}
                                            onChange={(event) =>
                                                setMonto(event.target.value)
                                            }
                                            required
                                        />
                                        <InputError message={errors.monto} />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="edit_con_cuanto_pago">
                                            Con cuánto pagó
                                        </Label>
                                        <Input
                                            id="edit_con_cuanto_pago"
                                            name="con_cuanto_pago"
                                            type="number"
                                            min="0"
                                            step="0.01"
                                            data-test="edit-abono-con-cuanto-pago"
                                            value={conCuantoPago}
                                            onChange={(event) =>
                                                setConCuantoPago(
                                                    event.target.value,
                                                )
                                            }
                                        />
                                        <InputError
                                            message={errors.con_cuanto_pago}
                                        />
                                    </div>
                                </div>

                                <div className="bg-muted rounded-md px-3 py-2 text-sm">
                                    <div className="divide-y sm:grid sm:grid-cols-2 sm:divide-x sm:divide-y-0">
                                        <span className="block py-1.5 first:pt-0 sm:px-3 sm:py-0 sm:first:pl-0">
                                            Total a pagar:{' '}
                                            <strong>
                                                {currencyFormatter.format(
                                                    totalPedido,
                                                )}
                                            </strong>
                                        </span>
                                        <span className="block py-1.5 sm:px-3 sm:py-0">
                                            Pagó con:{' '}
                                            <strong>
                                                {currencyFormatter.format(
                                                    totalPagoCon,
                                                )}
                                            </strong>
                                        </span>
                                        <span
                                            className={cn(
                                                'block py-1.5 sm:px-3 sm:py-0',
                                                cambioTotal > 0 &&
                                                    'text-emerald-600',
                                            )}
                                        >
                                            Cambio a entregar:{' '}
                                            <strong>
                                                {currencyFormatter.format(
                                                    cambioTotal,
                                                )}
                                            </strong>
                                        </span>
                                        <span
                                            className={cn(
                                                'block py-1.5 last:pb-0 sm:px-3 sm:py-0',
                                                saldoPendiente > 0 &&
                                                    'text-destructive',
                                            )}
                                        >
                                            Saldo pendiente:{' '}
                                            <strong>
                                                {currencyFormatter.format(
                                                    saldoPendiente,
                                                )}
                                            </strong>
                                        </span>
                                    </div>
                                </div>

                                {abonoParcial !== null ? (
                                    <p
                                        data-test="abono-parcial"
                                        className="text-sm text-amber-600 dark:text-amber-400"
                                    >
                                        Abono parcial: se registrará{' '}
                                        {currencyFormatter.format(abonoParcial)}
                                        .
                                    </p>
                                ) : null}

                                <div className="grid gap-2">
                                    <Label>Vendedor</Label>
                                    <Combobox
                                        options={vendedorOptions}
                                        value={vendedorId}
                                        onValueChange={setVendedorId}
                                        searchPlaceholder="Buscar vendedor..."
                                        emptyText="No se encontraron vendedores."
                                        dataTest="edit-abono-vendedor"
                                    />
                                    <input
                                        type="hidden"
                                        name="vendedor_id"
                                        value={vendedorId}
                                    />
                                    <InputError message={errors.vendedor_id} />
                                </div>

                                <div className="grid gap-2">
                                    <Label htmlFor="edit_descripcion">
                                        Observaciones
                                    </Label>
                                    <Input
                                        id="edit_descripcion"
                                        name="descripcion"
                                        data-test="edit-abono-descripcion"
                                        defaultValue={abono.descripcion ?? ''}
                                    />
                                    <InputError message={errors.descripcion} />
                                </div>
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button variant="secondary">
                                        Cancelar
                                    </Button>
                                </DialogClose>

                                <Button
                                    type="submit"
                                    data-test="edit-abono-submit"
                                    disabled={processing}
                                >
                                    Guardar cambios
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
