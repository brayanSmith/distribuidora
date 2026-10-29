import { Link, http } from '@inertiajs/react';
import {
    CircleAlert,
    CircleCheck,
    Download,
    Eye,
    FileText,
    LayoutTemplate,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import type { PropsWithChildren } from 'react';
import { toast } from 'sonner';
import Combobox from '@/components/combobox';
import InputError from '@/components/input-error';
import MultiCombobox from '@/components/multi-combobox';
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
import { Spinner } from '@/components/ui/spinner';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import {
    index as catalogoIndex,
    show as catalogoShow,
    store as catalogoStore,
    vistaPrevia,
} from '@/routes/catalogo-pdf';
import {
    create as plantillaCreate,
    edit as plantillaEdit,
} from '@/routes/catalogo-plantillas';

type Precio = 'detal' | 'mayorista' | 'ninguno';

type Catalogo = {
    id: number;
    titulo: string;
    estado: 'pendiente' | 'procesando' | 'completado' | 'fallido';
    total_productos: number;
    error: string | null;
    creado: string | null;
    url: string | null;
};

type Datos = {
    categorias: { id: number; nombre_categoria: string }[];
    precios: Precio[];
    /** The designs made by blocks; none chosen is the automatic one. */
    plantillas: { id: number; nombre: string }[];
    catalogos: Catalogo[];
};

const PRECIOS: Record<Precio, string> = {
    detal: 'Detal',
    mayorista: 'Mayorista',
    ninguno: 'Sin precio',
};

/** Card sizes: the productos per row a categoría starts from. */
const TAMANOS = [
    { value: '2', label: 'Grandes' },
    { value: '3', label: 'Medianas' },
    { value: '4', label: 'Pequeñas' },
];

const enCurso = (catalogo: Catalogo | null) =>
    catalogo?.estado === 'pendiente' || catalogo?.estado === 'procesando';

async function pedir<T>(
    method: 'get' | 'post',
    url: string,
    data?: unknown,
): Promise<T> {
    const respuesta = await http.getClient().request({
        method,
        url,
        data,
        headers: { Accept: 'application/json' },
    });

    return JSON.parse(respuesta.data) as T;
}

/**
 * The product catalog as PDF: choose what goes in it (categorías, stock,
 * price, columns, cover), look at it in the browser, then generate it in the
 * background and download it when it is ready.
 */
export default function CatalogoPdfModal({ children }: PropsWithChildren) {
    const [open, setOpen] = useState(false);
    const [datos, setDatos] = useState<Datos | null>(null);
    const [categoriaIds, setCategoriaIds] = useState<string[]>([]);
    const [soloConStock, setSoloConStock] = useState(true);
    const [precio, setPrecio] = useState<Precio>('detal');
    const [columnas, setColumnas] = useState('4');
    const [presentacion, setPresentacion] = useState(true);
    const [subcategorias, setSubcategorias] = useState(true);
    const [titulo, setTitulo] = useState('');
    const [plantillaId, setPlantillaId] = useState('');
    const [generando, setGenerando] = useState<Catalogo | null>(null);
    const [enviando, setEnviando] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});

    // What the window needs is asked for only when it opens.
    useEffect(() => {
        if (!open) {
            return;
        }

        pedir<Datos>('get', catalogoIndex().url)
            .then((respuesta) => {
                setDatos(respuesta);
                setPrecio((actual) =>
                    respuesta.precios.includes(actual)
                        ? actual
                        : respuesta.precios[0],
                );
                setGenerando(
                    respuesta.catalogos.find((catalogo) => enCurso(catalogo)) ??
                        null,
                );
            })
            .catch(() => toast.error('No se pudo abrir el catálogo.'));
    }, [open]);

    // While one is being generated, ask how it goes now and then.
    useEffect(() => {
        if (!enCurso(generando)) {
            return;
        }

        const intervalo = window.setInterval(async () => {
            try {
                const { catalogo } = await pedir<{ catalogo: Catalogo }>(
                    'get',
                    catalogoShow(generando!.id).url,
                );
                setGenerando(catalogo);

                if (!enCurso(catalogo)) {
                    setDatos((actual) =>
                        actual
                            ? {
                                  ...actual,
                                  catalogos: [
                                      catalogo,
                                      ...actual.catalogos.filter(
                                          (item) => item.id !== catalogo.id,
                                      ),
                                  ].slice(0, 5),
                              }
                            : actual,
                    );

                    if (catalogo.estado === 'completado') {
                        toast.success('Catálogo listo', {
                            description: `${catalogo.total_productos} productos.`,
                        });
                    } else {
                        toast.error('No se pudo generar el catálogo.');
                    }
                }
            } catch {
                // A hiccup: it is asked again on the next turn.
            }
        }, 2000);

        return () => window.clearInterval(intervalo);
    }, [generando]);

    const opciones = {
        categoria_ids: categoriaIds.map(Number),
        solo_con_stock: soloConStock,
        precio,
        columnas: Number(columnas),
        ajustes: { presentacion },
        subcategorias,
        titulo: titulo.trim() || undefined,
        plantilla_id: plantillaId ? Number(plantillaId) : undefined,
    };

    const verVistaPrevia = () =>
        window.open(
            vistaPrevia({
                query: {
                    ...opciones,
                    solo_con_stock: soloConStock ? 1 : 0,
                    ajustes: { presentacion: presentacion ? 1 : 0 },
                    subcategorias: subcategorias ? 1 : 0,
                },
            }).url,
            '_blank',
        );

    const generar = async () => {
        setEnviando(true);
        setErrores({});

        try {
            const { catalogo } = await pedir<{ catalogo: Catalogo }>(
                'post',
                catalogoStore().url,
                opciones,
            );
            setGenerando(catalogo);
        } catch (error) {
            const cuerpo = (error as { response?: { data: string } }).response
                ?.data;

            try {
                const json = JSON.parse(cuerpo ?? '{}') as {
                    errors?: Record<string, string[]>;
                };
                setErrores(
                    Object.fromEntries(
                        Object.entries(json.errors ?? {}).map(
                            ([campo, mensajes]) => [campo, mensajes[0]],
                        ),
                    ),
                );
            } catch {
                toast.error('No se pudo generar el catálogo.');
            }
        } finally {
            setEnviando(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="max-h-[90svh] overflow-y-auto sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                        <FileText className="size-5" />
                        Catálogo de productos en PDF
                    </DialogTitle>
                    <DialogDescription>
                        Elige qué incluir y cómo se ve. Se genera en segundo
                        plano: puedes cerrar esta ventana y te avisamos cuando
                        esté listo.
                    </DialogDescription>
                </DialogHeader>

                {!datos ? (
                    <div className="flex justify-center py-10">
                        <Spinner />
                    </div>
                ) : (
                    <div className="grid gap-4" data-test="catalogo-pdf">
                        <div className="grid gap-1.5">
                            <Label htmlFor="catalogo-titulo">Título</Label>
                            <Input
                                id="catalogo-titulo"
                                value={titulo}
                                onChange={(event) =>
                                    setTitulo(event.target.value)
                                }
                                placeholder="Catálogo de productos"
                                maxLength={80}
                            />
                        </div>

                        <div className="grid gap-1.5">
                            <div className="flex items-center justify-between gap-2">
                                <Label>Diseño</Label>
                                <Link
                                    href={
                                        plantillaId
                                            ? plantillaEdit(Number(plantillaId))
                                            : plantillaCreate()
                                    }
                                    onClick={() => setOpen(false)}
                                    className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
                                    data-test="catalogo-disenar-plantilla"
                                >
                                    <LayoutTemplate className="size-3.5" />
                                    {plantillaId
                                        ? 'Editar plantilla'
                                        : 'Diseñar una plantilla'}
                                </Link>
                            </div>
                            <Combobox
                                options={[
                                    {
                                        value: '',
                                        label: 'Automático: todas las categorías',
                                    },
                                    ...datos.plantillas.map((plantilla) => ({
                                        value: String(plantilla.id),
                                        label: plantilla.nombre,
                                    })),
                                ]}
                                value={plantillaId}
                                onValueChange={setPlantillaId}
                                dataTest="catalogo-plantilla"
                            />
                            {plantillaId ? (
                                <p className="text-muted-foreground text-xs">
                                    Las categorías, la presentación y el tamaño
                                    de las tarjetas los define la plantilla.
                                </p>
                            ) : null}
                        </div>

                        <div
                            className={cn(
                                'grid gap-1.5',
                                plantillaId && 'hidden',
                            )}
                        >
                            <Label>Categorías</Label>
                            <MultiCombobox
                                options={datos.categorias.map((categoria) => ({
                                    value: String(categoria.id),
                                    label: categoria.nombre_categoria,
                                }))}
                                value={categoriaIds}
                                onValueChange={setCategoriaIds}
                                placeholder="Todas"
                                searchPlaceholder="Buscar categoría..."
                                dataTest="catalogo-categorias"
                            />
                            <InputError message={errores.categoria_ids} />
                        </div>

                        <div className="grid gap-4 sm:grid-cols-2">
                            <div className="grid gap-1.5">
                                <Label>Precio a mostrar</Label>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    value={precio}
                                    onValueChange={(valor) =>
                                        valor && setPrecio(valor as Precio)
                                    }
                                    className="justify-start"
                                    data-test="catalogo-precio"
                                >
                                    {datos.precios.map((opcion) => (
                                        <ToggleGroupItem
                                            key={opcion}
                                            value={opcion}
                                            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-3"
                                        >
                                            {PRECIOS[opcion]}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                                <InputError message={errores.precio} />
                            </div>

                            <div
                                className={cn(
                                    'grid gap-1.5',
                                    plantillaId && 'hidden',
                                )}
                            >
                                <Label>Tamaño de las tarjetas</Label>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    value={columnas}
                                    onValueChange={(valor) =>
                                        valor && setColumnas(valor)
                                    }
                                    className="justify-start"
                                    data-test="catalogo-columnas"
                                >
                                    {TAMANOS.map((tamano) => (
                                        <ToggleGroupItem
                                            key={tamano.value}
                                            value={tamano.value}
                                            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-3"
                                        >
                                            {tamano.label}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                                <p className="text-muted-foreground text-xs">
                                    Cada categoría acomoda sus columnas para no
                                    dejar huecos.
                                </p>
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-6">
                            <label className="flex items-center gap-2 text-sm">
                                <Switch
                                    checked={soloConStock}
                                    onCheckedChange={setSoloConStock}
                                />
                                Solo productos con stock
                            </label>
                            <label
                                className={cn(
                                    'flex items-center gap-2 text-sm',
                                    plantillaId && 'hidden',
                                )}
                            >
                                <Switch
                                    checked={presentacion}
                                    onCheckedChange={setPresentacion}
                                />
                                Con presentación
                            </label>
                            <label
                                className={cn(
                                    'flex items-center gap-2 text-sm',
                                    plantillaId && 'hidden',
                                )}
                            >
                                <Switch
                                    checked={subcategorias}
                                    onCheckedChange={setSubcategorias}
                                    data-test="catalogo-subcategorias"
                                />
                                Dividir por subcategorías
                            </label>
                        </div>

                        {generando ? (
                            <div
                                className={cn(
                                    'flex items-center gap-3 rounded-md border p-3 text-sm',
                                    generando.estado === 'completado' &&
                                        'border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/30',
                                    generando.estado === 'fallido' &&
                                        'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
                                )}
                                data-test="catalogo-estado"
                            >
                                {enCurso(generando) ? (
                                    <Spinner />
                                ) : generando.estado === 'completado' ? (
                                    <CircleCheck className="size-5 text-emerald-600" />
                                ) : (
                                    <CircleAlert className="size-5 text-red-600" />
                                )}
                                <div className="min-w-0 flex-1">
                                    {enCurso(generando)
                                        ? 'Generando el catálogo… puede tardar si hay muchos productos.'
                                        : generando.estado === 'completado'
                                          ? `Listo: ${generando.total_productos} productos.`
                                          : 'No se pudo generar el catálogo.'}
                                </div>
                                {generando.url ? (
                                    <Button size="sm" asChild>
                                        <a
                                            href={generando.url}
                                            data-test="catalogo-descargar"
                                        >
                                            <Download />
                                            Descargar PDF
                                        </a>
                                    </Button>
                                ) : null}
                            </div>
                        ) : null}

                        <div className="flex flex-wrap justify-end gap-2 border-t pt-4">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={verVistaPrevia}
                                data-test="catalogo-vista-previa"
                            >
                                <Eye />
                                Vista previa
                            </Button>
                            <Button
                                type="button"
                                onClick={generar}
                                loading={enviando}
                                disabled={enCurso(generando)}
                                data-test="catalogo-generar"
                            >
                                <FileText />
                                Generar PDF
                            </Button>
                        </div>

                        {datos.catalogos.filter((item) => item.url).length >
                        0 ? (
                            <div className="grid gap-1.5">
                                <Label className="text-muted-foreground text-xs">
                                    Generados recientemente
                                </Label>
                                <ul className="divide-y rounded-md border text-sm">
                                    {datos.catalogos
                                        .filter((item) => item.url)
                                        .map((catalogo) => (
                                            <li
                                                key={catalogo.id}
                                                className="flex items-center gap-2 px-3 py-2"
                                            >
                                                <FileText className="text-muted-foreground size-4" />
                                                <span className="min-w-0 flex-1 truncate">
                                                    {catalogo.titulo}
                                                    <span className="text-muted-foreground">
                                                        {' '}
                                                        ·{' '}
                                                        {
                                                            catalogo.total_productos
                                                        }{' '}
                                                        productos ·{' '}
                                                        {catalogo.creado
                                                            ? new Date(
                                                                  catalogo.creado,
                                                              ).toLocaleString(
                                                                  'es-CO',
                                                                  {
                                                                      dateStyle:
                                                                          'short',
                                                                      timeStyle:
                                                                          'short',
                                                                  },
                                                              )
                                                            : ''}
                                                    </span>
                                                </span>
                                                <Button
                                                    size="sm"
                                                    variant="ghost"
                                                    asChild
                                                >
                                                    <a
                                                        href={catalogo.url!}
                                                        aria-label="Descargar"
                                                    >
                                                        <Download />
                                                    </a>
                                                </Button>
                                            </li>
                                        ))}
                                </ul>
                            </div>
                        ) : null}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
