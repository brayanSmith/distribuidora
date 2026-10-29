import { http } from '@inertiajs/react';
import {
    CircleAlert,
    CircleCheck,
    ImagePlus,
    LoaderCircle,
} from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { cn } from '@/lib/utils';
import { imagenes as rutaImagenes } from '@/routes/importaciones';

/** Images uploaded at the same time; the rest wait their turn. */
const SUBIDAS_A_LA_VEZ = 3;

type Imagen = {
    nombre: string;
    estado: 'pendiente' | 'subiendo' | 'lista' | 'error';
    mensaje?: string;
};

type Props = {
    tipo: string;
    archivoTemporal: string;
    /** The column of the system that names the images. */
    columna: string;
    /** Whether that column is related with one of the file. */
    relacionada: boolean;
    onSubiendoChange: (subiendo: boolean) => void;
};

/** The first validation message of a failed upload, or a generic one. */
function mensajeDeError(error: unknown): string {
    const datos = (error as { response?: { data?: string } }).response?.data;

    try {
        const json = JSON.parse(datos ?? '') as {
            message?: string;
            errors?: Record<string, string[]>;
        };

        return (
            Object.values(json.errors ?? {})[0]?.[0] ??
            json.message ??
            'No se pudo subir.'
        );
    } catch {
        return 'No se pudo subir.';
    }
}

/**
 * Uploads at once the images the rows of the file name in their image column
 * (with their extension, several separated by commas), so they don't have to
 * be added producto by producto. Each image is matched by its file name when
 * the import runs; uploading a name again replaces it.
 */
export default function ImagenesAdjuntas({
    tipo,
    archivoTemporal,
    columna,
    relacionada,
    onSubiendoChange,
}: Props) {
    const [imagenes, setImagenes] = useState<Imagen[]>([]);
    const [cola, setCola] = useState<File[]>([]);
    const [enCurso, setEnCurso] = useState(0);

    const actualizar = (nombre: string, cambios: Partial<Imagen>) =>
        setImagenes((actuales) =>
            actuales.map((imagen) =>
                imagen.nombre === nombre ? { ...imagen, ...cambios } : imagen,
            ),
        );

    const onDrop = useCallback((archivos: File[]) => {
        const nombres = new Set(
            archivos.map((archivo) => archivo.name.toLowerCase()),
        );

        setImagenes((actuales) => [
            ...actuales.filter(
                (imagen) => !nombres.has(imagen.nombre.toLowerCase()),
            ),
            ...archivos.map((archivo): Imagen => ({
                nombre: archivo.name,
                estado: 'pendiente',
            })),
        ]);
        setCola((actual) => [...actual, ...archivos]);
    }, []);

    // Takes the next images of the queue while there is room.
    useEffect(() => {
        if (cola.length === 0 || enCurso >= SUBIDAS_A_LA_VEZ) {
            return;
        }

        const [archivo, ...resto] = cola;
        setCola(resto);
        setEnCurso((actual) => actual + 1);
        actualizar(archivo.name, { estado: 'subiendo' });

        const datos = new FormData();
        datos.append('tipo', tipo);
        datos.append('archivo_temporal', archivoTemporal);
        datos.append('imagen', archivo);

        http.getClient()
            .request({
                method: 'post',
                url: rutaImagenes.url(),
                data: datos,
                headers: {
                    Accept: 'application/json',
                    'X-Requested-With': 'XMLHttpRequest',
                },
            })
            .then(() => actualizar(archivo.name, { estado: 'lista' }))
            .catch((error: unknown) =>
                actualizar(archivo.name, {
                    estado: 'error',
                    mensaje: mensajeDeError(error),
                }),
            )
            .finally(() => setEnCurso((actual) => actual - 1));
    }, [cola, enCurso, tipo, archivoTemporal]);

    const subiendo = cola.length > 0 || enCurso > 0;

    useEffect(() => onSubiendoChange(subiendo), [subiendo, onSubiendoChange]);

    // Going back to another file leaves nothing uploading.
    useEffect(() => () => onSubiendoChange(false), [onSubiendoChange]);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        accept: { 'image/*': [] },
        multiple: true,
    });

    const listas = imagenes.filter(({ estado }) => estado === 'lista').length;
    const conError = imagenes.filter(({ estado }) => estado === 'error').length;

    return (
        <div className="space-y-2" data-test="importacion-imagenes">
            <div>
                <p className="text-sm font-medium">Importar imágenes</p>
                <p className="text-muted-foreground text-xs">
                    Sube de una vez las imágenes que nombra la columna{' '}
                    <span className="font-medium">{columna}</span>: el nombre
                    del archivo con su extensión (por ejemplo{' '}
                    <span className="font-mono">SKU-001.jpg</span>) y, si son
                    varias, separadas por coma. La primera queda de portada y
                    reemplazan las que ya tenga el producto.
                </p>
            </div>

            <div
                {...getRootProps()}
                className={cn(
                    'cursor-pointer rounded-md border-2 border-dashed transition-colors',
                    isDragActive
                        ? 'border-primary bg-primary/5'
                        : 'border-input hover:bg-accent/50',
                )}
            >
                <input
                    {...getInputProps()}
                    data-test="importacion-imagenes-input"
                />
                <div className="text-muted-foreground flex flex-col items-center justify-center gap-1 p-4 text-center">
                    <ImagePlus className="size-6" />
                    <span className="text-sm">
                        Arrastra las imágenes o haz clic para elegirlas
                    </span>
                </div>
            </div>

            {imagenes.length > 0 && !relacionada ? (
                <p className="text-destructive flex items-center gap-1 text-xs">
                    <CircleAlert className="size-3" />
                    Relaciona la columna {columna} arriba para que las imágenes
                    se usen.
                </p>
            ) : null}

            {imagenes.length > 0 ? (
                <div className="space-y-1">
                    <p className="text-muted-foreground text-xs">
                        {listas} de {imagenes.length}{' '}
                        {imagenes.length === 1
                            ? 'imagen subida'
                            : 'imágenes subidas'}
                        {conError > 0 ? ` · ${conError} con error` : ''}
                    </p>
                    <ul className="max-h-40 divide-y overflow-y-auto rounded-md border text-xs">
                        {imagenes.map((imagen) => (
                            <li
                                key={imagen.nombre}
                                className="flex items-center gap-2 px-2 py-1"
                            >
                                {imagen.estado === 'lista' ? (
                                    <CircleCheck className="size-3.5 shrink-0 text-emerald-600" />
                                ) : imagen.estado === 'error' ? (
                                    <CircleAlert className="text-destructive size-3.5 shrink-0" />
                                ) : (
                                    <LoaderCircle className="text-muted-foreground size-3.5 shrink-0 animate-spin" />
                                )}
                                <span className="truncate">
                                    {imagen.nombre}
                                </span>
                                {imagen.mensaje ? (
                                    <span className="text-destructive ml-auto shrink-0">
                                        {imagen.mensaje}
                                    </span>
                                ) : null}
                            </li>
                        ))}
                    </ul>
                </div>
            ) : null}
        </div>
    );
}
