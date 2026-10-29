import { router, useHttp } from '@inertiajs/react';
import { ArrowLeft, FileDown, FileSpreadsheet, Upload } from 'lucide-react';
import { useState } from 'react';
import BarraProgreso from '@/components/importaciones/barra-progreso';
import ImagenesAdjuntas from '@/components/importaciones/imagenes-adjuntas';
import MapeoColumnas from '@/components/importaciones/mapeo-columnas';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { plantilla, previa as rutaPrevia, store } from '@/routes/importaciones';
import type { PreviaImportacion, TipoImportacion } from '@/types';

/** What each type does with an existing record, shown under its columns. */
const AYUDA: Record<string, string> = {
    productos:
        'Si el SKU ya existe se actualiza el producto; las categorías y subcategorías que no existan se crean solas. Las imágenes que nombre la columna imagen_adjunta las subes en el siguiente paso.',
    pucs: 'Si la subcuenta ya existe se actualiza el medio de pago. El tipo es un número del 1 al 9.',
};

type Props = {
    tipos: TipoImportacion[];
    /** Props to refresh once the import is queued. */
    recargar: string[];
    onImportado: () => void;
};

/**
 * Two steps: pick what to import and the file (which is uploaded to read its
 * headers), then relate the columns of the system with those of the file —
 * names and order may differ — and queue the import.
 */
export default function ImportarArchivo({
    tipos,
    recargar,
    onImportado,
}: Props) {
    const subida = useHttp<{ tipo: string; archivo: File | null }>({
        tipo: tipos[0]?.value ?? '',
        archivo: null,
    });
    const tipoActual =
        tipos.find(({ value }) => value === subida.data.tipo) ?? tipos[0];
    const [previa, setPrevia] = useState<PreviaImportacion | null>(null);
    const [mapeo, setMapeo] = useState<Record<string, string | null>>({});
    const [enviando, setEnviando] = useState(false);
    const [subiendoImagenes, setSubiendoImagenes] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});

    const leerArchivo = () => {
        setErrores({});
        subida
            .post(rutaPrevia.url())
            .then((respuesta) => {
                const datos = respuesta as PreviaImportacion;
                setPrevia(datos);
                setMapeo(datos.sugerido);
            })
            .catch(() => {
                // The validation errors are in `subida.errors`.
            });
    };

    const faltantes = previa
        ? previa.obligatorias.filter((columna) => !mapeo[columna])
        : [];

    const importar = () => {
        if (!previa || !tipoActual) {
            return;
        }

        router.post(
            store.url(),
            {
                tipo: tipoActual.value,
                archivo_temporal: previa.archivo_temporal,
                nombre_original: previa.nombre_original,
                mapeo: Object.fromEntries(
                    Object.entries(mapeo).map(([columna, encabezado]) => [
                        columna,
                        encabezado ?? '',
                    ]),
                ),
            },
            {
                only: [...recargar, 'flash'],
                preserveScroll: true,
                preserveState: true,
                onStart: () => setEnviando(true),
                onFinish: () => setEnviando(false),
                onError: (errors) => setErrores(errors),
                onSuccess: () => {
                    setPrevia(null);
                    subida.setData('archivo', null);
                    onImportado();
                },
            },
        );
    };

    if (previa) {
        return (
            <div className="space-y-3" data-test="importacion-paso-columnas">
                <div className="flex items-center gap-2 text-sm">
                    <FileSpreadsheet className="size-4 text-emerald-600" />
                    <span className="truncate font-medium">
                        {previa.nombre_original}
                    </span>
                    <span className="text-muted-foreground">
                        · {tipoActual?.label}
                    </span>
                </div>
                <p className="text-muted-foreground text-sm">
                    Relaciona cada columna del sistema con la de tu archivo.
                    Sugerimos las que tienen el mismo nombre; revisa las demás.
                </p>

                <MapeoColumnas
                    previa={previa}
                    mapeo={mapeo}
                    onChange={(columna, encabezado) =>
                        setMapeo((actual) => ({
                            ...actual,
                            [columna]: encabezado,
                        }))
                    }
                />

                {previa.columna_imagenes && tipoActual ? (
                    <ImagenesAdjuntas
                        tipo={tipoActual.value}
                        archivoTemporal={previa.archivo_temporal}
                        columna={previa.columna_imagenes}
                        relacionada={Boolean(mapeo[previa.columna_imagenes])}
                        onSubiendoChange={setSubiendoImagenes}
                    />
                ) : null}

                {Object.values(errores).map((mensaje) => (
                    <InputError key={mensaje} message={mensaje} />
                ))}

                <div className="flex flex-wrap justify-between gap-2">
                    <Button
                        variant="outline"
                        onClick={() => setPrevia(null)}
                        data-test="importacion-volver"
                    >
                        <ArrowLeft /> Cambiar archivo
                    </Button>
                    <Button
                        onClick={importar}
                        loading={enviando}
                        disabled={faltantes.length > 0 || subiendoImagenes}
                        data-test="importacion-submit"
                    >
                        <Upload />{' '}
                        {subiendoImagenes ? 'Subiendo imágenes…' : 'Importar'}
                    </Button>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3" data-test="importacion-paso-archivo">
            <div className="grid gap-2">
                <Label>¿Qué vas a importar?</Label>
                <Select
                    value={tipoActual?.value}
                    onValueChange={(valor) => subida.setData('tipo', valor)}
                >
                    <SelectTrigger
                        className="w-full"
                        data-test="importacion-tipo"
                    >
                        <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                        {tipos.map((opcion) => (
                            <SelectItem key={opcion.value} value={opcion.value}>
                                {opcion.label}
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
                <InputError message={subida.errors.tipo} />
            </div>

            {tipoActual ? (
                <p className="text-muted-foreground text-sm">
                    Archivo CSV, TXT o Excel. Columnas esperadas:{' '}
                    {tipoActual.columnas.join(', ')}. Si tu archivo las nombra u
                    ordena distinto, en el siguiente paso las relacionas.{' '}
                    {AYUDA[tipoActual.value] ?? ''}
                </p>
            ) : null}

            <div className="grid gap-2">
                <Label htmlFor="archivo">Archivo</Label>
                <Input
                    id="archivo"
                    type="file"
                    accept=".csv,.txt,.xlsx"
                    data-test="importacion-archivo"
                    onChange={(event) =>
                        subida.setData(
                            'archivo',
                            event.target.files?.[0] ?? null,
                        )
                    }
                />
                <InputError message={subida.errors.archivo} />
            </div>

            {subida.processing ? (
                <div className="space-y-1">
                    <BarraProgreso
                        porcentaje={subida.progress?.percentage ?? null}
                        dataTest="importacion-subida-progreso"
                    />
                    <p className="text-muted-foreground text-xs">
                        Subiendo y leyendo el archivo…
                        {subida.progress?.percentage !== undefined
                            ? ` ${subida.progress.percentage}%`
                            : ''}
                    </p>
                </div>
            ) : null}

            <div className="flex flex-wrap gap-2">
                <Button
                    onClick={leerArchivo}
                    loading={subida.processing}
                    disabled={!subida.data.archivo}
                    data-test="importacion-continuar"
                >
                    Continuar
                </Button>
                <Button variant="outline" asChild>
                    <a
                        href={plantilla.url({
                            query: { tipo: tipoActual?.value },
                        })}
                        data-test="importacion-plantilla"
                    >
                        <FileDown /> Descargar plantilla
                    </a>
                </Button>
            </div>
        </div>
    );
}
