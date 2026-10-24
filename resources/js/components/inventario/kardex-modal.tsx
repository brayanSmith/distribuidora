import { Link, useHttp } from '@inertiajs/react';
import { History } from 'lucide-react';
import { useEffect, useState } from 'react';
import Pagination from '@/components/pagination';
import { Cargando } from '@/components/record-view';
import { Badge } from '@/components/ui/badge';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import { index as kardexIndex } from '@/routes/kardex';
import type { BodegaOption, LaravelPaginator } from '@/types';

type Movimiento = {
    id: number;
    fecha: string;
    bodega: string | null;
    concepto: string;
    reverso: boolean;
    cantidad: number;
    saldo: number;
    costo_unitario: number | null;
    documento: { nombre: string; url: string | null } | null;
    usuario: string | null;
    nota: string | null;
};

type Props = {
    productoId: number;
    /** The producto's name, for the title. */
    nombre: string;
    bodegas: BodegaOption[];
    onClose: () => void;
};

const CONCEPTOS: Record<string, { label: string; reverso: string }> = {
    SALDO_INICIAL: { label: 'Saldo inicial', reverso: 'Saldo inicial' },
    STOCK_INICIAL: {
        label: 'Stock inicial',
        reverso: 'Stock inicial (anulado)',
    },
    COMPRA: { label: 'Compra recibida', reverso: 'Compra (reversada)' },
    VENTA: { label: 'Venta', reverso: 'Venta (anulada o editada)' },
    TRASLADO_ENTRADA: {
        label: 'Traslado (entrada)',
        reverso: 'Traslado (entrada reversada)',
    },
    TRASLADO_SALIDA: {
        label: 'Traslado (salida)',
        reverso: 'Traslado (salida reversada)',
    },
    AJUSTE_ENTRADA: { label: 'Ajuste (entrada)', reverso: 'Ajuste (entrada)' },
    AJUSTE_SALIDA: { label: 'Ajuste (salida)', reverso: 'Ajuste (salida)' },
};

const TODAS = 'todas';

const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/**
 * The kardex of a producto: every unit that came in or went out of each
 * bodega, the document that moved it, who did it and what was left.
 */
export default function KardexModal({
    productoId,
    nombre,
    bodegas,
    onClose,
}: Props) {
    const { submit } = useHttp();
    const [bodegaId, setBodegaId] = useState(TODAS);
    const [desde, setDesde] = useState('');
    const [hasta, setHasta] = useState('');
    const [page, setPage] = useState(1);
    const [datos, setDatos] = useState<LaravelPaginator<Movimiento> | null>(
        null,
    );
    const [cargando, setCargando] = useState(false);

    useEffect(() => {
        let cancelado = false;
        setCargando(true);

        submit(
            kardexIndex({
                query: {
                    producto_id: productoId,
                    bodega_id: bodegaId === TODAS ? undefined : bodegaId,
                    desde: desde || undefined,
                    hasta: hasta || undefined,
                    page,
                },
            }),
        )
            .then((respuesta) => {
                if (!cancelado) {
                    setDatos(respuesta as LaravelPaginator<Movimiento>);
                }
            })
            .catch(() => {
                if (!cancelado) {
                    setDatos(null);
                }
            })
            .finally(() => {
                if (!cancelado) {
                    setCargando(false);
                }
            });

        return () => {
            cancelado = true;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [productoId, bodegaId, desde, hasta, page]);

    const filtro = (asignar: (valor: string) => void) => (valor: string) => {
        asignar(valor);
        setPage(1);
    };

    const movimientos = datos?.data ?? [];

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-5xl" data-test="kardex-modal">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <History className="size-5" />
                        Movimientos de {nombre}
                    </DialogTitle>
                    <DialogDescription>
                        De dónde entró y a dónde salió cada unidad, y cuánto
                        quedó en la bodega.
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 sm:grid-cols-3">
                    <div className="grid gap-1.5">
                        <Label>Bodega</Label>
                        <Select
                            value={bodegaId}
                            onValueChange={filtro(setBodegaId)}
                        >
                            <SelectTrigger data-test="kardex-bodega">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={TODAS}>
                                    Todas las bodegas
                                </SelectItem>
                                {bodegas.map((bodega) => (
                                    <SelectItem
                                        key={bodega.id}
                                        value={String(bodega.id)}
                                    >
                                        {bodega.nombre_bodega}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="kardex-desde">Desde</Label>
                        <Input
                            id="kardex-desde"
                            type="date"
                            value={desde}
                            onChange={(event) =>
                                filtro(setDesde)(event.target.value)
                            }
                        />
                    </div>
                    <div className="grid gap-1.5">
                        <Label htmlFor="kardex-hasta">Hasta</Label>
                        <Input
                            id="kardex-hasta"
                            type="date"
                            value={hasta}
                            onChange={(event) =>
                                filtro(setHasta)(event.target.value)
                            }
                        />
                    </div>
                </div>

                <div className="max-h-[60svh] overflow-auto rounded-md border">
                    <Table>
                        <TableHeader className="bg-background sticky top-0">
                            <TableRow>
                                <TableHead>Fecha</TableHead>
                                <TableHead>Bodega</TableHead>
                                <TableHead>Movimiento</TableHead>
                                <TableHead>Documento</TableHead>
                                <TableHead className="text-right">
                                    Entrada
                                </TableHead>
                                <TableHead className="text-right">
                                    Salida
                                </TableHead>
                                <TableHead className="text-right">
                                    Saldo
                                </TableHead>
                                <TableHead>Usuario</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {movimientos.map((movimiento) => {
                                const concepto = CONCEPTOS[movimiento.concepto];

                                return (
                                    <TableRow
                                        key={movimiento.id}
                                        data-test="kardex-movimiento"
                                        className={cn(
                                            movimiento.reverso &&
                                                'text-muted-foreground',
                                        )}
                                    >
                                        <TableCell className="whitespace-nowrap">
                                            {new Date(
                                                movimiento.fecha,
                                            ).toLocaleString('es-CO', {
                                                dateStyle: 'short',
                                                timeStyle: 'short',
                                            })}
                                        </TableCell>
                                        <TableCell>
                                            {movimiento.bodega}
                                        </TableCell>
                                        <TableCell>
                                            <div className="flex items-center gap-1.5">
                                                {movimiento.reverso
                                                    ? (concepto?.reverso ??
                                                      movimiento.concepto)
                                                    : (concepto?.label ??
                                                      movimiento.concepto)}
                                                {movimiento.concepto ===
                                                'SALDO_INICIAL' ? (
                                                    <Badge variant="secondary">
                                                        Inicio
                                                    </Badge>
                                                ) : null}
                                            </div>
                                            {movimiento.nota ? (
                                                <div className="text-muted-foreground text-xs">
                                                    {movimiento.nota}
                                                </div>
                                            ) : null}
                                        </TableCell>
                                        <TableCell>
                                            {movimiento.documento?.url ? (
                                                <Link
                                                    href={
                                                        movimiento.documento.url
                                                    }
                                                    className="text-primary hover:underline"
                                                >
                                                    {
                                                        movimiento.documento
                                                            .nombre
                                                    }
                                                </Link>
                                            ) : (
                                                (movimiento.documento?.nombre ??
                                                '—')
                                            )}
                                        </TableCell>
                                        <TableCell className="text-right text-emerald-600 tabular-nums dark:text-emerald-400">
                                            {movimiento.cantidad > 0
                                                ? `+${numero.format(movimiento.cantidad)}`
                                                : ''}
                                        </TableCell>
                                        <TableCell className="text-right text-red-600 tabular-nums dark:text-red-400">
                                            {movimiento.cantidad < 0
                                                ? numero.format(
                                                      movimiento.cantidad,
                                                  )
                                                : ''}
                                        </TableCell>
                                        <TableCell className="text-right font-semibold tabular-nums">
                                            {numero.format(movimiento.saldo)}
                                        </TableCell>
                                        <TableCell className="text-muted-foreground text-xs">
                                            {movimiento.usuario ?? 'Sistema'}
                                        </TableCell>
                                    </TableRow>
                                );
                            })}

                            {cargando && movimientos.length === 0 ? (
                                <TableRow>
                                    <TableCell colSpan={8}>
                                        <Cargando />
                                    </TableCell>
                                </TableRow>
                            ) : null}

                            {!cargando && movimientos.length === 0 ? (
                                <TableRow>
                                    <TableCell
                                        colSpan={8}
                                        className="text-muted-foreground py-8 text-center"
                                    >
                                        No hay movimientos con estos filtros.
                                    </TableCell>
                                </TableRow>
                            ) : null}
                        </TableBody>
                    </Table>
                </div>

                {datos && datos.last_page > 1 ? (
                    <Pagination
                        page={datos.current_page}
                        totalPages={datos.last_page}
                        onPageChange={setPage}
                        dataTest="kardex-page"
                    />
                ) : null}

                <p className="text-muted-foreground text-xs">
                    El saldo es lo que quedó en esa bodega después del
                    movimiento. Los movimientos reversados (en gris) deshacen
                    uno anterior, por ejemplo al anular o editar un pedido.
                </p>
            </DialogContent>
        </Dialog>
    );
}
