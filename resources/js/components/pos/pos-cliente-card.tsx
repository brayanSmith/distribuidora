import { AlertTriangle, Wallet } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ClienteOption } from '@/types';

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

type Props = {
    cliente: ClienteOption;
};

/** The first letters of a name, for the avatar. */
export function iniciales(nombre: string): string {
    return nombre
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((palabra) => palabra[0]?.toUpperCase())
        .join('');
}

/**
 * The selected cliente, compact: who it is and how to reach them, plus a
 * warning when it still owes money.
 */
export default function PosClienteCard({ cliente }: Props) {
    const contacto = [
        cliente.numero_documento,
        cliente.telefono,
        cliente.ciudad,
    ].filter(Boolean);

    return (
        <div
            className="bg-muted/40 grid gap-2 rounded-md border p-3 text-sm"
            data-test="pos-cliente-card"
        >
            <div className="flex items-center gap-3">
                <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                    {iniciales(cliente.razon_social)}
                </span>
                <div className="min-w-0">
                    <p className="truncate font-semibold">
                        {cliente.razon_social}
                    </p>
                    <p className="text-muted-foreground truncate text-xs">
                        {contacto.length > 0
                            ? contacto.join(' · ')
                            : 'Sin datos de contacto'}
                    </p>
                    {cliente.direccion ? (
                        <p
                            className="text-muted-foreground truncate text-xs"
                            title={cliente.direccion}
                        >
                            {cliente.direccion}
                        </p>
                    ) : null}
                </div>
            </div>

            {cliente.deuda ? (
                <div
                    data-test="pos-cliente-deuda"
                    className={cn(
                        'flex items-start gap-2 rounded-md border p-2 text-xs font-medium',
                        cliente.deuda_vencida
                            ? 'border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/40 dark:text-red-400'
                            : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-400',
                    )}
                >
                    {cliente.deuda_vencida ? (
                        <AlertTriangle className="mt-0.5 size-4 shrink-0" />
                    ) : (
                        <Wallet className="mt-0.5 size-4 shrink-0" />
                    )}
                    <span>
                        Debe {moneda.format(cliente.deuda)}
                        {cliente.deuda_vencida
                            ? ` · ${moneda.format(cliente.deuda_vencida)} vencido. Revisa antes de venderle a crédito.`
                            : ' en pedidos pendientes.'}
                    </span>
                </div>
            ) : null}
        </div>
    );
}
