import { Head, router } from '@inertiajs/react';
import {
    Ban,
    CalendarClock,
    CircleCheck,
    HandCoins,
    Package,
    Phone,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import FiltroChips from '@/components/filtro-chips';
import type { OpcionFiltro } from '@/components/filtro-chips';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import Pasos from '@/components/pasos';
import RegistrarPagoModal from '@/components/pedidos/registrar-pago-modal';
import VoucherButton from '@/components/pedidos/voucher-button';
import { currencyFormatter } from '@/components/record-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { diasHasta, fechaMasDias, formatoFecha } from '@/lib/vencimiento';
import * as pedidosAbonosRoutes from '@/routes/pedidos/abonos';
import * as pedidosRoutes from '@/routes/pedidos';
import {
    anular,
    entregar,
    index as separadosIndex,
    update,
    voucher,
} from '@/routes/separados';
import type { Pedido, PucOption, VendedorOption } from '@/types';

type Separado = {
    id: number;
    fecha: string | null;
    total_a_pagar: number | string;
    abono: number | string;
    saldo_pendiente: number | string;
    estado_pago: string;
    fecha_recogida: string | null;
    recogido_at: string | null;
    cliente: {
        id: number;
        razon_social: string;
        telefono: string | null;
    } | null;
    bodega: { id: number; nombre_bodega: string } | null;
    productos: { nombre: string; cantidad: number }[];
};

type Props = {
    separados: Separado[];
    /** The ones picked up come from these last days only. */
    diasRecogidos: number;
    canUpdate: boolean;
    canCobrar: boolean;
    canAnular: boolean;
    pucs: PucOption[];
    vendedores: VendedorOption[];
};

type Filtro = 'POR_RECOGER' | 'LISTOS' | 'VENCIDOS' | 'RECOGIDOS' | 'TODOS';

type Accion = 'FECHA' | 'ANULAR';

const FILTROS: OpcionFiltro<Filtro>[] = [
    {
        value: 'POR_RECOGER',
        label: 'Por recoger',
        className: 'bg-muted text-foreground',
    },
    {
        value: 'LISTOS',
        label: 'Pagados, listos para entregar',
        className:
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
        value: 'VENCIDOS',
        label: 'No vinieron a tiempo',
        className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    },
    {
        value: 'RECOGIDOS',
        label: 'Recogidos',
        className: 'bg-muted text-muted-foreground',
    },
    { value: 'TODOS', label: 'Todos', className: 'bg-muted text-foreground' },
];

const MAX_PRODUCTOS = 4;

function porRecoger(separado: Separado): boolean {
    return separado.recogido_at === null;
}

function vencido(separado: Separado): boolean {
    return (
        porRecoger(separado) &&
        !!separado.fecha_recogida &&
        diasHasta(separado.fecha_recogida) < 0
    );
}

/** Whether a separado is listed under the filter. */
function cumpleFiltro(separado: Separado, filtro: Filtro): boolean {
    switch (filtro) {
        case 'POR_RECOGER':
            return porRecoger(separado);
        case 'LISTOS':
            return (
                porRecoger(separado) && Number(separado.saldo_pendiente) <= 0
            );
        case 'VENCIDOS':
            return vencido(separado);
        case 'RECOGIDOS':
            return !porRecoger(separado);
        default:
            return true;
    }
}

/** "Recoge hoy", "Recoge en 3 días", "Debía recogerlo hace 2 días". */
function cuandoRecoge(fecha: string): string {
    const dias = diasHasta(fecha);

    if (dias < 0) {
        return `Debía recogerlo hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
    }

    if (dias === 0) {
        return 'Recoge hoy';
    }

    return `Recoge en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}

/**
 * The separados: pedidos reserved to pick up in the store. Collect them,
 * hand them over once paid, move the pickup day or cancel them.
 */
export default function Separados({
    separados,
    diasRecogidos,
    canUpdate,
    canCobrar,
    canAnular,
    pucs,
    vendedores,
}: Props) {
    const [filtro, setFiltro] = useState<Filtro>('POR_RECOGER');
    const [accion, setAccion] = useState<{
        tipo: Accion;
        separado: Separado;
    } | null>(null);
    const [aCobrar, setACobrar] = useState<Separado | null>(null);
    const [enviando, setEnviando] = useState<number | null>(null);

    // Everything comes at once: filtering and counting happen here.
    const conteos = useMemo(
        () =>
            Object.fromEntries(
                FILTROS.map((opcion) => [
                    opcion.value,
                    separados.filter((separado) =>
                        cumpleFiltro(separado, opcion.value),
                    ).length,
                ]),
            ) as Record<Filtro, number>,
        [separados],
    );
    const visibles = useMemo(
        () => separados.filter((separado) => cumpleFiltro(separado, filtro)),
        [separados, filtro],
    );

    const marcarEntregado = (separado: Separado) => {
        router.post(
            entregar(separado.id).url,
            {},
            {
                preserveScroll: true,
                onStart: () => setEnviando(separado.id),
                onFinish: () => setEnviando(null),
                onError: (errors) => {
                    if (errors.pedido) {
                        toast.error(errors.pedido);
                    }
                },
            },
        );
    };

    return (
        <>
            <Head title="Separados" />

            <div className="flex flex-col space-y-6">
                <Heading
                    variant="small"
                    title="Separados"
                    description="Pedidos que el cliente separó para recoger en la tienda: cobrarlos y entregarlos cuando estén pagados"
                />

                <FiltroChips
                    opciones={FILTROS}
                    valor={filtro}
                    conteos={conteos}
                    onChange={setFiltro}
                    dataTest="separados-filtros"
                />

                {filtro === 'RECOGIDOS' || filtro === 'TODOS' ? (
                    <p className="text-muted-foreground -mt-3 text-xs">
                        Los recogidos son los de los últimos {diasRecogidos}{' '}
                        días.
                    </p>
                ) : null}

                {visibles.length === 0 ? (
                    <p className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
                        No hay separados en este filtro.
                    </p>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {visibles.map((separado) => {
                            const saldo = Number(separado.saldo_pendiente);
                            const pendiente = porRecoger(separado);
                            const atrasado = vencido(separado);
                            const cobrado = saldo <= 0;

                            return (
                                <div
                                    key={separado.id}
                                    className={cn(
                                        'bg-card flex flex-col gap-3 rounded-lg border p-4',
                                        !pendiente && 'opacity-70',
                                        atrasado &&
                                            'border-red-300 dark:border-red-900',
                                    )}
                                    data-test="separado"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-semibold">
                                                Pedido #{separado.id}
                                            </div>
                                            <div className="text-muted-foreground text-xs">
                                                {separado.cliente
                                                    ?.razon_social ??
                                                    'Sin cliente'}
                                                {separado.bodega
                                                    ? ` · ${separado.bodega.nombre_bodega}`
                                                    : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <VoucherButton
                                                action={voucher(separado.id)}
                                                dataTest="separado-voucher"
                                            />
                                            <Badge
                                                className={cn(
                                                    'border-transparent',
                                                    !pendiente
                                                        ? 'bg-zinc-500 text-white hover:bg-zinc-500'
                                                        : atrasado
                                                          ? 'bg-red-600 text-white hover:bg-red-600'
                                                          : cobrado
                                                            ? 'bg-emerald-600 text-white hover:bg-emerald-600'
                                                            : 'bg-violet-600 text-white hover:bg-violet-600',
                                                )}
                                            >
                                                {!pendiente
                                                    ? 'Recogido'
                                                    : atrasado
                                                      ? 'Vencido'
                                                      : cobrado
                                                        ? 'Listo'
                                                        : 'Separado'}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-sm">
                                        {pendiente &&
                                        separado.fecha_recogida ? (
                                            <div
                                                className={cn(
                                                    'flex gap-2',
                                                    atrasado &&
                                                        'font-medium text-red-600 dark:text-red-400',
                                                )}
                                            >
                                                <CalendarClock className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                                <span>
                                                    {formatoFecha(
                                                        separado.fecha_recogida,
                                                    )}{' '}
                                                    ·{' '}
                                                    {cuandoRecoge(
                                                        separado.fecha_recogida,
                                                    )}
                                                </span>
                                            </div>
                                        ) : null}
                                        {!pendiente && separado.recogido_at ? (
                                            <div className="flex gap-2">
                                                <CircleCheck className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                                <span>
                                                    Recogido el{' '}
                                                    {new Date(
                                                        separado.recogido_at,
                                                    ).toLocaleDateString(
                                                        'es-CO',
                                                    )}
                                                </span>
                                            </div>
                                        ) : null}
                                        {separado.cliente?.telefono ? (
                                            <div className="flex gap-2">
                                                <Phone className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                                <a
                                                    href={`tel:${separado.cliente.telefono}`}
                                                    className="hover:underline"
                                                >
                                                    {separado.cliente.telefono}
                                                </a>
                                            </div>
                                        ) : null}
                                        <div className="flex gap-2">
                                            <Package className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                                            <ul className="min-w-0 flex-1 text-xs">
                                                {separado.productos
                                                    .slice(0, MAX_PRODUCTOS)
                                                    .map((producto, indice) => (
                                                        <li
                                                            key={indice}
                                                            className="truncate"
                                                        >
                                                            {producto.cantidad}{' '}
                                                            × {producto.nombre}
                                                        </li>
                                                    ))}
                                                {separado.productos.length >
                                                MAX_PRODUCTOS ? (
                                                    <li className="text-muted-foreground">
                                                        y{' '}
                                                        {separado.productos
                                                            .length -
                                                            MAX_PRODUCTOS}{' '}
                                                        más...
                                                    </li>
                                                ) : null}
                                            </ul>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-3 gap-2 border-t pt-3 text-sm">
                                        <div>
                                            <div className="text-muted-foreground text-xs">
                                                Total
                                            </div>
                                            <div>
                                                {currencyFormatter.format(
                                                    Number(
                                                        separado.total_a_pagar,
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <div className="text-muted-foreground text-xs">
                                                Abonado
                                            </div>
                                            <div className="text-emerald-600 dark:text-emerald-400">
                                                {currencyFormatter.format(
                                                    Number(separado.abono),
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-muted-foreground text-xs">
                                                Falta
                                            </div>
                                            <div
                                                className={cn(
                                                    'font-semibold',
                                                    saldo > 0
                                                        ? 'text-red-600 dark:text-red-400'
                                                        : 'text-emerald-600 dark:text-emerald-400',
                                                )}
                                            >
                                                {currencyFormatter.format(
                                                    saldo,
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    {pendiente ? (
                                        <Pasos
                                            dataTest="separado-pasos"
                                            siguiente={
                                                cobrado
                                                    ? 'Pagado. Entrégalo cuando el cliente venga.'
                                                    : `Siguiente: cobrar ${currencyFormatter.format(saldo)}.${canCobrar ? '' : ' No tienes permiso para cobrar.'}`
                                            }
                                            pasos={[
                                                {
                                                    clave: 'cobrar',
                                                    label: 'Cobrar',
                                                    icono: HandCoins,
                                                    hecho: cobrado,
                                                    habilitado:
                                                        canCobrar && !cobrado,
                                                    onClick: () =>
                                                        setACobrar(separado),
                                                },
                                                {
                                                    clave: 'entregar',
                                                    label: 'Entregado',
                                                    icono: CircleCheck,
                                                    hecho: false,
                                                    habilitado:
                                                        canUpdate && cobrado,
                                                    cargando:
                                                        enviando ===
                                                        separado.id,
                                                    onClick: () =>
                                                        marcarEntregado(
                                                            separado,
                                                        ),
                                                },
                                            ]}
                                        />
                                    ) : null}

                                    {pendiente && (canUpdate || canAnular) ? (
                                        <div className="flex flex-wrap gap-2">
                                            {canUpdate ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        setAccion({
                                                            tipo: 'FECHA',
                                                            separado,
                                                        })
                                                    }
                                                    data-test="separado-cambiar-fecha"
                                                >
                                                    <CalendarClock />
                                                    Cambiar fecha
                                                </Button>
                                            ) : null}
                                            {canAnular ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-600"
                                                    onClick={() =>
                                                        setAccion({
                                                            tipo: 'ANULAR',
                                                            separado,
                                                        })
                                                    }
                                                    data-test="separado-anular"
                                                >
                                                    <Ban />
                                                    Anular pedido
                                                </Button>
                                            ) : null}
                                        </div>
                                    ) : null}
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            {accion ? (
                <AccionSeparadoModal
                    key={`${accion.tipo}-${accion.separado.id}`}
                    tipo={accion.tipo}
                    separado={accion.separado}
                    onClose={() => setAccion(null)}
                />
            ) : null}

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

/**
 * Moves the pickup day, or cancels the separado when the cliente never comes.
 */
function AccionSeparadoModal({
    tipo,
    separado,
    onClose,
}: {
    tipo: Accion;
    separado: Separado;
    onClose: () => void;
}) {
    const [fecha, setFecha] = useState(
        separado.fecha_recogida && diasHasta(separado.fecha_recogida) >= 0
            ? separado.fecha_recogida
            : fechaMasDias(1),
    );
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [enviando, setEnviando] = useState(false);
    const abonado = Number(separado.abono);

    const opciones = {
        preserveScroll: true,
        onStart: () => setEnviando(true),
        onFinish: () => setEnviando(false),
        onError: (errors: Record<string, string>) => setErrores(errors),
        onSuccess: onClose,
    };

    const enviar = () => {
        if (tipo === 'ANULAR') {
            router.post(anular(separado.id).url, {}, opciones);

            return;
        }

        router.patch(
            update(separado.id).url,
            { fecha_recogida: fecha },
            opciones,
        );
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {tipo === 'ANULAR'
                            ? `Anular pedido #${separado.id}`
                            : `Cambiar fecha de recogida del pedido #${separado.id}`}
                    </DialogTitle>
                    <DialogDescription>
                        {separado.cliente?.razon_social ?? 'Sin cliente'}
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="grid gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        enviar();
                    }}
                >
                    {tipo === 'FECHA' ? (
                        <div className="grid gap-2">
                            <Label required htmlFor="separado-fecha">
                                El cliente lo recoge el
                            </Label>
                            <Input
                                id="separado-fecha"
                                type="date"
                                min={fechaMasDias(0)}
                                value={fecha}
                                onChange={(event) =>
                                    setFecha(event.target.value)
                                }
                                data-test="separado-fecha"
                            />
                            <InputError message={errores.fecha_recogida} />
                        </div>
                    ) : (
                        <div className="grid gap-2 text-sm">
                            <p>
                                El pedido se anula: los productos vuelven al
                                inventario de la bodega y el cliente deja de
                                deberlo. No se puede deshacer desde aquí.
                            </p>
                            {abonado > 0 ? (
                                <p className="rounded-md border border-amber-200 bg-amber-50 p-2 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                                    El cliente abonó{' '}
                                    {currencyFormatter.format(abonado)}.
                                    Recuerda devolverle ese dinero.
                                </p>
                            ) : null}
                        </div>
                    )}
                    <InputError message={errores.pedido} />

                    <DialogFooter>
                        <DialogClose asChild>
                            <Button type="button" variant="outline">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            disabled={enviando}
                            variant={
                                tipo === 'ANULAR' ? 'destructive' : 'default'
                            }
                            data-test="separado-confirmar"
                        >
                            {tipo === 'ANULAR' ? <Ban /> : <CalendarClock />}
                            {tipo === 'ANULAR'
                                ? 'Anular pedido'
                                : 'Guardar fecha'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

Separados.layout = () => ({
    breadcrumbs: [
        {
            title: 'Separados',
            href: separadosIndex(),
        },
    ],
});
