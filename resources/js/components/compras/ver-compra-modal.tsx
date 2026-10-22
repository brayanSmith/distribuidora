import { router } from '@inertiajs/react';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { useFetchedRecord } from '@/hooks/use-fetched-record';
import {
    currencyFormatter,
    Field,
    formatDate,
    LoadingOrError,
    Section,
    TotalRow,
} from '@/components/record-view';
import { cn } from '@/lib/utils';
import { show } from '@/routes/compras';
import { destroy as destroyAbono } from '@/routes/compras/abonos';
import type { AbonoCompra, Compra } from '@/types';

type Props = {
    /** The compra to show, or `null` while the modal is closed. */
    compra: Compra | null;
    /** Whether the payments can be deleted from here. */
    canDeleteAbono?: boolean;
    onClose: () => void;
};

type Detalle = {
    id: number;
    cantidad: string;
    precio_unitario: string;
    subtotal: string;
    estado_entrega: string;
    cantidad_recibida?: string;
    producto?: {
        concatenar_codigo_nombre: string | null;
        referencia_producto: string | null;
    } | null;
    bodega?: { nombre_bodega: string } | null;
};

type CompraDetalleCompleto = Omit<Compra, 'detalles_compra' | 'proveedor'> & {
    proveedor?: {
        nombre_proveedor: string;
        nit_proveedor: string | null;
        telefono_proveedor: string | null;
    } | null;
    detalles_compra?: Detalle[];
    abonos?: AbonoCompra[];
};

/** Read-only view of a compra: header, products and totals. */
export default function VerCompraModal({
    compra,
    canDeleteAbono = false,
    onClose,
}: Props) {
    const { record, loading, failed } = useFetchedRecord<CompraDetalleCompleto>(
        compra ? show([compra.id]) : null,
    );

    const detalles = record?.detalles_compra ?? [];
    const abonos = record?.abonos ?? [];

    // The listing reloads with the new balance; the modal closes.
    const eliminarAbono = (abono: AbonoCompra) => {
        if (!compra || !window.confirm('¿Eliminar este pago?')) {
            return;
        }

        router.visit(destroyAbono([compra.id, abono.id]), {
            preserveScroll: true,
            onSuccess: onClose,
        });
    };

    return (
        <Dialog
            open={compra !== null}
            onOpenChange={(open) => !open && onClose()}
        >
            <DialogContent
                className="max-h-[90vh] overflow-y-auto sm:max-w-4xl"
                data-test="ver-compra-modal"
            >
                <DialogHeader>
                    <DialogTitle>Compra {compra?.factura}</DialogTitle>
                    <DialogDescription>
                        Detalle de la compra (solo lectura).
                    </DialogDescription>
                </DialogHeader>

                <LoadingOrError loading={loading} failed={failed} />

                {record ? (
                    <div className="space-y-6">
                        <div className="bg-card grid gap-4 rounded-lg border p-4 sm:grid-cols-3">
                            <Field label="Factura">{record.factura}</Field>
                            <Field label="Fecha">
                                {formatDate(record.fecha)}
                            </Field>
                            <Field label="Estado">
                                <Badge
                                    className={cn(
                                        'border-transparent',
                                        record.estado === 'RECIBIDA'
                                            ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100'
                                            : 'bg-amber-100 text-amber-700 hover:bg-amber-100',
                                    )}
                                >
                                    {record.estado}
                                </Badge>
                            </Field>
                            <Field label="Tipo de pago">
                                {record.tipo_pago === 'CONTADO'
                                    ? 'Contado'
                                    : 'Crédito'}
                            </Field>
                            <Field label="Vence el">
                                {record.fecha_vencimiento
                                    ? new Date(
                                          `${record.fecha_vencimiento}T00:00:00`,
                                      ).toLocaleDateString('es-CO')
                                    : '—'}
                            </Field>
                            <Field label="Proveedor">
                                {record.proveedor?.nombre_proveedor}
                            </Field>
                            <Field label="NIT">
                                {record.proveedor?.nit_proveedor}
                            </Field>
                            <Field label="Teléfono">
                                {record.proveedor?.telefono_proveedor}
                            </Field>
                            <Field
                                label="Observaciones"
                                className="sm:col-span-3"
                            >
                                {record.observaciones}
                            </Field>
                        </div>

                        <Section title="Productos">
                            <div className="overflow-x-auto rounded-md border">
                                <Table>
                                    <TableHeader>
                                        <TableRow>
                                            <TableHead>Producto</TableHead>
                                            <TableHead>Bodega</TableHead>
                                            <TableHead>Entrega</TableHead>
                                            <TableHead className="text-right">
                                                Cantidad
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Precio unitario
                                            </TableHead>
                                            <TableHead className="text-right">
                                                Subtotal
                                            </TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {detalles.map((detalle) => (
                                            <TableRow key={detalle.id}>
                                                <TableCell>
                                                    {detalle.producto
                                                        ?.concatenar_codigo_nombre ??
                                                        detalle.producto
                                                            ?.referencia_producto ??
                                                        '—'}
                                                </TableCell>
                                                <TableCell>
                                                    {detalle.bodega
                                                        ?.nombre_bodega ?? '—'}
                                                </TableCell>
                                                <TableCell>
                                                    <Badge variant="secondary">
                                                        {detalle.estado_entrega ===
                                                            'PENDIENTE' &&
                                                        Number(
                                                            detalle.cantidad_recibida ??
                                                                0,
                                                        ) > 0
                                                            ? `${Number(detalle.cantidad_recibida)} de ${Number(detalle.cantidad)}`
                                                            : detalle.estado_entrega}
                                                    </Badge>
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {Number(detalle.cantidad)}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {currencyFormatter.format(
                                                        Number(
                                                            detalle.precio_unitario,
                                                        ),
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    {currencyFormatter.format(
                                                        Number(
                                                            detalle.subtotal,
                                                        ),
                                                    )}
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </Section>

                        <div className="ml-auto w-full max-w-xs space-y-1 border-t pt-3">
                            <TotalRow
                                label="Subtotal"
                                value={Number(record.subtotal)}
                            />
                            <TotalRow
                                label="Descuento"
                                value={Number(record.descuento)}
                            />
                            <TotalRow
                                label="Total a pagar"
                                value={Number(record.total_a_pagar)}
                                strong
                            />
                            <TotalRow
                                label="Pagado"
                                value={Number(record.abono)}
                            />
                            <TotalRow
                                label="Saldo"
                                value={Number(record.saldo_pendiente)}
                                strong
                            />
                        </div>

                        <Section title="Pagos al proveedor">
                            {abonos.length === 0 ? (
                                <p className="text-muted-foreground text-sm">
                                    Aún no se ha pagado nada de esta compra.
                                </p>
                            ) : (
                                <div className="overflow-x-auto rounded-md border">
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>Fecha</TableHead>
                                                <TableHead>
                                                    Medio de pago
                                                </TableHead>
                                                <TableHead>
                                                    Descripción
                                                </TableHead>
                                                <TableHead>Registró</TableHead>
                                                <TableHead className="text-right">
                                                    Monto
                                                </TableHead>
                                                {canDeleteAbono ? (
                                                    <TableHead />
                                                ) : null}
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {abonos.map((abono) => (
                                                <TableRow
                                                    key={abono.id}
                                                    data-test="compra-abono"
                                                >
                                                    <TableCell>
                                                        {formatDate(
                                                            abono.fecha,
                                                        )}
                                                    </TableCell>
                                                    <TableCell>
                                                        {abono.puc
                                                            ?.concatenar_subcuenta_concepto ??
                                                            '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {abono.descripcion ??
                                                            '—'}
                                                    </TableCell>
                                                    <TableCell>
                                                        {abono.user?.name ??
                                                            '—'}
                                                    </TableCell>
                                                    <TableCell className="text-right font-medium text-emerald-600 dark:text-emerald-400">
                                                        {currencyFormatter.format(
                                                            Number(abono.monto),
                                                        )}
                                                    </TableCell>
                                                    {canDeleteAbono ? (
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="sm"
                                                                aria-label="Eliminar pago"
                                                                onClick={() =>
                                                                    eliminarAbono(
                                                                        abono,
                                                                    )
                                                                }
                                                                data-test="compra-abono-eliminar"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </TableCell>
                                                    ) : null}
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                </div>
                            )}
                        </Section>
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
