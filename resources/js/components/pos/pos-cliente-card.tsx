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

function Dato({ label, value }: { label: string; value: string | null }) {
    return (
        <div className="min-w-0">
            <span className="text-muted-foreground">{label}: </span>
            <span className="break-words">{value || '—'}</span>
        </div>
    );
}

/** The selected cliente's data, shown under the "Seleccionar cliente" button. */
export default function PosClienteCard({ cliente }: Props) {
    return (
        <div
            className="bg-muted/40 grid gap-1 rounded-md border p-3 text-sm"
            data-test="pos-cliente-card"
        >
            <p className="font-semibold">{cliente.razon_social}</p>
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
            <Dato label="Documento" value={cliente.numero_documento} />
            <Dato label="Teléfono" value={cliente.telefono} />
            <Dato label="Ciudad" value={cliente.ciudad} />
            <Dato label="Dirección" value={cliente.direccion} />
            <Dato label="Email" value={cliente.email} />
        </div>
    );
}
