import { Form, router, usePage, usePoll } from '@inertiajs/react';
import { CheckCheck, FileDown, Upload } from 'lucide-react';
import type { PropsWithChildren } from 'react';
import { useEffect, useState } from 'react';
import InputError from '@/components/input-error';
import { Cargando } from '@/components/record-view';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';
import { leida, leidas, plantilla, store } from '@/routes/importaciones';
import type { Importacion, ImportacionEstado } from '@/types';

const COLUMNAS =
    'sku, marca, referencia, descripcion, categoria, subcategoria, costo, valor_detal, valor_mayorista, inventariable';

const ESTADOS: Record<ImportacionEstado, { label: string; className: string }> =
    {
        pendiente: {
            label: 'En cola',
            className: 'bg-muted text-muted-foreground',
        },
        procesando: {
            label: 'Procesando',
            className:
                'bg-sky-100 text-sky-700 dark:bg-sky-950 dark:text-sky-400',
        },
        completada: {
            label: 'Completada',
            className:
                'bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
        },
        fallida: {
            label: 'Fallida',
            className:
                'bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-400',
        },
    };

/** Props the dialog refreshes: the list and the counters of the header button. */
const PROPS_IMPORTACIONES = [
    'importaciones',
    'importacionesSinLeer',
    'importacionesEnCurso',
];

const fechaHora = new Intl.DateTimeFormat('es-CO', {
    dateStyle: 'short',
    timeStyle: 'short',
});

function esSinLeer(importacion: Importacion): boolean {
    return (
        (importacion.estado === 'completada' ||
            importacion.estado === 'fallida') &&
        importacion.leida_at === null
    );
}

/**
 * Imports productos from a CSV, TXT or Excel file. The file is processed in the
 * background, so the dialog can be closed and the user can keep working; the
 * "Notificaciones" tab keeps the history of the user's imports and their
 * failed rows.
 */
export default function ImportarProductosModal({ children }: PropsWithChildren) {
    const [open, setOpen] = useState(false);
    const [pestana, setPestana] = useState<'importar' | 'notificaciones'>(
        'importar',
    );
    const [detalle, setDetalle] = useState<Importacion | null>(null);
    const [cargandoLista, setCargandoLista] = useState(false);
    const page = usePage();
    const importaciones =
        (page.props.importaciones as Importacion[] | undefined) ?? [];
    const sinLeer = page.props.importacionesSinLeer ?? 0;
    const hayEnCurso = importaciones.some(
        (importacion) =>
            importacion.estado === 'pendiente' ||
            importacion.estado === 'procesando',
    );

    const { start, stop } = usePoll(
        3000,
        { only: PROPS_IMPORTACIONES },
        { autoStart: false },
    );

    // The list is only requested while the dialog is open. With unread
    // notifications it opens straight on them.
    useEffect(() => {
        if (open) {
            setPestana(sinLeer > 0 ? 'notificaciones' : 'importar');
            router.reload({
                only: PROPS_IMPORTACIONES,
                onStart: () => setCargandoLista(true),
                onFinish: () => setCargandoLista(false),
            });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    useEffect(() => {
        if (open && hayEnCurso) {
            start();
        } else {
            stop();
        }
    }, [open, hayEnCurso, start, stop]);

    const marcarLeida = (importacion: Importacion) =>
        router.visit(leida([importacion.id]), {
            only: PROPS_IMPORTACIONES,
            preserveScroll: true,
            preserveState: true,
        });

    const marcarTodas = () =>
        router.visit(leidas(), {
            only: PROPS_IMPORTACIONES,
            preserveScroll: true,
            preserveState: true,
        });

    return (
        <>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>{children}</DialogTrigger>
                <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>Importar productos</DialogTitle>
                        <DialogDescription>
                            Se procesa en segundo plano: puedes cerrar esta
                            ventana y seguir trabajando.
                        </DialogDescription>
                    </DialogHeader>

                    <Tabs
                        value={pestana}
                        onValueChange={(value) =>
                            setPestana(value as typeof pestana)
                        }
                    >
                        <TabsList>
                            <TabsTrigger
                                value="importar"
                                data-test="importacion-tab-importar"
                            >
                                Importar
                            </TabsTrigger>
                            <TabsTrigger
                                value="notificaciones"
                                data-test="importacion-tab-notificaciones"
                            >
                                Notificaciones
                                {sinLeer > 0 ? (
                                    <span className="ml-1 rounded-full bg-red-600 px-1.5 text-xs text-white tabular-nums">
                                        {sinLeer}
                                    </span>
                                ) : null}
                            </TabsTrigger>
                        </TabsList>

                        <TabsContent value="importar" className="space-y-3">
                            <p className="text-muted-foreground text-sm">
                                Archivo CSV, TXT o Excel con las columnas:{' '}
                                {COLUMNAS}. Si el SKU ya existe se actualiza el
                                producto; las categorías y subcategorías que no
                                existan se crean solas.
                            </p>

                            <Form
                                {...store.form()}
                                className="space-y-3"
                                resetOnSuccess
                                options={{
                                    only: [...PROPS_IMPORTACIONES, 'flash'],
                                }}
                                onSuccess={() => setPestana('notificaciones')}
                            >
                                {({ errors, processing }) => (
                                    <>
                                        <div className="grid gap-2">
                                            <Label htmlFor="archivo">
                                                Archivo
                                            </Label>
                                            <Input
                                                id="archivo"
                                                name="archivo"
                                                type="file"
                                                accept=".csv,.txt,.xlsx"
                                                data-test="importacion-archivo"
                                                required
                                            />
                                            <InputError
                                                message={errors.archivo}
                                            />
                                        </div>

                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                type="submit"
                                                disabled={processing}
                                                data-test="importacion-submit"
                                            >
                                                <Upload /> Importar
                                            </Button>
                                            <Button variant="outline" asChild>
                                                <a
                                                    href={plantilla.url()}
                                                    data-test="importacion-plantilla"
                                                >
                                                    <FileDown /> Descargar
                                                    plantilla
                                                </a>
                                            </Button>
                                        </div>
                                    </>
                                )}
                            </Form>
                        </TabsContent>

                        <TabsContent
                            value="notificaciones"
                            className="space-y-3"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="text-muted-foreground text-sm">
                                    {sinLeer > 0
                                        ? `${sinLeer} sin leer`
                                        : 'Todo leído'}
                                </span>
                                {sinLeer > 0 ? (
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={marcarTodas}
                                        data-test="importacion-marcar-todas"
                                    >
                                        <CheckCheck /> Marcar todas como
                                        leídas
                                    </Button>
                                ) : null}
                            </div>

                            {cargandoLista && importaciones.length === 0 ? (
                                <Cargando />
                            ) : null}

                            {!cargandoLista && importaciones.length === 0 ? (
                                <p className="text-muted-foreground py-6 text-center text-sm">
                                    Aún no has importado archivos.
                                </p>
                            ) : null}

                            {importaciones.length > 0 ? (
                                <ul className="divide-y rounded-md border text-sm">
                                    {importaciones.map((importacion) => (
                                        <Notificacion
                                            key={importacion.id}
                                            importacion={importacion}
                                            onVerMas={() =>
                                                setDetalle(importacion)
                                            }
                                            onMarcarLeida={() =>
                                                marcarLeida(importacion)
                                            }
                                        />
                                    ))}
                                </ul>
                            ) : null}
                        </TabsContent>
                    </Tabs>
                </DialogContent>
            </Dialog>

            <Dialog
                open={detalle !== null}
                onOpenChange={(abierto) => {
                    if (!abierto) {
                        setDetalle(null);
                    }
                }}
            >
                <DialogContent className="max-h-[80vh] overflow-y-auto sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Filas fallidas</DialogTitle>
                        <DialogDescription>
                            {detalle?.nombre_original}: {detalle?.con_error}{' '}
                            {detalle?.con_error === 1 ? 'fila' : 'filas'} no
                            se importaron. Corrígelas y vuelve a importar el
                            archivo.
                        </DialogDescription>
                    </DialogHeader>

                    {(detalle?.errores ?? []).length === 0 ? (
                        <p className="text-muted-foreground text-sm">
                            Esta importación no tiene filas fallidas.
                        </p>
                    ) : (
                        <ul
                            className="divide-y rounded-md border text-sm"
                            data-test="importacion-filas-fallidas"
                        >
                            {(detalle?.errores ?? []).map((error, indice) => (
                                <li key={indice} className="flex gap-3 p-2">
                                    <span className="text-muted-foreground w-16 shrink-0 font-medium">
                                        {error.fila > 0
                                            ? `Fila ${error.fila}`
                                            : 'General'}
                                    </span>
                                    <span>{error.mensaje}</span>
                                </li>
                            ))}
                        </ul>
                    )}

                    {detalle &&
                    detalle.con_error > (detalle.errores ?? []).length ? (
                        <p className="text-muted-foreground text-xs">
                            Se muestran las primeras{' '}
                            {(detalle.errores ?? []).length} filas fallidas.
                        </p>
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    );
}

function Notificacion({
    importacion,
    onVerMas,
    onMarcarLeida,
}: {
    importacion: Importacion;
    onVerMas: () => void;
    onMarcarLeida: () => void;
}) {
    const noLeida = esSinLeer(importacion);
    const importadas = importacion.creados + importacion.actualizados;
    const terminada =
        importacion.estado === 'completada' || importacion.estado === 'fallida';

    return (
        <li
            data-test="importacion-fila"
            className={cn(
                'flex flex-wrap items-start justify-between gap-2 p-3',
                noLeida && 'bg-sky-50 dark:bg-sky-950/30',
            )}
        >
            <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2">
                    {noLeida ? (
                        <span
                            className="size-2 shrink-0 rounded-full bg-sky-600"
                            aria-label="Sin leer"
                        />
                    ) : null}
                    <span className="truncate font-medium">
                        {importacion.nombre_original}
                    </span>
                    <Badge
                        className={`border-transparent ${ESTADOS[importacion.estado].className}`}
                    >
                        {ESTADOS[importacion.estado].label}
                    </Badge>
                </div>

                <div className="text-sm">
                    {terminada ? (
                        <>
                            Se importaron{' '}
                            <strong>{importadas}</strong>{' '}
                            {importadas === 1 ? 'fila' : 'filas'} y{' '}
                            <strong
                                className={cn(
                                    importacion.con_error > 0 &&
                                        'text-red-600 dark:text-red-400',
                                )}
                            >
                                {importacion.con_error}
                            </strong>{' '}
                            {importacion.con_error === 1
                                ? 'quedó fallida'
                                : 'quedaron fallidas'}
                            .
                        </>
                    ) : (
                        <>
                            Procesando {importacion.procesadas} de{' '}
                            {importacion.total_filas || '…'} filas.
                        </>
                    )}
                </div>

                <div className="text-muted-foreground text-xs">
                    {importacion.creados} creados ·{' '}
                    {importacion.actualizados} actualizados ·{' '}
                    {fechaHora.format(new Date(importacion.created_at))}
                </div>
            </div>

            <div className="flex items-center gap-1">
                {terminada ? (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onVerMas}
                        data-test="importacion-ver-mas"
                    >
                        Ver más
                    </Button>
                ) : null}
                {noLeida ? (
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onMarcarLeida}
                        data-test="importacion-marcar-leida"
                    >
                        Marcar como leída
                    </Button>
                ) : null}
            </div>
        </li>
    );
}
