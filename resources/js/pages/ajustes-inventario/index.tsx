import { Head } from '@inertiajs/react';
import { ClipboardPen } from 'lucide-react';
import Heading from '@/components/heading';
import CrearAjusteModal from '@/components/inventario/crear-ajuste-modal';
import type {
    StockActual,
    TipoAjuste,
} from '@/components/inventario/crear-ajuste-modal';
import { Button } from '@/components/ui/button';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { index } from '@/routes/ajustes-inventario';
import type { BodegaOption, ProductoOption } from '@/types';

type Ajuste = {
    id: number;
    tipo: TipoAjuste;
    cantidad: string;
    stock_anterior: string;
    diferencia: string;
    motivo: string;
    nota: string | null;
    created_at: string;
    producto: {
        id: number;
        concatenar_codigo_nombre: string | null;
        referencia_producto: string | null;
    } | null;
    bodega: BodegaOption | null;
    user: { id: number; name: string } | null;
};

type Props = {
    ajustes: Ajuste[];
    productos: ProductoOption[];
    bodegas: BodegaOption[];
    stocks: StockActual[];
    motivos: string[];
    canCreate: boolean;
};

const TIPOS: Record<TipoAjuste, string> = {
    CONTEO: 'Conteo físico',
    ENTRADA: 'Entrada',
    SALIDA: 'Salida',
};

const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/**
 * The manual corrections of the stock: who changed what, how much and why.
 * They are never edited nor deleted; a mistake is fixed with another one.
 */
export default function AjustesInventario({
    ajustes,
    productos,
    bodegas,
    stocks,
    motivos,
    canCreate,
}: Props) {
    return (
        <>
            <Head title="Ajustes de inventario" />

            <div className="flex flex-col space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Heading
                        variant="small"
                        title="Ajustes de inventario"
                        description="Correcciones del stock por conteo físico, mercancía dañada, pérdidas u otros motivos. Cada una queda en los movimientos del producto."
                    />
                    {canCreate ? (
                        <CrearAjusteModal
                            productos={productos}
                            bodegas={bodegas}
                            stocks={stocks}
                            motivos={motivos}
                        >
                            <Button data-test="ajuste-nuevo">
                                <ClipboardPen />
                                Nuevo ajuste
                            </Button>
                        </CrearAjusteModal>
                    ) : null}
                </div>

                {ajustes.length === 0 ? (
                    <p className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
                        Todavía no hay ajustes de inventario.
                    </p>
                ) : (
                    <div className="overflow-x-auto rounded-lg border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Fecha</TableHead>
                                    <TableHead>Producto</TableHead>
                                    <TableHead>Bodega</TableHead>
                                    <TableHead>Tipo</TableHead>
                                    <TableHead className="text-right">
                                        Antes
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Ajuste
                                    </TableHead>
                                    <TableHead className="text-right">
                                        Después
                                    </TableHead>
                                    <TableHead>Motivo</TableHead>
                                    <TableHead>Usuario</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {ajustes.map((ajuste) => {
                                    const diferencia = Number(
                                        ajuste.diferencia,
                                    );
                                    const antes = Number(ajuste.stock_anterior);

                                    return (
                                        <TableRow
                                            key={ajuste.id}
                                            data-test="ajuste-fila"
                                        >
                                            <TableCell className="whitespace-nowrap">
                                                {new Date(
                                                    ajuste.created_at,
                                                ).toLocaleString('es-CO', {
                                                    dateStyle: 'short',
                                                    timeStyle: 'short',
                                                })}
                                            </TableCell>
                                            <TableCell>
                                                {ajuste.producto
                                                    ?.concatenar_codigo_nombre ??
                                                    ajuste.producto
                                                        ?.referencia_producto ??
                                                    '—'}
                                            </TableCell>
                                            <TableCell>
                                                {ajuste.bodega?.nombre_bodega}
                                            </TableCell>
                                            <TableCell>
                                                {TIPOS[ajuste.tipo]}
                                                {ajuste.tipo === 'CONTEO' ? (
                                                    <div className="text-muted-foreground text-xs">
                                                        Contadas:{' '}
                                                        {numero.format(
                                                            Number(
                                                                ajuste.cantidad,
                                                            ),
                                                        )}
                                                    </div>
                                                ) : null}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {numero.format(antes)}
                                            </TableCell>
                                            <TableCell
                                                className={cn(
                                                    'text-right font-semibold tabular-nums',
                                                    diferencia > 0
                                                        ? 'text-emerald-600 dark:text-emerald-400'
                                                        : 'text-red-600 dark:text-red-400',
                                                )}
                                            >
                                                {diferencia > 0 ? '+' : ''}
                                                {numero.format(diferencia)}
                                            </TableCell>
                                            <TableCell className="text-right tabular-nums">
                                                {numero.format(
                                                    antes + diferencia,
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {ajuste.motivo}
                                                {ajuste.nota ? (
                                                    <div className="text-muted-foreground text-xs">
                                                        {ajuste.nota}
                                                    </div>
                                                ) : null}
                                            </TableCell>
                                            <TableCell className="text-muted-foreground text-xs">
                                                {ajuste.user?.name ?? '—'}
                                            </TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                )}

                <p className="text-muted-foreground text-xs">
                    Los ajustes no se editan ni se borran, para no perder la
                    trazabilidad. Si hubo un error, haz otro ajuste que lo
                    corrija.
                </p>
            </div>
        </>
    );
}

AjustesInventario.layout = () => ({
    breadcrumbs: [
        {
            title: 'Ajustes de inventario',
            href: index(),
        },
    ],
});
