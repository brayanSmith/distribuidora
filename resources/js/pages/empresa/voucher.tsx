import {
    DndContext,
    KeyboardSensor,
    PointerSensor,
    closestCenter,
    useSensor,
    useSensors,
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
    SortableContext,
    arrayMove,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { Head, router } from '@inertiajs/react';
import { Plus, RefreshCw, RotateCcw, Save } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import BloqueEditor from '@/components/voucher/bloque-editor';
import {
    disenoPorDefecto,
    normalizarDiseno,
    nuevoBloqueTexto,
} from '@/lib/voucher-diseno';
import type { BloqueVoucher, DisenoVoucher } from '@/lib/voucher-diseno';
import { edit as empresaEdit } from '@/routes/empresa';
import { edit, update } from '@/routes/empresa/voucher';
import type { PosVoucher } from '@/types';

type Props = {
    diseno: unknown;
    empresa: PosVoucher['empresa'];
    canUpdate: boolean;
};

/** A sale to preview the design with, using the company's real data. */
function ventaDeEjemplo(
    empresa: PosVoucher['empresa'],
    conTurno: boolean,
    contraEntrega: boolean,
): PosVoucher {
    return {
        empresa,
        pedido: {
            id: 1024,
            turno: conTurno ? 'PRI-0007' : null,
            fecha: new Date().toLocaleString('es-CO'),
            facturacion_electronica: false,
            observacion: 'Entregar en portería',
            observacion_pago: null,
            subtotal: 185000,
            descuento: 5000,
            flete: 0,
            retefuente: 0,
            reteica: 0,
            total_a_pagar: 180000,
            abono: contraEntrega ? 0 : 180000,
            saldo_pendiente: contraEntrega ? 180000 : 0,
        },
        vendedor: 'Ana Gómez',
        cliente: {
            razon_social: 'Cliente de ejemplo S.A.S.',
            numero_documento: '900123456-7',
            ciudad: 'Bogotá',
            direccion: 'Calle 10 # 5-20',
            telefono: '3001234567',
            email: 'cliente@ejemplo.com',
        },
        entrega: contraEntrega
            ? {
                  direccion: 'Carrera 15 # 80-12',
                  ciudad: 'Bogotá',
                  telefono: '3109876543',
                  recibe: 'Juan Pérez',
                  nota: 'Llamar al llegar',
                  fecha_programada: null,
                  mensajero: 'Pedro',
              }
            : null,
        detalles: [
            { nombre: '155R13-WANDA-Llanta carro', cantidad: 2, total: 150000 },
            { nombre: 'Válvula metálica', cantidad: 4, total: 20000 },
            { nombre: 'Balanceo', cantidad: 1, total: 15000 },
        ],
    };
}

/**
 * The voucher designer: the blocks it prints, dragged into order, shown or
 * hidden and set up one by one, next to a live preview of the PDF.
 */
export default function VoucherDiseno({ diseno, empresa, canUpdate }: Props) {
    const [bloques, setBloques] = useState<BloqueVoucher[]>(
        () => normalizarDiseno(diseno).bloques,
    );
    const [guardado, setGuardado] = useState(() =>
        JSON.stringify(normalizarDiseno(diseno).bloques),
    );
    const [guardando, setGuardando] = useState(false);
    const [conTurno, setConTurno] = useState(true);
    const [contraEntrega, setContraEntrega] = useState(false);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [generando, setGenerando] = useState(true);
    const urlAnterior = useRef<string | null>(null);

    const sensores = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    const disenoActual: DisenoVoucher = useMemo(
        () => ({ version: 1, bloques }),
        [bloques],
    );
    const hayCambios = JSON.stringify(bloques) !== guardado;
    /** What the preview on screen was made from, to tell when it is behind. */
    const [previsualizado, setPrevisualizado] = useState<string | null>(null);
    const estadoActual = JSON.stringify({ bloques, conTurno, contraEntrega });
    const vistaDesactualizada = previsualizado !== estadoActual;

    // Made on demand (and once on opening), not on every change.
    const actualizarVistaPrevia = async () => {
        setGenerando(true);

        try {
            const { generarVoucherPdf } =
                await import('@/components/pos/voucher-pdf');
            const blob = await generarVoucherPdf(
                ventaDeEjemplo(empresa, conTurno, contraEntrega),
                disenoActual,
            );
            const url = URL.createObjectURL(blob);

            if (urlAnterior.current) {
                URL.revokeObjectURL(urlAnterior.current);
            }

            urlAnterior.current = url;
            setVistaPrevia(url);
            setPrevisualizado(estadoActual);
        } finally {
            setGenerando(false);
        }
    };

    useEffect(() => {
        void actualizarVistaPrevia();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(
        () => () => {
            if (urlAnterior.current) {
                URL.revokeObjectURL(urlAnterior.current);
            }
        },
        [],
    );

    const alSoltar = ({ active, over }: DragEndEvent) => {
        if (over && active.id !== over.id) {
            setBloques((actuales) =>
                arrayMove(
                    actuales,
                    actuales.findIndex((bloque) => bloque.id === active.id),
                    actuales.findIndex((bloque) => bloque.id === over.id),
                ),
            );
        }
    };

    const cambiarBloque = (cambiado: BloqueVoucher) =>
        setBloques((actuales) =>
            actuales.map((bloque) =>
                bloque.id === cambiado.id ? cambiado : bloque,
            ),
        );

    const guardar = () => {
        router.put(
            update().url,
            { bloques },
            {
                preserveScroll: true,
                onStart: () => setGuardando(true),
                onFinish: () => setGuardando(false),
                onSuccess: () => setGuardado(JSON.stringify(bloques)),
            },
        );
    };

    const restaurar = () => {
        if (
            window.confirm(
                '¿Volver al diseño original? Se pierden los cambios hechos al voucher.',
            )
        ) {
            setBloques(disenoPorDefecto().bloques);
        }
    };

    return (
        <>
            <Head title="Diseño del voucher" />

            <div className="flex flex-col space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Heading
                        variant="small"
                        title="Diseño del voucher"
                        description="Arrastra los bloques para cambiar el orden, muéstralos u ocúltalos y ábrelos para ajustar cómo se ven."
                    />
                    {canUpdate ? (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={restaurar}
                            >
                                <RotateCcw />
                                Diseño original
                            </Button>
                            <Button
                                type="button"
                                onClick={guardar}
                                loading={guardando}
                                disabled={!hayCambios}
                                data-test="voucher-guardar"
                            >
                                <Save />
                                {hayCambios ? 'Guardar diseño' : 'Guardado'}
                            </Button>
                        </div>
                    ) : null}
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
                    <div className="grid content-start gap-2">
                        <DndContext
                            sensors={sensores}
                            collisionDetection={closestCenter}
                            onDragEnd={alSoltar}
                        >
                            <SortableContext
                                items={bloques.map((bloque) => bloque.id)}
                                strategy={verticalListSortingStrategy}
                            >
                                {bloques.map((bloque) => (
                                    <BloqueEditor
                                        key={bloque.id}
                                        bloque={bloque}
                                        onChange={cambiarBloque}
                                        disabled={!canUpdate}
                                        onRemove={
                                            bloque.tipo === 'texto'
                                                ? () =>
                                                      setBloques((actuales) =>
                                                          actuales.filter(
                                                              (item) =>
                                                                  item.id !==
                                                                  bloque.id,
                                                          ),
                                                      )
                                                : undefined
                                        }
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>

                        {canUpdate ? (
                            <Button
                                type="button"
                                variant="outline"
                                className="justify-self-start"
                                onClick={() =>
                                    setBloques((actuales) => [
                                        ...actuales,
                                        nuevoBloqueTexto(),
                                    ])
                                }
                                data-test="voucher-agregar-texto"
                            >
                                <Plus />
                                Agregar texto libre
                            </Button>
                        ) : null}
                    </div>

                    <div className="grid content-start gap-3 lg:sticky lg:top-20">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                                Vista previa
                            </span>
                            <Button
                                type="button"
                                size="sm"
                                variant={
                                    vistaDesactualizada ? 'default' : 'outline'
                                }
                                loading={generando}
                                onClick={() => void actualizarVistaPrevia()}
                                data-test="voucher-actualizar-vista"
                            >
                                {generando ? null : <RefreshCw />}
                                Actualizar vista previa
                            </Button>
                        </div>
                        {vistaDesactualizada && !generando ? (
                            <p className="-mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                                Hiciste cambios: dale a “Actualizar vista
                                previa” para verlos.
                            </p>
                        ) : null}
                        <div className="flex flex-wrap gap-4 text-sm">
                            <label className="flex items-center gap-2">
                                <Switch
                                    checked={conTurno}
                                    onCheckedChange={setConTurno}
                                />
                                Con turno
                            </label>
                            <label className="flex items-center gap-2">
                                <Switch
                                    checked={contraEntrega}
                                    onCheckedChange={setContraEntrega}
                                />
                                Contra entrega
                            </label>
                        </div>
                        <div className="bg-muted h-[70svh] overflow-hidden rounded-md border">
                            {vistaPrevia ? (
                                <iframe
                                    src={`${vistaPrevia}#toolbar=0&navpanes=0&view=FitH`}
                                    title="Vista previa del voucher"
                                    className="h-full w-full"
                                />
                            ) : null}
                        </div>
                        <p className="text-muted-foreground text-xs">
                            Con datos de ejemplo. El ticket crece según la
                            cantidad de productos de cada venta.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

VoucherDiseno.layout = () => ({
    breadcrumbs: [
        { title: 'Empresa', href: empresaEdit() },
        { title: 'Diseño del voucher', href: edit() },
    ],
});
