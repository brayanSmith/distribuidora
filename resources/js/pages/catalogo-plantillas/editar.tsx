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
import { Head, http, router } from '@inertiajs/react';
import {
    BookOpen,
    FileText,
    LayoutGrid,
    ListPlus,
    Plus,
    RefreshCw,
    Save,
    SeparatorHorizontal,
    Trash2,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import BloqueCatalogoEditor from '@/components/catalogo/bloque-catalogo-editor';
import EncabezadoPieEditor from '@/components/catalogo/encabezado-pie-editor';
import Combobox from '@/components/combobox';
import Heading from '@/components/heading';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    AJUSTES_POR_DEFECTO,
    BLOQUES_CATALOGO,
    bloquesIniciales,
    nuevoBloque,
} from '@/lib/catalogo-diseno';
import type {
    AjustesCatalogo,
    BloqueCatalogo,
    CategoriaOpcion,
    EmpresaCatalogo,
    PlantillaCatalogo,
    TipoBloqueCatalogo,
} from '@/lib/catalogo-diseno';
import type { RedDisponible } from '@/types';
import {
    create,
    destroy,
    edit,
    store,
    update,
    vistaPrevia as vistaPreviaRuta,
} from '@/routes/catalogo-plantillas';
import { index as productosIndex } from '@/routes/productos';

type Props = {
    plantilla: PlantillaCatalogo | null;
    plantillas: { id: number; nombre: string }[];
    categorias: CategoriaOpcion[];
    /** What the header and footer show when the design does not say. */
    empresa: EmpresaCatalogo;
    redesDisponibles: RedDisponible[];
};

const AGREGAR: { tipo: TipoBloqueCatalogo; icono: typeof Plus }[] = [
    { tipo: 'categoria', icono: LayoutGrid },
    { tipo: 'texto', icono: FileText },
    { tipo: 'salto', icono: SeparatorHorizontal },
    { tipo: 'portada', icono: BookOpen },
];

const TAMANOS = [
    { value: '2', label: 'Grandes' },
    { value: '3', label: 'Medianas' },
    { value: '4', label: 'Pequeñas' },
];

/**
 * The catalog designer: the blocks it prints (cover, categorías, texts,
 * page breaks) dragged into order and set up one by one, next to a preview
 * with real productos. Saved as a template to pick when generating.
 */
export default function CatalogoPlantillaEditar({
    plantilla,
    plantillas,
    categorias,
    empresa,
    redesDisponibles,
}: Props) {
    const [nombre, setNombre] = useState(plantilla?.nombre ?? '');
    const [columnas, setColumnas] = useState(String(plantilla?.columnas ?? 4));
    const [encabezado, setEncabezado] = useState(plantilla?.encabezado ?? true);
    const [pie, setPie] = useState(plantilla?.pie ?? true);
    const [ajustes, setAjustes] = useState<AjustesCatalogo>(
        plantilla?.ajustes ?? AJUSTES_POR_DEFECTO,
    );
    const [bloques, setBloques] = useState<BloqueCatalogo[]>(
        () => plantilla?.bloques ?? bloquesIniciales(categorias),
    );
    const [errores, setErrores] = useState<Record<string, string>>({});
    const [guardando, setGuardando] = useState(false);
    const [conPrecios, setConPrecios] = useState(true);
    const [vistaPrevia, setVistaPrevia] = useState<string | null>(null);
    const [generando, setGenerando] = useState(false);

    const datos = {
        nombre: nombre.trim(),
        columnas: Number(columnas),
        encabezado,
        pie,
        ajustes,
        bloques,
    };
    const estado = JSON.stringify(datos);
    const [guardado, setGuardado] = useState(() => (plantilla ? estado : null));
    const [previsualizado, setPrevisualizado] = useState<string | null>(null);
    const hayCambios = estado !== guardado;
    const vistaDesactualizada =
        previsualizado !== JSON.stringify({ estado, conPrecios });

    const sensores = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
        useSensor(KeyboardSensor, {
            coordinateGetter: sortableKeyboardCoordinates,
        }),
    );

    // Made on demand (and once on opening), not on every change.
    const actualizarVistaPrevia = async () => {
        setGenerando(true);

        try {
            const respuesta = await http.getClient().request({
                method: 'post',
                url: vistaPreviaRuta().url,
                data: {
                    ...datos,
                    precio: conPrecios ? 'detal' : 'ninguno',
                },
                headers: { Accept: 'text/html' },
            });
            setVistaPrevia(respuesta.data as string);
            setPrevisualizado(JSON.stringify({ estado, conPrecios }));
        } catch {
            toast.error(
                'No se pudo armar la vista previa. Revisa que cada categoría tenga una elegida.',
            );
        } finally {
            setGenerando(false);
        }
    };

    useEffect(() => {
        void actualizarVistaPrevia();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

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

    const cambiarBloque = (cambiado: BloqueCatalogo) =>
        setBloques((actuales) =>
            actuales.map((bloque) =>
                bloque.id === cambiado.id ? cambiado : bloque,
            ),
        );

    const duplicar = (bloque: BloqueCatalogo) =>
        setBloques((actuales) => {
            const indice = actuales.findIndex((item) => item.id === bloque.id);
            const copia = { ...bloque, id: nuevoBloque(bloque.tipo).id };

            return [
                ...actuales.slice(0, indice + 1),
                copia,
                ...actuales.slice(indice + 1),
            ];
        });

    const quitar = (bloque: BloqueCatalogo) =>
        setBloques((actuales) =>
            actuales.filter((item) => item.id !== bloque.id),
        );

    const usadas = new Set(
        bloques
            .filter((bloque) => bloque.tipo === 'categoria')
            .map((bloque) => bloque.categoria_id),
    );
    const faltantes = categorias.filter(
        (categoria) => !usadas.has(categoria.id),
    );

    const guardar = () => {
        const opciones = {
            preserveScroll: true,
            onStart: () => setGuardando(true),
            onFinish: () => setGuardando(false),
            onSuccess: () => {
                setGuardado(estado);
                setErrores({});
            },
            onError: (errors: Record<string, string>) => {
                setErrores(errors);
                toast.error(
                    Object.keys(errors).some((campo) =>
                        campo.startsWith('bloques'),
                    )
                        ? 'Hay bloques incompletos: revisa que cada categoría tenga una elegida.'
                        : 'Revisa los datos de la plantilla.',
                );
            },
        };

        if (plantilla) {
            router.put(update(plantilla.id).url, datos, opciones);
        } else {
            router.post(store().url, datos, opciones);
        }
    };

    const eliminar = () => {
        if (
            plantilla &&
            window.confirm(
                `¿Eliminar la plantilla “${plantilla.nombre}”? Los catálogos ya generados no se pierden.`,
            )
        ) {
            router.delete(destroy(plantilla.id).url);
        }
    };

    return (
        <>
            <Head title={plantilla ? plantilla.nombre : 'Nueva plantilla'} />

            <div className="flex flex-col space-y-6">
                <div className="flex flex-wrap items-start justify-between gap-3">
                    <Heading
                        variant="small"
                        title={
                            plantilla
                                ? 'Plantilla de catálogo'
                                : 'Nueva plantilla de catálogo'
                        }
                        description="Arma el catálogo por bloques: arrástralos para ordenarlos, ocúltalos o ábrelos para ajustarlos."
                    />
                    <div className="flex flex-wrap items-center gap-2">
                        {plantillas.length > 0 ? (
                            <Combobox
                                options={[
                                    {
                                        value: 'nueva',
                                        label: '+ Nueva plantilla',
                                    },
                                    ...plantillas.map((item) => ({
                                        value: String(item.id),
                                        label: item.nombre,
                                    })),
                                ]}
                                value={
                                    plantilla ? String(plantilla.id) : 'nueva'
                                }
                                onValueChange={(valor) =>
                                    router.visit(
                                        valor === 'nueva'
                                            ? create()
                                            : edit(Number(valor)),
                                    )
                                }
                                className="w-56"
                                dataTest="catalogo-plantilla-selector"
                            />
                        ) : null}
                        {plantilla ? (
                            <Button
                                type="button"
                                variant="outline"
                                onClick={eliminar}
                                className="text-red-600"
                            >
                                <Trash2 />
                                Eliminar
                            </Button>
                        ) : null}
                        <Button
                            type="button"
                            onClick={guardar}
                            loading={guardando}
                            disabled={!hayCambios}
                            data-test="catalogo-plantilla-guardar"
                        >
                            <Save />
                            {hayCambios ? 'Guardar plantilla' : 'Guardada'}
                        </Button>
                    </div>
                </div>

                <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
                    <div className="grid content-start gap-4">
                        <div className="bg-card grid gap-4 rounded-md border p-4">
                            <div className="grid gap-1.5">
                                <Label htmlFor="plantilla-nombre" required>
                                    Nombre
                                </Label>
                                <Input
                                    id="plantilla-nombre"
                                    value={nombre}
                                    onChange={(event) =>
                                        setNombre(event.target.value)
                                    }
                                    placeholder="Ej.: Catálogo mayoristas"
                                    maxLength={80}
                                    data-test="catalogo-plantilla-nombre"
                                />
                                <InputError message={errores.nombre} />
                            </div>
                            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
                                <div className="grid gap-1.5">
                                    <Label>Tamaño de las tarjetas</Label>
                                    <ToggleGroup
                                        type="single"
                                        variant="outline"
                                        size="sm"
                                        value={columnas}
                                        onValueChange={(valor) =>
                                            valor && setColumnas(valor)
                                        }
                                        className="justify-start"
                                    >
                                        {TAMANOS.map((tamano) => (
                                            <ToggleGroupItem
                                                key={tamano.value}
                                                value={tamano.value}
                                                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-3 text-xs"
                                            >
                                                {tamano.label}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                </div>
                            </div>
                        </div>

                        <EncabezadoPieEditor
                            encabezado={encabezado}
                            pie={pie}
                            ajustes={ajustes}
                            empresa={empresa}
                            redesDisponibles={redesDisponibles}
                            onEncabezado={setEncabezado}
                            onPie={setPie}
                            onAjustes={setAjustes}
                        />

                        <div className="grid gap-2">
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
                                        <BloqueCatalogoEditor
                                            key={bloque.id}
                                            bloque={bloque}
                                            categorias={categorias}
                                            onChange={cambiarBloque}
                                            onDuplicate={() => duplicar(bloque)}
                                            onRemove={() => quitar(bloque)}
                                        />
                                    ))}
                                </SortableContext>
                            </DndContext>

                            {bloques.length === 0 ? (
                                <p className="text-muted-foreground rounded-md border border-dashed py-8 text-center text-sm">
                                    La plantilla no tiene bloques. Agrega uno
                                    abajo.
                                </p>
                            ) : null}
                        </div>

                        <div className="flex flex-wrap gap-2">
                            {AGREGAR.map(({ tipo, icono: Icono }) => (
                                <Button
                                    key={tipo}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() =>
                                        setBloques((actuales) => [
                                            ...actuales,
                                            nuevoBloque(tipo),
                                        ])
                                    }
                                    data-test={`catalogo-agregar-${tipo}`}
                                >
                                    <Icono />
                                    {BLOQUES_CATALOGO[tipo].label}
                                </Button>
                            ))}
                            {faltantes.length > 0 ? (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    onClick={() =>
                                        setBloques((actuales) => [
                                            ...actuales,
                                            ...faltantes.map((categoria) =>
                                                nuevoBloque(
                                                    'categoria',
                                                    categoria.id,
                                                ),
                                            ),
                                        ])
                                    }
                                >
                                    <ListPlus />
                                    Agregar las {faltantes.length} categorías
                                    que faltan
                                </Button>
                            ) : null}
                        </div>
                    </div>

                    <div className="grid content-start gap-3 lg:sticky lg:top-20">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-sm font-medium">
                                Vista previa
                            </span>
                            <div className="flex items-center gap-3">
                                <label className="flex items-center gap-2 text-sm">
                                    <Switch
                                        checked={conPrecios}
                                        onCheckedChange={setConPrecios}
                                    />
                                    Con precios
                                </label>
                                <Button
                                    type="button"
                                    size="sm"
                                    variant={
                                        vistaDesactualizada
                                            ? 'default'
                                            : 'outline'
                                    }
                                    loading={generando}
                                    onClick={() => void actualizarVistaPrevia()}
                                    data-test="catalogo-actualizar-vista"
                                >
                                    {generando ? null : <RefreshCw />}
                                    Actualizar vista previa
                                </Button>
                            </div>
                        </div>
                        {vistaDesactualizada && !generando && vistaPrevia ? (
                            <p className="-mt-1 rounded-md border border-amber-200 bg-amber-50 px-2 py-1 text-xs text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                                Hiciste cambios: dale a “Actualizar vista
                                previa” para verlos.
                            </p>
                        ) : null}
                        <div className="bg-muted h-[75svh] overflow-hidden rounded-md border">
                            {vistaPrevia ? (
                                <iframe
                                    srcDoc={vistaPrevia}
                                    title="Vista previa del catálogo"
                                    className="h-full w-full"
                                />
                            ) : null}
                        </div>
                        <p className="text-muted-foreground text-xs">
                            Muestra hasta 8 productos por categoría. Los saltos
                            de página se ven como una línea punteada; en el PDF
                            el encabezado y el pie se repiten en cada página.
                        </p>
                    </div>
                </div>
            </div>
        </>
    );
}

CatalogoPlantillaEditar.layout = () => ({
    breadcrumbs: [
        { title: 'Productos', href: productosIndex() },
        { title: 'Plantillas de catálogo', href: create() },
    ],
});
