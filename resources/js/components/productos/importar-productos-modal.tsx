import { Form, router, usePage, usePoll } from '@inertiajs/react';
import { FileDown, Upload } from 'lucide-react';
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
import { plantilla, store } from '@/routes/importaciones';
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

/**
 * Imports productos from a CSV, TXT or Excel file. The file is processed in the
 * background, so this dialog can be closed and the user can keep working; the
 * list below follows the progress while it is open.
 */
export default function ImportarProductosModal({ children }: PropsWithChildren) {
    const [open, setOpen] = useState(false);
    const [verErrores, setVerErrores] = useState<number | null>(null);
    const [cargandoLista, setCargandoLista] = useState(false);
    const importaciones =
        (usePage().props.importaciones as Importacion[] | undefined) ?? [];
    const hayEnCurso = importaciones.some(
        (importacion) =>
            importacion.estado === 'pendiente' ||
            importacion.estado === 'procesando',
    );

    const { start, stop } = usePoll(
        3000,
        { only: ['importaciones'] },
        { autoStart: false },
    );

    // The list is only requested while the dialog is open.
    useEffect(() => {
        if (open) {
            router.reload({
                only: ['importaciones'],
                onStart: () => setCargandoLista(true),
                onFinish: () => setCargandoLista(false),
            });
        }
    }, [open]);

    useEffect(() => {
        if (open && hayEnCurso) {
            start();
        } else {
            stop();
        }
    }, [open, hayEnCurso, start, stop]);

    const conErrores = importaciones.find(({ id }) => id === verErrores);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
                <DialogHeader>
                    <DialogTitle>Importar productos</DialogTitle>
                    <DialogDescription>
                        Carga productos desde un archivo CSV, TXT o Excel. Se
                        procesa en segundo plano: puedes cerrar esta ventana y
                        seguir trabajando.
                    </DialogDescription>
                </DialogHeader>

                <p className="text-muted-foreground text-sm">
                    Columnas: {COLUMNAS}. Si el SKU ya existe se actualiza el
                    producto; las categorías y subcategorías que no existan se
                    crean solas.
                </p>

                <Form
                    {...store.form()}
                    className="space-y-3"
                    resetOnSuccess
                    options={{ only: ['importaciones', 'flash'] }}
                >
                    {({ errors, processing }) => (
                        <>
                            <div className="grid gap-2">
                                <Label htmlFor="archivo">Archivo</Label>
                                <Input
                                    id="archivo"
                                    name="archivo"
                                    type="file"
                                    accept=".csv,.txt,.xlsx"
                                    data-test="importacion-archivo"
                                    required
                                />
                                <InputError message={errors.archivo} />
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
                                        <FileDown /> Descargar plantilla
                                    </a>
                                </Button>
                            </div>
                        </>
                    )}
                </Form>

                {cargandoLista && importaciones.length === 0 ? <Cargando /> : null}

                {importaciones.length > 0 ? (
                    <div className="space-y-2">
                        <div className="text-sm font-semibold">
                            Importaciones recientes
                        </div>
                        <ul className="divide-y rounded-md border text-sm">
                            {importaciones.map((importacion) => (
                                <li
                                    key={importacion.id}
                                    data-test="importacion-fila"
                                    className="flex flex-wrap items-center justify-between gap-2 p-2"
                                >
                                    <div className="min-w-0">
                                        <div className="truncate font-medium">
                                            {importacion.nombre_original}
                                        </div>
                                        <div className="text-muted-foreground text-xs">
                                            {importacion.procesadas} /{' '}
                                            {importacion.total_filas} filas ·{' '}
                                            {importacion.creados} creados ·{' '}
                                            {importacion.actualizados}{' '}
                                            actualizados
                                            {importacion.user
                                                ? ` · ${importacion.user.name}`
                                                : ''}
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        {importacion.con_error > 0 ||
                                        importacion.estado === 'fallida' ? (
                                            <Button
                                                variant="link"
                                                size="sm"
                                                data-test="importacion-ver-errores"
                                                onClick={() =>
                                                    setVerErrores(
                                                        verErrores ===
                                                            importacion.id
                                                            ? null
                                                            : importacion.id,
                                                    )
                                                }
                                            >
                                                {importacion.con_error} con
                                                error
                                            </Button>
                                        ) : null}
                                        <Badge
                                            className={`border-transparent ${ESTADOS[importacion.estado].className}`}
                                        >
                                            {ESTADOS[importacion.estado].label}
                                        </Badge>
                                    </div>
                                </li>
                            ))}
                        </ul>

                        {conErrores ? (
                            <ul className="bg-muted/50 max-h-48 space-y-1 overflow-y-auto rounded-md border p-3 text-sm">
                                {(conErrores.errores ?? []).map(
                                    (error, indice) => (
                                        <li key={indice}>
                                            <span className="font-medium">
                                                {error.fila > 0
                                                    ? `Fila ${error.fila}:`
                                                    : 'Error:'}
                                            </span>{' '}
                                            {error.mensaje}
                                        </li>
                                    ),
                                )}
                            </ul>
                        ) : null}
                    </div>
                ) : null}
            </DialogContent>
        </Dialog>
    );
}
