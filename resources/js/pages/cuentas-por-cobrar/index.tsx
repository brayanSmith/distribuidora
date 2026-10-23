import { Head } from '@inertiajs/react';
import { ChevronDown, HandCoins, UserRound } from 'lucide-react';
import { useState } from 'react';
import ResumenCartera from '@/components/cartera/resumen-cartera';
import type { ResumenCarteraDatos } from '@/components/cartera/resumen-cartera';
import Heading from '@/components/heading';
import RegistrarPagoModal from '@/components/pedidos/registrar-pago-modal';
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
import { etiquetaTipoPago } from '@/lib/tipos-pago';
import { cn } from '@/lib/utils';
import { formatoFecha, plazo } from '@/lib/vencimiento';
import * as pedidosAbonosRoutes from '@/routes/pedidos/abonos';
import * as pedidosRoutes from '@/routes/pedidos';
import { cuentasPorCobrar } from '@/routes/pedidos';
import type { Pedido, PucOption, VendedorOption } from '@/types';

type PedidoPorCobrar = Pick<
    Pedido,
    | 'id'
    | 'cliente_id'
    | 'user_id'
    | 'fecha'
    | 'total_a_pagar'
    | 'abono'
    | 'saldo_pendiente'
    | 'estado_pago'
> & {
    tipo_pago: string | null;
    fecha_vencimiento: string | null;
    vencido: boolean;
    /** Negative: days overdue. */
    dias_para_vencer: number | null;
};

type ClientePorCobrar = {
    cliente: {
        id: number;
        razon_social: string;
        numero_documento: string | null;
        telefono: string | null;
        dias_credito: number;
    } | null;
    saldo: number;
    vencido: number;
    proximo_vencimiento: string | null;
    pedidos: PedidoPorCobrar[];
};

type Props = {
    clientes: ClientePorCobrar[];
    resumen: ResumenCarteraDatos & { pedidos: number };
    canCreateAbono: boolean;
    pucs: PucOption[];
    vendedores: VendedorOption[];
};

/**
 * What the clientes owe: totals, then each cliente with its pending pedidos
 * ordered by due date, ready to collect.
 */
export default function CuentasPorCobrar({
    clientes,
    resumen,
    canCreateAbono,
    pucs,
    vendedores,
}: Props) {
    const [aCobrar, setACobrar] = useState<PedidoPorCobrar | null>(null);

    return (
        <>
            <Head title="Cuentas por cobrar" />

            <div className="flex flex-col space-y-6">
                <Heading
                    variant="small"
                    title="Cuentas por cobrar"
                    description="Lo que deben los clientes por los pedidos a crédito o separados"
                />

                <ResumenCartera
                    resumen={resumen}
                    tituloTotal="Total por cobrar"
                    detalleTotal={`${resumen.pedidos} ${resumen.pedidos === 1 ? 'pedido' : 'pedidos'} con saldo`}
                />

                {clientes.length === 0 ? (
                    <p className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
                        Ningún cliente tiene saldo pendiente.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {clientes.map((grupo) => (
                            <Collapsible
                                key={grupo.cliente?.id ?? 'sin-cliente'}
                                defaultOpen={grupo.vencido > 0}
                                className="bg-card rounded-lg border"
                                data-test="cuentas-por-cobrar-cliente"
                            >
                                <CollapsibleTrigger className="group hover:bg-accent/50 flex w-full flex-wrap items-center gap-3 p-4 text-left">
                                    <UserRound className="text-muted-foreground size-5" />
                                    <div className="min-w-0 flex-1">
                                        <div className="font-semibold">
                                            {grupo.cliente?.razon_social ??
                                                'Sin cliente'}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {grupo.pedidos.length}{' '}
                                            {grupo.pedidos.length === 1
                                                ? 'pedido'
                                                : 'pedidos'}
                                            {grupo.cliente?.telefono
                                                ? ` · tel. ${grupo.cliente.telefono}`
                                                : ''}
                                            {grupo.cliente?.dias_credito
                                                ? ` · ${grupo.cliente.dias_credito} días de crédito`
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
                                            Debe
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
                                                        Pedido
                                                    </TableHead>
                                                    <TableHead>Fecha</TableHead>
                                                    <TableHead>Tipo</TableHead>
                                                    <TableHead>Vence</TableHead>
                                                    <TableHead className="text-right">
                                                        Total
                                                    </TableHead>
                                                    <TableHead className="text-right">
                                                        Abonado
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
                                                {grupo.pedidos.map((pedido) => (
                                                    <TableRow
                                                        key={pedido.id}
                                                        data-test="cuentas-por-cobrar-pedido"
                                                        className={cn(
                                                            pedido.vencido &&
                                                                'bg-red-50/60 dark:bg-red-950/20',
                                                        )}
                                                    >
                                                        <TableCell className="font-medium">
                                                            #{pedido.id}
                                                        </TableCell>
                                                        <TableCell>
                                                            {pedido.fecha
                                                                ? new Date(
                                                                      pedido.fecha,
                                                                  ).toLocaleDateString(
                                                                      'es-CO',
                                                                  )
                                                                : '—'}
                                                        </TableCell>
                                                        <TableCell>
                                                            {etiquetaTipoPago(
                                                                pedido.tipo_pago,
                                                            )}
                                                        </TableCell>
                                                        <TableCell>
                                                            <div>
                                                                {formatoFecha(
                                                                    pedido.fecha_vencimiento,
                                                                )}
                                                            </div>
                                                            <div
                                                                className={cn(
                                                                    'text-xs',
                                                                    pedido.vencido
                                                                        ? 'font-medium text-red-600 dark:text-red-400'
                                                                        : 'text-muted-foreground',
                                                                )}
                                                            >
                                                                {plazo(
                                                                    pedido.dias_para_vencer,
                                                                )}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            {currencyFormatter.format(
                                                                Number(
                                                                    pedido.total_a_pagar,
                                                                ),
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right text-emerald-600 dark:text-emerald-400">
                                                            {currencyFormatter.format(
                                                                Number(
                                                                    pedido.abono,
                                                                ),
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="text-right font-semibold text-red-600 dark:text-red-400">
                                                            {currencyFormatter.format(
                                                                Number(
                                                                    pedido.saldo_pendiente,
                                                                ),
                                                            )}
                                                        </TableCell>
                                                        {canCreateAbono ? (
                                                            <TableCell className="text-right">
                                                                <Button
                                                                    size="sm"
                                                                    variant="outline"
                                                                    onClick={() =>
                                                                        setACobrar(
                                                                            pedido,
                                                                        )
                                                                    }
                                                                    data-test="cuentas-por-cobrar-cobrar"
                                                                >
                                                                    <HandCoins />
                                                                    Cobrar
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

            {aCobrar ? (
                <RegistrarPagoModal
                    key={aCobrar.id}
                    pedido={aCobrar as unknown as Pedido}
                    routes={{
                        pedidos: pedidosRoutes,
                        abonos: pedidosAbonosRoutes,
                    }}
                    pucs={pucs}
                    vendedores={vendedores}
                    open
                    onOpenChange={(open) => {
                        if (!open) {
                            setACobrar(null);
                        }
                    }}
                />
            ) : null}
        </>
    );
}

CuentasPorCobrar.layout = () => ({
    breadcrumbs: [
        {
            title: 'Cuentas por cobrar',
            href: cuentasPorCobrar(),
        },
    ],
});
