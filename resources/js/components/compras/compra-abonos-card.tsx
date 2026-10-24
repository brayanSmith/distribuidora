import { router } from '@inertiajs/react';
import { CalendarDays, CheckCircle2, Trash2, Wallet } from 'lucide-react';
import { useState } from 'react';
import RegistrarPagoCompraModal from '@/components/compras/registrar-pago-compra-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { destroy } from '@/routes/compras/abonos';
import type { AbonoCompra, Compra, PucOption } from '@/types';

type Props = {
    compra: Compra & { abonos?: AbonoCompra[] };
    pucs: PucOption[];
    canCreate: boolean;
    canDelete: boolean;
};

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

/**
 * What has been paid to the proveedor of a compra: the totals and one card
 * per payment, to register another or remove one.
 */
export default function CompraAbonosCard({
    compra,
    pucs,
    canCreate,
    canDelete,
}: Props) {
    const [registrando, setRegistrando] = useState(false);
    const [eliminando, setEliminando] = useState<number | null>(null);
    const abonos = compra.abonos ?? [];
    const saldo = Math.max(Number(compra.saldo_pendiente), 0);
    const pagada = saldo <= 0;

    const eliminar = (abono: AbonoCompra) => {
        if (
            !window.confirm(
                `¿Eliminar el pago de ${moneda.format(Number(abono.monto))}?`,
            )
        ) {
            return;
        }

        router.delete(destroy([compra.id, abono.id]).url, {
            preserveScroll: true,
            onStart: () => setEliminando(abono.id),
            onFinish: () => setEliminando(null),
        });
    };

    return (
        <div className="bg-card space-y-4 rounded-lg border p-4">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Pagos al proveedor
                </div>
                {canCreate && !pagada ? (
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => setRegistrando(true)}
                        data-test="compra-registrar-pago"
                    >
                        Registrar pago
                    </Button>
                ) : null}
                {pagada ? (
                    <Badge className="border-transparent bg-emerald-100 text-emerald-700 hover:bg-emerald-100">
                        Compra pagada
                    </Badge>
                ) : null}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
                <div className="bg-muted/40 rounded-md border p-2">
                    <div className="text-muted-foreground text-xs">Total</div>
                    <div className="font-semibold tabular-nums">
                        {moneda.format(Number(compra.total_a_pagar))}
                    </div>
                </div>
                <div className="rounded-md border border-emerald-200 bg-emerald-50 p-2 dark:border-emerald-900 dark:bg-emerald-950/30">
                    <div className="text-muted-foreground text-xs">Pagado</div>
                    <div className="font-semibold text-emerald-700 tabular-nums dark:text-emerald-400">
                        {moneda.format(Number(compra.abono))}
                    </div>
                </div>
                <div
                    className={cn(
                        'rounded-md border p-2',
                        pagada
                            ? 'bg-muted/40'
                            : 'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
                    )}
                >
                    <div className="text-muted-foreground text-xs">Se debe</div>
                    <div
                        className={cn(
                            'font-semibold tabular-nums',
                            !pagada && 'text-red-700 dark:text-red-400',
                        )}
                    >
                        {moneda.format(saldo)}
                    </div>
                </div>
            </div>

            {abonos.length === 0 ? (
                <p className="text-muted-foreground py-4 text-center text-sm">
                    Todavía no se le ha pagado nada al proveedor.
                </p>
            ) : (
                <div className="grid max-h-[50svh] gap-2 overflow-y-auto pr-1">
                    {abonos.map((abono) => (
                        <div
                            key={abono.id}
                            className="grid gap-2 rounded-md border p-3"
                            data-test="compra-abono"
                        >
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                    <div className="text-lg font-semibold text-emerald-600 tabular-nums dark:text-emerald-400">
                                        {moneda.format(Number(abono.monto))}
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
                                {canDelete ? (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="text-red-600"
                                        aria-label="Eliminar pago"
                                        loading={eliminando === abono.id}
                                        onClick={() => eliminar(abono)}
                                    >
                                        {eliminando === abono.id ? null : (
                                            <Trash2 className="h-4 w-4" />
                                        )}
                                    </Button>
                                ) : null}
                            </div>
                            {abono.descripcion ? (
                                <p className="text-sm break-words">
                                    {abono.descripcion}
                                </p>
                            ) : null}
                            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                <CalendarDays className="size-3.5" />
                                {new Date(abono.fecha).toLocaleString('es-CO', {
                                    dateStyle: 'short',
                                    timeStyle: 'short',
                                })}
                                {abono.user?.name
                                    ? ` · ${abono.user.name}`
                                    : ''}
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {registrando ? (
                <RegistrarPagoCompraModal
                    compra={compra}
                    pucs={pucs}
                    onClose={() => setRegistrando(false)}
                />
            ) : null}
        </div>
    );
}
