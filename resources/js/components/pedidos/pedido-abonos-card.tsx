import {
    CalendarDays,
    CheckCircle2,
    Pencil,
    Trash2,
    Wallet,
} from 'lucide-react';
import { useState } from 'react';
import DeleteAbonoModal from '@/components/pedidos/delete-abono-modal';
import EditAbonoModal from '@/components/pedidos/edit-abono-modal';
import RegistrarPagoModal from '@/components/pedidos/registrar-pago-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
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
    pucs: PucOption[];
    vendedores: VendedorOption[];
    canCreate?: boolean;
    canUpdate?: boolean;
    canDelete?: boolean;
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
});

export default function PedidoAbonosCard({
    pedido,
    routes,
    pucs,
    vendedores,
    canCreate = true,
    canUpdate = true,
    canDelete = true,
}: Props) {
    const [registrarOpen, setRegistrarOpen] = useState(false);
    const [editAbono, setEditAbono] = useState<PedidoAbono | null>(null);
    const [deleteAbono, setDeleteAbono] = useState<PedidoAbono | null>(null);

    const abonos = pedido.abonos ?? [];
    const saldado = Number(pedido.saldo_pendiente) <= 0;

    return (
        <div className="bg-card space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Abonos Registrados
                </div>
                {canCreate && !saldado ? (
                    <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        data-test="registrar-pago-button"
                        onClick={() => setRegistrarOpen(true)}
                    >
                        Registrar Pago
                    </Button>
                ) : null}
                {canCreate && saldado ? (
                    <Badge
                        className="border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100"
                        data-test="pedido-saldado-badge"
                    >
                        Pedido saldado
                    </Badge>
                ) : null}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/40 rounded-md border p-2">
                    <div className="text-muted-foreground text-xs">Total</div>
                    <div className="font-semibold tabular-nums">
                        {currencyFormatter.format(Number(pedido.total_a_pagar))}
                    </div>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="text-muted-foreground text-xs">Abonado</div>
                    <div className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                        {currencyFormatter.format(Number(pedido.abono))}
                    </div>
                </div>
                <div
                    className={cn(
                        'rounded-md border p-2',
                        saldado
                            ? 'bg-muted/40'
                            : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
                    )}
                >
                    <div className="text-muted-foreground text-xs">Debe</div>
                    <div
                        className={cn(
                            'font-semibold tabular-nums',
                            !saldado && 'text-red-700 dark:text-red-400',
                        )}
                    >
                        {currencyFormatter.format(
                            Math.max(Number(pedido.saldo_pendiente), 0),
                        )}
                    </div>
                </div>
            </div>

            {abonos.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                    Aún no hay pagos registrados para este pedido.
                </p>
            ) : (
                <div className="grid max-h-[50svh] gap-2 overflow-y-auto pr-1">
                    {abonos.map((abono) => {
                        const conCuanto = Number(
                            abono.con_cuanto_pago ?? abono.monto,
                        );
                        const cambio = Number(abono.cambio);

                        return (
                            <div
                                key={abono.id}
                                className="grid gap-2 rounded-md border p-3"
                                data-test="pedido-abono-row"
                            >
                                <div className="flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="text-lg font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                                            {currencyFormatter.format(
                                                Number(abono.monto),
                                            )}
                                        </div>
                                        <div className="flex items-center gap-1.5 text-sm">
                                            <Wallet className="text-muted-foreground size-3.5 shrink-0" />
                                            <span className="truncate">
                                                {abono.puc
                                                    ?.concatenar_subcuenta_concepto ??
                                                    '—'}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex shrink-0">
                                        {canUpdate ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                aria-label="Editar abono"
                                                data-test="edit-abono-button"
                                                onClick={() =>
                                                    setEditAbono(abono)
                                                }
                                            >
                                                <Pencil className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                        {canDelete ? (
                                            <Button
                                                type="button"
                                                variant="ghost"
                                                size="sm"
                                                aria-label="Eliminar abono"
                                                className="text-red-600"
                                                data-test="delete-abono-button"
                                                onClick={() =>
                                                    setDeleteAbono(abono)
                                                }
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </Button>
                                        ) : null}
                                    </div>
                                </div>

                                {cambio > 0 ? (
                                    <div className="text-muted-foreground text-xs tabular-nums">
                                        Pagó con{' '}
                                        {currencyFormatter.format(conCuanto)} ·
                                        cambio{' '}
                                        {currencyFormatter.format(cambio)}
                                    </div>
                                ) : null}

                                {abono.descripcion ? (
                                    <p className="text-sm break-words">
                                        {abono.descripcion}
                                    </p>
                                ) : null}

                                <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                    <CalendarDays className="size-3.5" />
                                    {abono.fecha
                                        ? new Date(abono.fecha).toLocaleString(
                                              'es-CO',
                                              {
                                                  dateStyle: 'short',
                                                  timeStyle: 'short',
                                              },
                                          )
                                        : '—'}
                                    {abono.vendedor?.name
                                        ? ` · ${abono.vendedor.name}`
                                        : ''}
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            <RegistrarPagoModal
                pedido={pedido}
                routes={routes}
                pucs={pucs}
                vendedores={vendedores}
                open={registrarOpen}
                onOpenChange={setRegistrarOpen}
            />

            <EditAbonoModal
                pedido={pedido}
                routes={routes}
                abono={editAbono}
                pucs={pucs}
                vendedores={vendedores}
                open={editAbono !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditAbono(null);
                    }
                }}
            />

            <DeleteAbonoModal
                pedido={pedido}
                routes={routes}
                abono={deleteAbono}
                open={deleteAbono !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setDeleteAbono(null);
                    }
                }}
            />
        </div>
    );
}
