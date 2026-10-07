import { Head } from '@inertiajs/react';
import { ArrowLeftRight, Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import ActionsCell from '@/components/actions-cell';
import CreateProductoModal from '@/components/productos/create-producto-modal';
import CreateTrasladoModal from '@/components/traslados/create-traslado-modal';
import DataTable, { type DataTableColumn } from '@/components/data-table';
import DeleteProductoModal from '@/components/productos/delete-producto-modal';
import EditProductoModal from '@/components/productos/edit-producto-modal';
import Heading from '@/components/heading';
import ProductoDetalleModal from '@/components/productos/producto-detalle-modal';
import RestoreButton from '@/components/restore-button';
import TrashToggle from '@/components/trash-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { useTiposPrecio } from '@/hooks/use-tipos-precio';
import { cn } from '@/lib/utils';
import { index, restore } from '@/routes/productos';
import type {
    Bodega,
    CategoriaProducto,
    MarcaOption,
    Producto,
    ProductoPermissions,
} from '@/types';

type CategoriaTab = CategoriaProducto | 'TODOS';

const CATEGORIA_TABS: { value: CategoriaTab; label: string }[] = [
    { value: 'TODOS', label: 'Todos' },
    { value: 'LLANTA', label: 'Llantas' },
    { value: 'RIN', label: 'Rines' },
    { value: 'SERVICIO', label: 'Servicios' },
    { value: 'OTRO', label: 'Otros' },
];

type Props = {
    productos: Producto[];
    eliminados: boolean;
    bodegas: Bodega[];
    marcas: MarcaOption[];
    permissions: ProductoPermissions;
};

type Accessor = {
    label: string;
    width: number;
    align?: 'right';
    color?: string;
    /** Long text wraps to the column's width instead of being cut. */
    wrap?: boolean;
    get: (producto: Producto) => string | number;
};

const SIN_TIPO = 'Sin tipo';
const SIN_RIN = 'Sin rin';

const tipoDe = (producto: Producto): string =>
    producto.tipo_vehiculo ?? SIN_TIPO;
const rinDe = (producto: Producto): string => producto.rin ?? SIN_RIN;

/** Each row renders many controls, so bigger pages make the table sluggish. */
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const PAGE_SIZE_MAX = 100;

/** A tipo de vehículo / rin of the filters, with how many productos it has. */
type VehiculoOption = { value: string; count: number };

const DEFAULT_BODEGA_WIDTH = 110;
/** Fits the edit / delete / traslado buttons on one line. */
const ACCIONES_WIDTH = 140;

const STATIC_COLUMN_ORDER = [
    'id',
    'producto',
    'stock_total',
    'pendiente',
    'almacen_p',
    'costo',
    'detal',
    'mayorista',
    'sin_instalacion',
] as const;

const STATIC_ACCESSORS: Record<string, Accessor> = {
    id: {
        label: 'ID',
        width: 70,
        get: (p) => p.id,
    },
    producto: {
        label: 'Producto',
        width: 220,
        wrap: true,
        get: (p) => p.concatenar_codigo_nombre ?? p.referencia_producto ?? '',
    },
    stock_total: {
        label: 'Stock total',
        width: 100,
        align: 'right',
        get: (p) => p.stock_total ?? 0,
    },
    pendiente: {
        label: 'Pendiente',
        width: 100,
        align: 'right',
        get: (p) => p.pendiente ?? 0,
    },
    almacen_p: {
        label: 'Almacen_P',
        width: 150,
        get: (p) => p.proveedor_pendiente ?? '',
    },
    costo: {
        label: 'Costo',
        width: 110,
        align: 'right',
        color: 'text-blue-600 dark:text-blue-400',
        get: (p) => Number(p.costo_producto ?? 0),
    },
    detal: {
        label: 'Detal',
        width: 110,
        align: 'right',
        color: 'text-emerald-600 dark:text-emerald-400',
        get: (p) => Number(p.valor_detal ?? 0),
    },
    mayorista: {
        label: 'Mayorista',
        width: 110,
        align: 'right',
        color: 'text-amber-600 dark:text-amber-400',
        get: (p) => Number(p.valor_mayorista ?? 0),
    },
    sin_instalacion: {
        label: 'Sin Instalación',
        width: 130,
        align: 'right',
        color: 'text-red-600 dark:text-red-400',
        get: (p) => Number(p.valor_sin_instalacion ?? 0),
    },
};

/** Servicios (and any producto marked as not inventariable) never carry stock. */
function esSinStock(producto: Producto): boolean {
    return producto.categoria === 'SERVICIO' || !producto.inventariable;
}

function renderCellValue(key: string, accessor: Accessor, producto: Producto) {
    const value = accessor.get(producto);
    const esColumnaDeStock =
        key === 'pendiente' || key === 'stock_total' || key.startsWith('bodega_');

    if (esColumnaDeStock && esSinStock(producto)) {
        return '—';
    }

    if (key === 'pendiente') {
        return value ? <Badge variant="secondary">{value}</Badge> : 0;
    }

    if (key === 'stock_total' || key.startsWith('bodega_')) {
        const hasStock = Number(value) > 0;

        return (
            <Badge
                className={cn(
                    'border-transparent',
                    hasStock
                        ? 'bg-emerald-100 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-950 dark:text-emerald-400'
                        : 'bg-red-100 text-red-700 hover:bg-red-100 dark:bg-red-950 dark:text-red-400',
                )}
            >
                {value}
            </Badge>
        );
    }

    if (value === '' || value === null || value === undefined) {
        return '—';
    }

    if (typeof value === 'string') {
        return (
            <span
                className={cn(
                    'block',
                    accessor.wrap ? 'break-words' : 'truncate',
                )}
                title={value}
            >
                {value}
            </span>
        );
    }

    return value;
}

export default function ProductosIndex({
    productos,
    eliminados,
    bodegas,
    marcas,
    permissions,
}: Props) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [productoToDelete, setProductoToDelete] = useState<Producto | null>(
        null,
    );
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [productoToEdit, setProductoToEdit] = useState<Producto | null>(null);
    const [previewImage, setPreviewImage] = useState<string | null>(null);
    const [viewDialogOpen, setViewDialogOpen] = useState(false);
    const [productoToView, setProductoToView] = useState<Producto | null>(null);
    const [trasladoProductoId, setTrasladoProductoId] = useState<number | null>(
        null,
    );
    // The filters and the tabs are remembered for the tab's session (the trash is its own list).
    const storageKey = `productos${eliminados ? ':papelera' : ''}`;
    // A saved pick whose productos are gone would leave an empty table.
    const [tipoSel, setTipoSel] = usePersistedState<string>(
        `filtro:${storageKey}:tipo`,
        '',
        {
            scope: 'session',
            merge: (stored) =>
                productos.some((producto) => tipoDe(producto) === stored)
                    ? stored
                    : '',
        },
    );
    const [rinesSel, setRinesSel] = usePersistedState<string[]>(
        `filtro:${storageKey}:rines`,
        [],
        {
            scope: 'session',
            merge: (stored) =>
                Array.isArray(stored)
                    ? stored.filter((rin) =>
                          productos.some((producto) => rinDe(producto) === rin),
                      )
                    : [],
        },
    );
    const [categoriaTab, setCategoriaTab] = usePersistedState<CategoriaTab>(
        `filtro:${storageKey}:categoria`,
        'TODOS',
        {
            scope: 'session',
            merge: (stored) =>
                CATEGORIA_TABS.some((tab) => tab.value === stored)
                    ? stored
                    : 'TODOS',
        },
    );

    const openDeleteDialog = (producto: Producto) => {
        setProductoToDelete(producto);
        setDeleteDialogOpen(true);
    };

    const openEditDialog = (producto: Producto) => {
        setProductoToEdit(producto);
        setEditDialogOpen(true);
    };

    const openViewDialog = (producto: Producto) => {
        setProductoToView(producto);
        setViewDialogOpen(true);
    };

    const { puedeCosto, puedeDetal, puedeMayorista } = useTiposPrecio();

    const columns = useMemo<DataTableColumn<Producto>[]>(() => {
        const accessors: [string, Accessor][] = [
            ...STATIC_COLUMN_ORDER.filter(
                (key) =>
                    (key !== 'costo' || puedeCosto) &&
                    (key !== 'detal' || puedeDetal) &&
                    (key !== 'mayorista' || puedeMayorista) &&
                    (key !== 'stock_total' || permissions.canViewStockTotal) &&
                    (key !== 'pendiente' || permissions.canViewPendiente) &&
                    (key !== 'almacen_p' || permissions.canViewAlmacenP) &&
                    (key !== 'sin_instalacion' ||
                        permissions.canViewSinInstalacion),
            ).map((key): [string, Accessor] => [key, STATIC_ACCESSORS[key]]),
            ...(permissions.canViewStockBodegas
                ? bodegas.map((bodega): [string, Accessor] => [
                      `bodega_${bodega.id}`,
                      {
                          label: bodega.nombre_bodega,
                          width: DEFAULT_BODEGA_WIDTH,
                          align: 'right',
                          get: (p) => p.stock_por_bodega?.[bodega.id] ?? 0,
                      },
                  ])
                : []),
        ];

        return [
            {
                key: 'acciones',
                label: 'Acciones',
                align: 'right',
                filter: 'none',
                width: ACCIONES_WIDTH,
                render: (producto) =>
                    eliminados ? (
                        permissions.canRestore ? (
                            <div className="flex justify-end">
                                <RestoreButton
                                    action={restore([producto.id])}
                                    nombre={`el producto ${producto.concatenar_codigo_nombre ?? producto.referencia_producto ?? producto.id}`}
                                    dataTest="restore-producto-button"
                                />
                            </div>
                        ) : null
                    ) : (
                        <ActionsCell>
                            {permissions.canUpdate ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            data-test="edit-producto-button"
                                            onClick={() =>
                                                openEditDialog(producto)
                                            }
                                        >
                                            <Pencil className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Editar</p>
                                    </TooltipContent>
                                </Tooltip>
                            ) : null}

                            {permissions.canDelete ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            data-test="delete-producto-button"
                                            onClick={() =>
                                                openDeleteDialog(producto)
                                            }
                                        >
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Eliminar</p>
                                    </TooltipContent>
                                </Tooltip>
                            ) : null}

                            {permissions.canCreateTraslado &&
                            !esSinStock(producto) ? (
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            data-test="traslado-producto-button"
                                            onClick={() =>
                                                setTrasladoProductoId(
                                                    producto.id,
                                                )
                                            }
                                        >
                                            <ArrowLeftRight className="h-4 w-4" />
                                        </Button>
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Traslado</p>
                                    </TooltipContent>
                                </Tooltip>
                            ) : null}
                        </ActionsCell>
                    ),
            },
            {
                key: 'imagen',
                label: 'Imagen',
                filter: 'none',
                hideable: true,
                width: 70,
                render: (producto) =>
                    producto.imagen_producto_url ? (
                        <button
                            type="button"
                            onClick={(event) => {
                                event.stopPropagation();
                                setPreviewImage(producto.imagen_producto_url);
                            }}
                            data-test="producto-imagen-preview"
                            className="cursor-zoom-in"
                        >
                            <img
                                src={producto.imagen_producto_url}
                                alt=""
                                loading="lazy"
                                className="h-10 w-10 rounded-md border object-cover transition hover:opacity-80"
                            />
                        </button>
                    ) : (
                        <div className="text-muted-foreground flex h-10 w-10 items-center justify-center rounded-md border text-xs">
                            —
                        </div>
                    ),
            },
            ...accessors.map(([key, accessor]): DataTableColumn<Producto> => ({
                key,
                label: accessor.label,
                align: accessor.align,
                width: accessor.width,
                wrap: accessor.wrap,
                getValue: accessor.get,
                render: (producto) => (
                    <span className={accessor.color}>
                        {renderCellValue(key, accessor, producto)}
                    </span>
                ),
            })),
        ];
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        bodegas,
        eliminados,
        permissions,
        puedeCosto,
        puedeDetal,
        puedeMayorista,
    ]);

    const categoryFilteredProductos = useMemo(() => {
        if (categoriaTab === 'TODOS') {
            return productos;
        }

        return productos.filter(
            (producto) => producto.categoria === categoriaTab,
        );
    }, [productos, categoriaTab]);

    const categoriaCounts = useMemo(() => {
        const counts: Record<string, number> = { TODOS: productos.length };

        productos.forEach((producto) => {
            const categoria = producto.categoria ?? 'TODOS';
            counts[categoria] = (counts[categoria] ?? 0) + 1;
        });

        return counts;
    }, [productos]);

    const handleCategoriaTabChange = (value: string) => {
        setCategoriaTab(value as CategoriaTab);
        setTipoSel('');
        setRinesSel([]);
    };

    // Tipos de vehículo of the tab, with how many productos each one has
    // among the picked rines.
    const tipoOptions = useMemo<VehiculoOption[]>(() => {
        const counts = new Map<string, number>();

        categoryFilteredProductos.forEach((producto) => {
            const tipo = tipoDe(producto);
            const cuenta =
                rinesSel.length === 0 || rinesSel.includes(rinDe(producto));

            counts.set(tipo, (counts.get(tipo) ?? 0) + (cuenta ? 1 : 0));
        });

        return Array.from(counts.entries())
            .sort(([a], [b]) => a.localeCompare(b, 'es'))
            .map(([value, count]) => ({ value, count }));
    }, [categoryFilteredProductos, rinesSel]);

    // Rines only of the picked tipo de vehículo (all of them while none is picked).
    const rinOptions = useMemo<VehiculoOption[]>(() => {
        const counts = new Map<string, number>();

        categoryFilteredProductos
            .filter((producto) => !tipoSel || tipoDe(producto) === tipoSel)
            .forEach((producto) => {
                const rin = rinDe(producto);

                counts.set(rin, (counts.get(rin) ?? 0) + 1);
            });

        return Array.from(counts.entries())
            .sort(([a], [b]) => a.localeCompare(b, 'es', { numeric: true }))
            .map(([value, count]) => ({ value, count }));
    }, [categoryFilteredProductos, tipoSel]);

    // Changing the tipo drops the picked rines that don't belong to it.
    const handleTipoChange = (tipo: string) => {
        const permitidos = new Set(
            categoryFilteredProductos
                .filter((producto) => !tipo || tipoDe(producto) === tipo)
                .map(rinDe),
        );

        setTipoSel(tipo);
        setRinesSel((actuales) =>
            actuales.filter((rin) => permitidos.has(rin)),
        );
    };

    const toggleRin = (rin: string) =>
        setRinesSel((actuales) =>
            actuales.includes(rin)
                ? actuales.filter((item) => item !== rin)
                : [...actuales, rin],
        );

    const filteredProductos = useMemo(
        () =>
            categoryFilteredProductos.filter(
                (producto) =>
                    (!tipoSel || tipoDe(producto) === tipoSel) &&
                    (rinesSel.length === 0 ||
                        rinesSel.includes(rinDe(producto))),
            ),
        [categoryFilteredProductos, tipoSel, rinesSel],
    );
    const hayFiltrosDeVehiculo = tipoSel !== '' || rinesSel.length > 0;
    // Servicios never carry stock, so they can't be picked for a traslado.
    const productosTrasladables = useMemo(
        () => productos.filter((producto) => !esSinStock(producto)),
        [productos],
    );
    return (
        <>
            <Head title="Productos" />

            <div className="flex flex-col space-y-6">
                <div className="flex items-center justify-between">
                    <Heading
                        variant="small"
                        title="Productos"
                        description="Administra el catálogo de productos"
                    />

                    <div className="flex items-center gap-3">
                        <TrashToggle
                            eliminados={eliminados}
                            visible={permissions.canViewDeleted}
                        />

                        {permissions.canCreate && !eliminados ? (
                            <CreateProductoModal marcas={marcas}>
                                <Button data-test="create-producto-button">
                                    <Plus /> Nuevo producto
                                </Button>
                            </CreateProductoModal>
                        ) : null}
                    </div>
                </div>

                <Tabs
                    value={categoriaTab}
                    onValueChange={handleCategoriaTabChange}
                >
                    <TabsList data-test="productos-categoria-tabs">
                        {CATEGORIA_TABS.map((tab) => (
                            <TabsTrigger
                                key={tab.value}
                                value={tab.value}
                                data-test={`productos-categoria-tab-${tab.value}`}
                            >
                                {tab.label}
                                <span className="text-muted-foreground ml-1 text-xs">
                                    {categoriaCounts[tab.value] ?? 0}
                                </span>
                            </TabsTrigger>
                        ))}
                    </TabsList>
                </Tabs>

                <div className="grid gap-3">
                    <div className="flex flex-wrap items-end gap-3">
                        <div className="grid w-full gap-1 sm:w-56">
                            <Label className="text-muted-foreground text-xs">
                                Tipo de vehículo
                            </Label>
                            <Select
                                value={tipoSel === '' ? 'ALL' : tipoSel}
                                onValueChange={(value) =>
                                    handleTipoChange(
                                        value === 'ALL' ? '' : value,
                                    )
                                }
                            >
                                <SelectTrigger
                                    className="w-full"
                                    data-test="productos-filtro-tipo"
                                >
                                    <SelectValue placeholder="Todos" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todos</SelectItem>
                                    {tipoOptions.map((option) => (
                                        <SelectItem
                                            key={option.value}
                                            value={option.value}
                                        >
                                            {option.value}
                                            <span className="text-muted-foreground ml-2 text-xs">
                                                {option.count}
                                            </span>
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {hayFiltrosDeVehiculo ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                    setTipoSel('');
                                    setRinesSel([]);
                                }}
                                data-test="productos-filtro-limpiar"
                            >
                                <X className="size-4" />
                                Limpiar
                            </Button>
                        ) : null}
                    </div>

                    <div className="grid gap-1">
                        <Label className="text-muted-foreground text-xs">
                            Rin
                        </Label>
                        {rinOptions.length === 0 ? (
                            <p className="text-muted-foreground text-sm">
                                No hay rines.
                            </p>
                        ) : (
                            <div
                                className="flex max-h-28 flex-wrap gap-2 overflow-y-auto"
                                data-test="productos-filtro-rin"
                            >
                                {rinOptions.map((option) => (
                                    <label
                                        key={option.value}
                                        className={cn(
                                            'hover:bg-accent flex cursor-pointer items-center gap-2 rounded-md border px-2 py-1 text-sm',
                                            rinesSel.includes(option.value) &&
                                                'bg-accent',
                                        )}
                                    >
                                        <Checkbox
                                            checked={rinesSel.includes(
                                                option.value,
                                            )}
                                            onCheckedChange={() =>
                                                toggleRin(option.value)
                                            }
                                            data-test={`productos-filtro-rin-${option.value}`}
                                        />
                                        {option.value}
                                    </label>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <DataTable
                    data={filteredProductos}
                    columns={columns}
                    getRowId={(producto) => producto.id}
                    dataTestPrefix="productos"
                    searchPlaceholder="Buscar productos..."
                    emptyMessage={
                        productos.length === 0
                            ? 'No hay productos registrados.'
                            : 'Ningún producto coincide con los filtros.'
                    }
                    noResultsMessage="Ningún producto coincide con los filtros."
                    onRowClick={openViewDialog}
                    pageSize={50}
                    pageSizeOptions={PAGE_SIZE_OPTIONS}
                    // Always grouped by tipo de vehículo; with rines picked,
                    // each group gets rin as a nested sub-grouping.
                    groupBy={tipoDe}
                    groupLabel={(tipo) => tipo}
                    groupBySecondary={
                        rinesSel.length > 0 ? rinDe : undefined
                    }
                    groupSecondaryLabel={(rin) =>
                        rin === SIN_RIN ? rin : `Rin ${rin}`
                    }
                    pageSizeMax={PAGE_SIZE_MAX}
                    pageResetKey={`${categoriaTab}|${tipoSel}|${rinesSel.join(',')}`}
                />
            </div>
            <DeleteProductoModal
                producto={productoToDelete}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />

            <EditProductoModal
                marcas={marcas}
                producto={productoToEdit}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
            />

            {permissions.canCreateTraslado && !eliminados ? (
                <CreateTrasladoModal
                    productos={productosTrasladables}
                    bodegas={bodegas}
                    productoInicialId={trasladoProductoId ?? undefined}
                    open={trasladoProductoId !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setTrasladoProductoId(null);
                        }
                    }}
                />
            ) : null}

            <Dialog
                open={previewImage !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPreviewImage(null);
                    }
                }}
            >
                <DialogContent className="sm:max-w-xl">
                    <DialogHeader>
                        <DialogTitle>Imagen del producto</DialogTitle>
                    </DialogHeader>

                    {previewImage ? (
                        <img
                            src={previewImage}
                            alt=""
                            className="max-h-[70vh] w-full rounded-md border object-contain"
                        />
                    ) : null}
                </DialogContent>
            </Dialog>

            <ProductoDetalleModal
                producto={productoToView}
                bodegas={bodegas}
                open={viewDialogOpen}
                onOpenChange={setViewDialogOpen}
            />
        </>
    );
}

ProductosIndex.layout = () => ({
    breadcrumbs: [
        {
            title: 'Productos',
            href: index(),
        },
    ],
});
