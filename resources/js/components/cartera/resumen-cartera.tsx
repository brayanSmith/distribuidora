import { AlertTriangle, CalendarClock, Wallet } from 'lucide-react';
import { currencyFormatter } from '@/components/record-view';
import { cn } from '@/lib/utils';

export type ResumenCarteraDatos = {
    total: number;
    vencido: number;
    proximo: number;
    diasProximos: number;
};

function Tarjeta({
    titulo,
    valor,
    detalle,
    icono: Icono,
    className,
}: {
    titulo: string;
    valor: number;
    detalle: string;
    icono: typeof Wallet;
    className?: string;
}) {
    return (
        <div
            className={cn('bg-card space-y-1 rounded-lg border p-4', className)}
        >
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Icono className="size-4" />
                {titulo}
            </div>
            <div className="text-2xl font-semibold">
                {currencyFormatter.format(valor)}
            </div>
            <div className="text-muted-foreground text-xs">{detalle}</div>
        </div>
    );
}

/**
 * The three totals of a cartera (what is owed to proveedores, or what the
 * clientes owe): the total, the overdue part and what is due soon.
 */
export default function ResumenCartera({
    resumen,
    tituloTotal,
    detalleTotal,
}: {
    resumen: ResumenCarteraDatos;
    tituloTotal: string;
    detalleTotal: string;
}) {
    return (
        <div className="grid gap-3 sm:grid-cols-3">
            <Tarjeta
                titulo={tituloTotal}
                valor={resumen.total}
                detalle={detalleTotal}
                icono={Wallet}
            />
            <Tarjeta
                titulo="Vencido"
                valor={resumen.vencido}
                detalle="Ya pasó su fecha de pago"
                icono={AlertTriangle}
                className={
                    resumen.vencido > 0
                        ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400'
                        : undefined
                }
            />
            <Tarjeta
                titulo={`Vence en ${resumen.diasProximos} días`}
                valor={resumen.proximo}
                detalle="Para tener en cuenta esta semana"
                icono={CalendarClock}
                className={
                    resumen.proximo > 0
                        ? 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400'
                        : undefined
                }
            />
        </div>
    );
}
