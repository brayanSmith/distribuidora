import { Head } from '@inertiajs/react';
import { ChevronDown, Truck, Wallet } from 'lucide-react';
import { useState } from 'react';
import ResumenCartera from '@/components/cartera/resumen-cartera';
import RegistrarPagoCompraModal from '@/components/compras/registrar-pago-compra-modal';
import Heading from '@/components/heading';
import { currencyFormatter } from '@/components/record-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Collapsible,
    CollapsibleContent,
    CollapsibleTrigger,
} from '@/components/ui/collapsible';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { formatoFecha, plazo } from '@/lib/vencimiento';
import { cuentasPorPagar } from '@/routes/compras';
import type { Compra, PucOption } from '@/types';

type CompraPorPagar = Pick<
    Compra,
    | 'id'
    | 'factura'
    | 'fecha'
    | 'total_a_pagar'
    | 'abono'
    | 'saldo_pendiente'
    | 'estado_pago'
    | 'fecha_vencimiento'
    | 'vencida'
    | 'proveedor'
> & {
    /** Negative: days overdue. */
    dias_para_vencer: number | null;
};

type ProveedorPorPagar = {
    proveedor: {
        id: number;
        nombre_proveedor: string;
        nit_proveedor: string | null;
        telefono_proveedor: string | null;
        dias_credito: number;
    } | null;
    saldo: number;
    vencido: number;
    proximo_vencimiento: string | null;
    compras: CompraPorPagar[];
};

type Props = {
    proveedores: ProveedorPorPagar[];
    resumen: {
        total: number;
        vencido: number;
        proximo: number;
        diasProximos: number;
        facturas: number;
    };
    pucs: PucOption[];
    canCreateAbono: boolean;
};

/**
 * What is owed to the proveedores: totals, then each proveedor with its
 * pending compras ordered by due date, ready to be paid.
 */
export default function CuentasPorPagar({
    proveedores,
    resumen,
    pucs,
    canCreateAbono,
}: Props) {
    const [aPagar, setAPagar] = useState<CompraPorPagar | null>(null);

    return (
        <>
            <Head title="Cuentas por pagar" />

            <div className="flex flex-col space-y-6">
                <Heading
                    variant="small"
                    title="Cuentas por pagar"
                    description="Lo que se les debe a los proveedores por las compras a crédito"
                />

                <ResumenCartera
                    resumen={resumen}
                    tituloTotal="Total por pagar"
                    detalleTotal={`${resumen.facturas} ${resumen.facturas === 1 ? 'factura' : 'facturas'} con saldo`}
                />

                {proveedores.length === 0 ? (
                    <p className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
                        No se le debe nada a ningún proveedor.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {proveedores.map((grupo) => (
                            <Collapsible
                                key={grupo.proveedor?.id ?? 'sin-proveedor'}
                                defaultOpen={grupo.vencido > 0}
                                className="bg-card rounded-lg border"
                                data-test="cuentas-por-pagar-proveedor"
                            >
                                <CollapsibleTrigger className="group hover:bg-accent/50 flex w-full flex-wrap items-center gap-3 p-4 text-left">
                                    <Truck className="text-muted-foreground size-5" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold">
                                            {grupo.proveedor
                                                ?.nombre_proveedor ??
                                                'Sin proveedor'}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {grupo.compras.length}{' '}
                                            {grupo.compras.length === 1
                                                ? 'factura'
                                                : 'facturas'}
                                            {grupo.proveedor?.dias_credito
                                                ? ` · ${grupo.proveedor.dias_credito} días de crédito`
                                                : ''}
                                            {grupo.proximo_vencimiento
                                                ? ` · próximo vencimiento ${formatoFecha(grupo.proximo_vencimiento)}`
                                                : ''}
                                        </div>
                                    </div>
                                    {grupo.vencido > 0 ? (
                                        <Badge className="border-transparent bg-red-600 text-white hover:bg-red-600">
                                            Vencido{' '}
                                            {currencyFormatter.format(
                                                grupo.vencido,
                                            )}
                                        </Badge>
                                    ) : null}
                                    <div className="text-right">
                                        <div className="text-muted-foreground text-xs">
                                            Se le debe
                                        </div>
                                        <div className="font-semibold">
                                            {currencyFormatter.format(
                                                grupo.saldo,
                                            )}
                                        </div>
                                    </div>
                                    <ChevronDown className="text-muted-foreground size-4 transition-transform group-data-[state=open]:rotate-180" />
                                </CollapsibleTrigger>

                                <CollapsibleContent>
                                    <div className="overflow-x-auto border-t">
                                        <Table>
                                            <TableHeader>
                                                <TableRow>
                                                    <TableHead>
                                                        Factura
                                                    </TableHead>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Vence</TableHead>
                                                    <TableHead className="text-right">
                                                        Total
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Pagado
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Saldo
                                                    </TableHead>
                                                    {canCreateAbono ? (
                                                        <TableHead />
                                                    ) : null}
                                                </TableRow>
                                            </TableHeader>
                                            <TableBody>
                                                {grupo.compras.map((compra) => (
                                                    <TableRow
                                                        key={compra.id}
                                                        data-test="cuentas-por-pagar-compra"
                                                        className={cn(
                                                            compra.vencida &&
                                                                'bg-red-50/60 dark:bg-red-950/20',
                                                        )}
                                                    >
                                                        <TableCell className="font-medium">
                                                            {compra.factura}
                                                        </TableCell>
                                                        <TableCell>
                                                            {compra.fecha
                                                                ? new Date(
                                                                      compra.fecha,
                                                                  ).toLocaleDateString(
                                                                      'es-CO',
                                                                  )
                                                                : '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div>
                                                                {formatoFecha(
                                                                    compra.fecha_vencimiento,
                                                                )}
                                                            </div>
                                                            <div
                                                                className={cn(
                                                                    'text-xs',
                                                                    compra.vencida
                                                                        ? 'font-medium text-red-600 dark:text-red-400'
                                                                        : 'text-muted-foreground',
                                                                )}
                                                            >
                                                                {plazo(
                                                                    compra.dias_para_vencer,
                                                                    'a',
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {currencyFormatter.format(
                                                                Number(
                                                                    compra.total_a_pagar,
                                                                ),
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                                                            {currencyFormatter.format(
                                                                Number(
                                                                    compra.abono,
                                                                ),
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                                                            {currencyFormatter.format(
                                                                Number(
                                                                    compra.saldo_pendiente,
                                                                ),
                                                            )}
                                                        </TableCell>
                                                        {canCreateAbono ? (
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        setAPagar(
                                                                            compra,
                                                                        )
                                                                    }
                                                                    data-test="cuentas-por-pagar-pagar"
                                                                >
                                                                    <Wallet />
                                                                    Pagar
                                                                </Button>
                                                            </TableCell>
                                                        ) : null}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
                                    </div>
                                </CollapsibleContent>
                            </Collapsible>
                        ))}
                    </div>
                )}
            </div>

            <RegistrarPagoCompraModal
                compra={aPagar as Compra | null}
                pucs={pucs}
                onClose={() => setAPagar(null)}
            />
        </>
    );
}

CuentasPorPagar.layout = () => ({
    breadcrumbs: [
        {
            title: 'Cuentas por pagar',
            href: cuentasPorPagar(),
        },
    ],
});
