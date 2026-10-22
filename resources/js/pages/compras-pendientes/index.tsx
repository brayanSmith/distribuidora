import { Head, router } from '@inertiajs/react';
import { Clock, PackageCheck, PackageOpen, Truck } from 'lucide-react';
import { useMemo, useState } from 'react';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { currencyFormatter } from '@/components/record-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { formatoFecha } from '@/lib/vencimiento';
import { pendientes } from '@/routes/compras';
import { store as recibir } from '@/routes/compras/recepciones';
import type { BodegaOption } from '@/types';

type LineaPendiente = {
    id: number;
    producto: string;
    bodega_id: number;
    bodega: string | null;
    cantidad: number;
    recibida: number;
    pendiente: number;
};

type CompraPendiente = {
    id: number;
    factura: string;
    fecha: string | null;
    proveedor: string | null;
    dias_espera: number | null;
    lineas: LineaPendiente[];
};

type Props = {
    compras: CompraPendiente[];
    resumen: { compras: number; unidades: number; valor: number };
    bodegas: BodegaOption[];
};

const TODAS = 'todas';

function Resumen({
    titulo,
    valor,
    icono: Icono,
}: {
    titulo: string;
    valor: string;
    icono: typeof Truck;
}) {
    return (
        <div className="bg-card space-y-1 rounded-lg border p-4">
            <div className="text-muted-foreground flex items-center gap-2 text-sm">
                <Icono className="size-4" />
                {titulo}
            </div>
            <div className="text-2xl font-semibold">{valor}</div>
        </div>
    );
}

/** One compra still to arrive: its lines, with how many units came now. */
function CompraPorRecibir({ compra }: { compra: CompraPendiente }) {
    // Units arriving now by line: the whole pending quantity by default.
    const [llegan, setLlegan] = useState<Record<number, string>>(() =>
        Object.fromEntries(
            compra.lineas.map((linea) => [linea.id, String(linea.pendiente)]),
        ),
    );
    const [procesando, setProcesando] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});

    const enviar = (cantidades: Record<number, number>) => {
        const lineas = Object.fromEntries(
            Object.entries(cantidades).filter(([, cantidad]) => cantidad > 0),
        );

        if (Object.keys(lineas).length === 0) {
            return;
        }

        router.post(
            recibir.url([compra.id]),
            { lineas },
            {
                preserveScroll: true,
                onStart: () => setProcesando(true),
                onFinish: () => setProcesando(false),
                onError: (errors) => setErrores(errors),
                onSuccess: () => setErrores({}),
            },
        );
    };

    const cantidadDe = (linea: LineaPendiente) =>
        Math.min(Math.max(Number(llegan[linea.id]) || 0, 0), linea.pendiente);

    return (
        <div className="bg-card rounded-lg border" data-test="compra-pendiente">
            <div className="flex flex-wrap items-center gap-3 border-b p-4">
                <Truck className="text-muted-foreground size-5" />
                <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                        Factura {compra.factura}
                        {compra.proveedor ? ` · ${compra.proveedor}` : ''}
                    </div>
                    <div className="text-muted-foreground flex items-center gap-1 text-xs">
                        <Clock className="size-3" />
                        Pedida el {formatoFecha(compra.fecha)}
                        {compra.dias_espera !== null
                            ? ` · hace ${compra.dias_espera} ${compra.dias_espera === 1 ? 'día' : 'días'}`
                            : ''}
                    </div>
                </div>
                {compra.dias_espera !== null && compra.dias_espera >= 15 ? (
                    <Badge className="border-transparent bg-red-600 text-white hover:bg-red-600">
                        Demorada
                    </Badge>
                ) : null}
                <Button
                    onClick={() =>
                        enviar(
                            Object.fromEntries(
                                compra.lineas.map((linea) => [
                                    linea.id,
                                    linea.pendiente,
                                ]),
                            ),
                        )
                    }
                    loading={procesando}
                    data-test="compra-pendiente-recibir-todo"
                >
                    <PackageCheck /> Recibir todo
                </Button>
            </div>

            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Producto</TableHead>
                            <TableHead>Bodega</TableHead>
                            <TableHead className="text-right">
                                Recibido
                            </TableHead>
                            <TableHead className="w-32 text-right">
                                Llegan ahora
                            </TableHead>
                            <TableHead />
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {compra.lineas.map((linea) => {
                            const avance =
                                (linea.recibida / linea.cantidad) * 100;

                            return (
                                <TableRow
                                    key={linea.id}
                                    data-test="compra-pendiente-linea"
                                >
                                    <TableCell className="font-medium">
                                        {linea.producto}
                                        <InputError
                                            message={
                                                errores[`lineas.${linea.id}`]
                                            }
                                        />
                                    </TableCell>
                                    <TableCell>{linea.bodega ?? '—'}</TableCell>
                                    <TableCell className="text-right">
                                        <div className="tabular-nums">
                                            {linea.recibida} de {linea.cantidad}
                                        </div>
                                        <div className="bg-muted mt-1 ml-auto h-1.5 w-24 overflow-hidden rounded-full">
                                            <div
                                                className={cn(
                                                    'h-full rounded-full',
                                                    avance > 0
                                                        ? 'bg-amber-500'
                                                        : 'bg-transparent',
                                                )}
                                                style={{ width: `${avance}%` }}
                                            />
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Input
                                            type="number"
                                            min={0}
                                            max={linea.pendiente}
                                            value={llegan[linea.id] ?? ''}
                                            onChange={(event) =>
                                                setLlegan((actual) => ({
                                                    ...actual,
                                                    [linea.id]:
                                                        event.target.value,
                                                }))
                                            }
                                            className="h-8 text-right"
                                            aria-label="Unidades que llegan"
                                            data-test="compra-pendiente-llegan"
                                        />
                                        <div className="text-muted-foreground mt-1 text-xs">
                                            Faltan {linea.pendiente}
                                        </div>
                                    </TableCell>
                                    <TableCell className="text-right">
                                        <Button
                                            size="sm"
                                            variant="outline"
                                            disabled={cantidadDe(linea) <= 0}
                                            onClick={() =>
                                                enviar({
                                                    [linea.id]:
                                                        cantidadDe(linea),
                                                })
                                            }
                                            data-test="compra-pendiente-recibir"
                                        >
                                            Recibir
                                        </Button>
                                    </TableCell>
                                </TableRow>
                            );
                        })}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

/**
 * The goods still to arrive from the proveedores, to receive them as they
 * come in — whole or in parts — so the stock follows what is in the bodega.
 */
export default function ComprasPendientes({
    compras,
    resumen,
    bodegas,
}: Props) {
    const [bodega, setBodega] = useState(TODAS);

    // Only the lines that go to the bodega picked (the compras without any are left out).
    const visibles = useMemo(
        () =>
            bodega === TODAS
                ? compras
                : compras
                      .map((compra) => ({
                          ...compra,
                          lineas: compra.lineas.filter(
                              (linea) => String(linea.bodega_id) === bodega,
                          ),
                      }))
                      .filter((compra) => compra.lineas.length > 0),
        [compras, bodega],
    );

    return (
        <>
            <Head title="Pendientes por recibir" />

            <div className="flex flex-col space-y-6">
                <div className="flex flex-wrap items-end justify-between gap-3">
                    <Heading
                        variant="small"
                        title="Pendientes por recibir"
                        description="Mercancía de compras que aún no llega a la bodega. Recíbela completa o por partes."
                    />
                    {bodegas.length > 1 ? (
                        <Select value={bodega} onValueChange={setBodega}>
                            <SelectTrigger
                                className="w-56"
                                data-test="compras-pendientes-bodega"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value={TODAS}>
                                    Todas las bodegas
                                </SelectItem>
                                {bodegas.map((opcion) => (
                                    <SelectItem
                                        key={opcion.id}
                                        value={String(opcion.id)}
                                    >
                                        {opcion.nombre_bodega}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    ) : null}
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                    <Resumen
                        titulo="Compras por recibir"
                        valor={String(resumen.compras)}
                        icono={Truck}
                    />
                    <Resumen
                        titulo="Unidades por llegar"
                        valor={String(resumen.unidades)}
                        icono={PackageOpen}
                    />
                    <Resumen
                        titulo="Valor por llegar"
                        valor={currencyFormatter.format(resumen.valor)}
                        icono={PackageCheck}
                    />
                </div>

                {visibles.length === 0 ? (
                    <p className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
                        No hay mercancía pendiente por recibir.
                    </p>
                ) : (
                    <div className="space-y-3">
                        {visibles.map((compra) => (
                            <CompraPorRecibir
                                // A new key after each receipt resets what was typed.
                                key={`${compra.id}-${compra.lineas
                                    .map((linea) => linea.recibida)
                                    .join('-')}-${bodega}`}
                                compra={compra}
                            />
                        ))}
                    </div>
                )}
            </div>
        </>
    );
}

ComprasPendientes.layout = () => ({
    breadcrumbs: [
        {
            title: 'Pendientes por recibir',
            href: pendientes(),
        },
    ],
});
