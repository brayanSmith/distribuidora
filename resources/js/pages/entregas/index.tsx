import { Head, router } from '@inertiajs/react';
import {
    CalendarClock,
    MapPin,
    Phone,
    Truck,
    TriangleAlert,
    Undo2,
    Ban,
    UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { ReactNode } from 'react';
import PasosEntrega from '@/components/entregas/pasos-entrega';
import FiltroChips from '@/components/filtro-chips';
import type { OpcionFiltro } from '@/components/filtro-chips';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
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
import { fechaMasDias, formatoFecha } from '@/lib/vencimiento';
import * as pedidosAbonosRoutes from '@/routes/pedidos/abonos';
import * as pedidosRoutes from '@/routes/pedidos';
import {
    anular,
    index as entregasIndex,
    update,
    voucher,
} from '@/routes/entregas';
import type { Pedido, PucOption, VendedorOption } from '@/types';

type EstadoEntrega =
    | 'POR_DESPACHAR'
    | 'EN_CAMINO'
    | 'ENTREGADO'
    | 'DEVUELTO'
    | 'ANULADO';

type Entrega = {
    id: number;
    pedido_id: number;
    direccion: string;
    ciudad: string | null;
    telefono: string;
    recibe: string | null;
    nota: string | null;
    fecha_programada: string | null;
    estado: EstadoEntrega;
    motivo: string | null;
    reagendamientos: number;
    mensajero: string | null;
    despachada_at: string | null;
    entregada_at: string | null;
    pedido: Pick<
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
        cliente: { id: number; razon_social: string } | null;
        bodega: { id: number; nombre_bodega: string } | null;
    };
};

type Props = {
    entregas: Entrega[];
    /** The delivered and cancelled ones come from these last days only. */
    diasFinalizadas: number;
    canUpdate: boolean;
    canCobrar: boolean;
    /** Can cancel a returned pedido (needs to delete pedidos too). */
    canAnular: boolean;
    pucs: PucOption[];
    vendedores: VendedorOption[];
};

/** Which deliveries are listed: the pending ones (active + returned), one estado or all. */
type Filtro = 'PENDIENTES' | EstadoEntrega | 'TODAS';

const FILTROS: OpcionFiltro<Filtro>[] = [
    {
        value: 'PENDIENTES',
        label: 'Pendientes',
        className: 'bg-muted text-foreground',
    },
    {
        value: 'POR_DESPACHAR',
        label: 'Por despachar',
        className:
            'bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300',
    },
    {
        value: 'EN_CAMINO',
        label: 'En camino',
        className: 'bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-300',
    },
    {
        value: 'DEVUELTO',
        label: 'Devueltas',
        className: 'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
    },
    {
        value: 'ENTREGADO',
        label: 'Entregadas',
        className:
            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
    },
    {
        value: 'ANULADO',
        label: 'Anuladas',
        className: 'bg-muted text-muted-foreground',
    },
    { value: 'TODAS', label: 'Todas', className: 'bg-muted text-foreground' },
];

/** Whether a delivery is listed under the filter. */
function cumpleFiltro(entrega: Entrega, filtro: Filtro): boolean {
    if (filtro === 'TODAS') {
        return true;
    }

    if (filtro === 'PENDIENTES') {
        return (
            entrega.estado === 'POR_DESPACHAR' ||
            entrega.estado === 'EN_CAMINO' ||
            entrega.estado === 'DEVUELTO'
        );
    }

    return entrega.estado === filtro;
}

/** What the dialog asks for, depending on the action. */
type Accion = 'DESPACHAR' | 'DEVOLVER' | 'REAGENDAR' | 'ANULAR';

const ESTADOS: Record<EstadoEntrega, { label: string; className: string }> = {
    POR_DESPACHAR: {
        label: 'Por despachar',
        className: 'bg-amber-500 text-white hover:bg-amber-500',
    },
    EN_CAMINO: {
        label: 'En camino',
        className: 'bg-sky-600 text-white hover:bg-sky-600',
    },
    ENTREGADO: {
        label: 'Entregado',
        className: 'bg-emerald-600 text-white hover:bg-emerald-600',
    },
    DEVUELTO: {
        label: 'Devuelto',
        className: 'bg-red-600 text-white hover:bg-red-600',
    },
    ANULADO: {
        label: 'Anulado',
        className: 'bg-zinc-500 text-white hover:bg-zinc-500',
    },
};

const MOTIVOS_DEVOLUCION = [
    'El cliente no estaba',
    'Dirección errada',
    'El cliente rechazó el pedido',
    'No tenía con qué pagar',
    'No contestó el teléfono',
];

const MOTIVOS_REAGENDAR = [
    'El cliente pidió otro día',
    'El cliente no estaba',
    'No alcanzó el mensajero',
];

/**
 * The contra entrega pedidos: dispatch them, collect the money when they
 * are delivered, mark them returned (saying why) or reschedule them.
 */
export default function Entregas({
    entregas,
    diasFinalizadas,
    canUpdate,
    canCobrar,
    canAnular,
    pucs,
    vendedores,
}: Props) {
    const [accion, setAccion] = useState<{
        tipo: Accion;
        entrega: Entrega;
    } | null>(null);
    const [aCobrar, setACobrar] = useState<Entrega['pedido'] | null>(null);
    const [enviando, setEnviando] = useState<number | null>(null);
    const hoy = fechaMasDias(0);
    const [filtro, setFiltro] = useState<Filtro>('PENDIENTES');

    // Everything comes at once: filtering and counting happen here.
    const conteos = useMemo(
        () =>
            Object.fromEntries(
                FILTROS.map((opcion) => [
                    opcion.value,
                    entregas.filter((entrega) =>
                        cumpleFiltro(entrega, opcion.value),
                    ).length,
                ]),
            ) as Record<Filtro, number>,
        [entregas],
    );
    const visibles = useMemo(
        () => entregas.filter((entrega) => cumpleFiltro(entrega, filtro)),
        [entregas, filtro],
    );

    const marcarEntregado = (entrega: Entrega) => {
        router.patch(
            update(entrega.id).url,
            { estado: 'ENTREGADO' },
            {
                preserveScroll: true,
                onStart: () => setEnviando(entrega.id),
                onFinish: () => setEnviando(null),
                onError: (errors) => {
                    if (errors.estado) {
                        toast.error(errors.estado);
                    }
                },
            },
        );
    };

    return (
        <>
            <Head title="Entregas" />

            <div className="flex flex-col space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Heading
                        variant="small"
                        title="Entregas"
                        description="Pedidos contra entrega: despacharlos, cobrarlos al entregar, reagendarlos o registrar la devolución"
                    />
                </div>

                <FiltroChips
                    opciones={FILTROS}
                    valor={filtro}
                    conteos={conteos}
                    onChange={setFiltro}
                    dataTest="entregas-filtros"
                />

                {filtro === 'ENTREGADO' ||
                filtro === 'ANULADO' ||
                filtro === 'TODAS' ? (
                    <p className="text-muted-foreground -mt-3 text-xs">
                        Las entregadas y anuladas son las de los últimos{' '}
                        {diasFinalizadas} días.
                    </p>
                ) : null}

                {visibles.length === 0 ? (
                    <p className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
                        {filtro === 'TODAS'
                            ? 'Todavía no hay entregas.'
                            : `No hay entregas ${(FILTROS.find((opcion) => opcion.value === filtro)?.label ?? 'pendientes').toLowerCase()}.`}
                    </p>
                ) : (
                    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                        {visibles.map((entrega) => {
                            const saldo = Number(
                                entrega.pedido.saldo_pendiente,
                            );
                            const activa =
                                entrega.estado === 'POR_DESPACHAR' ||
                                entrega.estado === 'EN_CAMINO';
                            // Collected on its way: only delivering it is left.
                            const cobradoEnCamino =
                                entrega.estado === 'EN_CAMINO' && saldo <= 0;
                            const puedeReagendar =
                                canUpdate &&
                                !cobradoEnCamino &&
                                (activa || entrega.estado === 'DEVUELTO');
                            const puedeDevolver =
                                canUpdate && activa && !cobradoEnCamino;
                            const puedeAnularla =
                                canAnular && entrega.estado === 'DEVUELTO';
                            const atrasada =
                                activa &&
                                !!entrega.fecha_programada &&
                                entrega.fecha_programada < hoy;

                            return (
                                <div
                                    key={entrega.id}
                                    className={cn(
                                        'bg-card flex flex-col gap-3 rounded-lg border p-4',
                                        !activa && 'opacity-70',
                                        atrasada &&
                                            'border-red-300 dark:border-red-900',
                                    )}
                                    data-test="entrega"
                                >
                                    <div className="flex items-start justify-between gap-2">
                                        <div>
                                            <div className="font-semibold">
                                                Pedido #{entrega.pedido.id}
                                            </div>
                                            <div className="text-muted-foreground text-xs">
                                                {entrega.pedido.cliente
                                                    ?.razon_social ??
                                                    'Sin cliente'}
                                                {entrega.pedido.bodega
                                                    ? ` · ${entrega.pedido.bodega.nombre_bodega}`
                                                    : ''}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <VoucherButton
                                                action={voucher(entrega.id)}
                                                dataTest="entrega-voucher"
                                            />
                                            <Badge
                                                className={cn(
                                                    'border-transparent',
                                                    ESTADOS[entrega.estado]
                                                        .className,
                                                )}
                                            >
                                                {ESTADOS[entrega.estado].label}
                                            </Badge>
                                        </div>
                                    </div>

                                    <div className="space-y-1 text-sm">
                                        {entrega.fecha_programada ? (
                                            <Dato
                                                icono={CalendarClock}
                                                className={cn(
                                                    atrasada &&
                                                        'font-medium text-red-600 dark:text-red-400',
                                                )}
                                            >
                                                Entregar el{' '}
                                                {formatoFecha(
                                                    entrega.fecha_programada,
                                                )}
                                                {atrasada ? ' (atrasada)' : ''}
                                                {entrega.reagendamientos > 0
                                                    ? ` · reagendada ${entrega.reagendamientos} ${entrega.reagendamientos === 1 ? 'vez' : 'veces'}`
                                                    : ''}
                                            </Dato>
                                        ) : null}
                                        <Dato icono={MapPin}>
                                            {entrega.direccion}
                                            {entrega.ciudad
                                                ? `, ${entrega.ciudad}`
                                                : ''}
                                        </Dato>
                                        <Dato icono={Phone}>
                                            <a
                                                href={`tel:${entrega.telefono}`}
                                                className="hover:underline"
                                            >
                                                {entrega.telefono}
                                            </a>
                                        </Dato>
                                        {entrega.recibe ? (
                                            <Dato icono={UserRound}>
                                                {entrega.recibe}
                                            </Dato>
                                        ) : null}
                                        {entrega.mensajero ? (
                                            <Dato icono={Truck}>
                                                {entrega.mensajero}
                                            </Dato>
                                        ) : null}
                                        {entrega.motivo ? (
                                            <Dato
                                                icono={TriangleAlert}
                                                className="text-amber-700 dark:text-amber-400"
                                            >
                                                {entrega.motivo}
                                            </Dato>
                                        ) : null}
                                        {entrega.nota ? (
                                            <p className="text-muted-foreground text-xs italic">
                                                {entrega.nota}
                                            </p>
                                        ) : null}
                                    </div>

                                    <div className="flex items-end justify-between border-t pt-3 text-sm">
                                        <div>
                                            <div className="text-muted-foreground text-xs">
                                                Total
                                            </div>
                                            <div>
                                                {currencyFormatter.format(
                                                    Number(
                                                        entrega.pedido
                                                            .total_a_pagar,
                                                    ),
                                                )}
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="text-muted-foreground text-xs">
                                                Por cobrar
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

                                    {activa ? (
                                        <PasosEntrega
                                            estado={
                                                entrega.estado as
                                                    | 'POR_DESPACHAR'
                                                    | 'EN_CAMINO'
                                            }
                                            saldo={saldo}
                                            canUpdate={canUpdate}
                                            canCobrar={canCobrar}
                                            entregando={enviando === entrega.id}
                                            onDespachar={() =>
                                                setAccion({
                                                    tipo: 'DESPACHAR',
                                                    entrega,
                                                })
                                            }
                                            onCobrar={() =>
                                                setACobrar(entrega.pedido)
                                            }
                                            onEntregar={() =>
                                                marcarEntregado(entrega)
                                            }
                                        />
                                    ) : null}

                                    {puedeReagendar ||
                                    puedeDevolver ||
                                    puedeAnularla ? (
                                        <div className="flex flex-wrap gap-2">
                                            {puedeReagendar ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    onClick={() =>
                                                        setAccion({
                                                            tipo: 'REAGENDAR',
                                                            entrega,
                                                        })
                                                    }
                                                    data-test="entrega-reagendar"
                                                >
                                                    <CalendarClock />
                                                    Reagendar
                                                </Button>
                                            ) : null}
                                            {puedeDevolver ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-600"
                                                    onClick={() =>
                                                        setAccion({
                                                            tipo: 'DEVOLVER',
                                                            entrega,
                                                        })
                                                    }
                                                    data-test="entrega-devolver"
                                                >
                                                    <Undo2 />
                                                    Devuelto
                                                </Button>
                                            ) : null}
                                            {puedeAnularla ? (
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    className="text-red-600"
                                                    onClick={() =>
                                                        setAccion({
                                                            tipo: 'ANULAR',
                                                            entrega,
                                                        })
                                                    }
                                                    data-test="entrega-anular"
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
                <AccionEntregaModal
                    key={`${accion.tipo}-${accion.entrega.id}`}
                    tipo={accion.tipo}
                    entrega={accion.entrega}
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

function Dato({
    icono: Icono,
    className,
    children,
}: {
    icono: typeof MapPin;
    className?: string;
    children: ReactNode;
}) {
    return (
        <div className={cn('flex gap-2', className)}>
            <Icono className="text-muted-foreground mt-0.5 size-4 shrink-0" />
            <span>{children}</span>
        </div>
    );
}

/**
 * Asks what each action needs: who takes it (despachar), why it came back
 * (devolver) or the new day and why (reagendar).
 */
function AccionEntregaModal({
    tipo,
    entrega,
    onClose,
}: {
    tipo: Accion;
    entrega: Entrega;
    onClose: () => void;
}) {
    const [mensajero, setMensajero] = useState(entrega.mensajero ?? '');
    const [motivo, setMotivo] = useState('');
    const [fecha, setFecha] = useState(fechaMasDias(1));
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [enviando, setEnviando] = useState(false);

    const textos = {
        DESPACHAR: {
            titulo: 'Despachar',
            boton: 'Marcar en camino',
            icono: Truck,
        },
        DEVOLVER: {
            titulo: 'Registrar devolución del',
            boton: 'Marcar devuelto',
            icono: Undo2,
        },
        REAGENDAR: {
            titulo: 'Reagendar',
            boton: 'Reagendar',
            icono: CalendarClock,
        },
        ANULAR: {
            titulo: 'Anular',
            boton: 'Anular pedido',
            icono: Ban,
        },
    }[tipo];
    const abonado = Number(entrega.pedido.abono);
    const Icono = textos.icono;
    const motivos =
        tipo === 'DEVOLVER' ? MOTIVOS_DEVOLUCION : MOTIVOS_REAGENDAR;

    const opciones = {
        preserveScroll: true,
        onStart: () => setEnviando(true),
        onFinish: () => setEnviando(false),
        onError: (errors: Record<string, string>) => setErrores(errors),
        onSuccess: onClose,
    };

    const enviar = () => {
        if (tipo === 'ANULAR') {
            router.post(anular(entrega.id).url, {}, opciones);

            return;
        }

        const datos = {
            DESPACHAR: { estado: 'EN_CAMINO', mensajero },
            DEVOLVER: { estado: 'DEVUELTO', motivo },
            REAGENDAR: {
                estado: 'POR_DESPACHAR',
                fecha_programada: fecha,
                motivo,
            },
        }[tipo];

        router.patch(update(entrega.id).url, datos, opciones);
    };

    return (
        <Dialog open onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>
                        {textos.titulo} pedido #{entrega.pedido.id}
                    </DialogTitle>
                    <DialogDescription>
                        {entrega.pedido.cliente?.razon_social ?? 'Sin cliente'}{' '}
                        · {entrega.direccion}
                        {entrega.ciudad ? `, ${entrega.ciudad}` : ''}
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="grid gap-4"
                    onSubmit={(event) => {
                        event.preventDefault();
                        enviar();
                    }}
                >
                    {tipo === 'ANULAR' ? (
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
                            <InputError message={errores.estado} />
                        </div>
                    ) : null}

                    {tipo === 'DESPACHAR' ? (
                        <div className="grid gap-2">
                            <Label htmlFor="entrega-mensajero">
                                Mensajero / quién lo lleva
                            </Label>
                            <Input
                                id="entrega-mensajero"
                                value={mensajero}
                                onChange={(event) =>
                                    setMensajero(event.target.value)
                                }
                                autoFocus
                                data-test="entrega-mensajero"
                            />
                        </div>
                    ) : null}

                    {tipo === 'REAGENDAR' ? (
                        <div className="grid gap-2">
                            <Label required htmlFor="entrega-fecha">
                                Nueva fecha de entrega
                            </Label>
                            <Input
                                id="entrega-fecha"
                                type="date"
                                min={fechaMasDias(0)}
                                value={fecha}
                                onChange={(event) =>
                                    setFecha(event.target.value)
                                }
                                data-test="entrega-fecha"
                            />
                            <InputError message={errores.fecha_programada} />
                        </div>
                    ) : null}

                    {tipo === 'DEVOLVER' || tipo === 'REAGENDAR' ? (
                        <div className="grid gap-2">
                            <Label
                                required={tipo === 'DEVOLVER'}
                                htmlFor="entrega-motivo"
                            >
                                Motivo
                            </Label>
                            <div className="flex flex-wrap gap-1.5">
                                {motivos.map((opcion) => (
                                    <Button
                                        key={opcion}
                                        type="button"
                                        size="sm"
                                        variant={
                                            motivo === opcion
                                                ? 'default'
                                                : 'outline'
                                        }
                                        className="h-7 text-xs"
                                        onClick={() => setMotivo(opcion)}
                                    >
                                        {opcion}
                                    </Button>
                                ))}
                            </div>
                            <Input
                                id="entrega-motivo"
                                value={motivo}
                                onChange={(event) =>
                                    setMotivo(event.target.value)
                                }
                                placeholder="U otro motivo..."
                                data-test="entrega-motivo"
                            />
                            <InputError message={errores.motivo} />
                        </div>
                    ) : null}

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
                                tipo === 'DEVOLVER' || tipo === 'ANULAR'
                                    ? 'destructive'
                                    : 'default'
                            }
                            data-test="entrega-confirmar"
                        >
                            <Icono />
                            {textos.boton}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

Entregas.layout = () => ({
    breadcrumbs: [
        {
            title: 'Entregas',
            href: entregasIndex(),
        },
    ],
});
