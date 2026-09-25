import { Head } from '@inertiajs/react';
import {
    ArrowLeftRight,
    ChevronDown,
    ChevronRight,
    PanelLeftClose,
    PanelLeftOpen,
    Pencil,
    Plus,
    Trash2,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import ActionsCell from '@/components/actions-cell';
import CreateProductoModal from '@/components/create-producto-modal';
import CreateTrasladoModal from '@/components/create-traslado-modal';
import DataTable, { type DataTableColumn } from '@/components/data-table';
import DeleteProductoModal from '@/components/delete-producto-modal';
import EditProductoModal from '@/components/edit-producto-modal';
import Heading from '@/components/heading';
import ProductoDetalleModal from '@/components/producto-detalle-modal';
import RestoreButton from '@/components/restore-button';
import TrashToggle from '@/components/trash-toggle';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    usePersistedSet,
    usePersistedState,
} from '@/hooks/use-persisted-state';
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
    get: (producto: Producto) => string | number;
};

const SIN_TIPO = 'Sin tipo';
const SIN_RIN = 'Sin rin';

const DEFAULT_BODEGA_WIDTH = 110;
/** Fits the edit / delete / traslado buttons on one line. */
const ACCIONES_WIDTH = 140;

const STATIC_COLUMN_ORDER = [
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
    producto: {
        label: 'Producto',
        width: 220,
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

function renderCellValue(key: string, accessor: Accessor, producto: Producto) {
    const value = accessor.get(producto);

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
            <span className="block truncate" title={value}>
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
    // The side filter and the tabs are remembered for the tab's session (the trash is its own list).
    const storageKey = `productos${eliminados ? ':papelera' : ''}`;
    const [activeGroup, setActiveGroup] = usePersistedState<{
        tipoVehiculo: string;
        rin?: string;
    } | null>(`filtro:${storageKey}:grupo`, null, {
        scope: 'session',
        // A saved group whose productos are gone would show an empty table.
        merge: (stored) =>
            stored &&
            productos.some(
                (producto) =>
                    (producto.tipo_vehiculo ?? SIN_TIPO) ===
                        stored.tipoVehiculo &&
                    (!stored.rin || (producto.rin ?? SIN_RIN) === stored.rin),
            )
                ? stored
                : null,
    });
    // Tipos de vehículo whose rines are open in the side filter (all closed at first).
    const [expandedGroups, setExpandedGroups] = usePersistedSet<string>(
        `filtro:${storageKey}:abiertos`,
        () => new Set(),
        'session',
    );
    const toggleGroup = (tipo: string) =>
        setExpandedGroups((current) => {
            const next = new Set(current);

            if (!next.delete(tipo)) {
                next.add(tipo);
            }

            return next;
        });
    // Phones only: whether the tipo de vehículo / rin filter is open (closed at first).
    const [filtroAbierto, setFiltroAbierto] = useState(false);
    // Larger screens: the filter shrinks to a slim strip to give the table the width.
    const [filtroCompacto, setFiltroCompacto] = usePersistedState(
        'filtro:productos:compacto',
        false,
    );
    const toggleFiltroCompacto = () => setFiltroCompacto((current) => !current);
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

                            {permissions.canCreateTraslado ? (
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
        setActiveGroup(null);
    };

    const groupTree = useMemo(() => {
        const tipos = new Map<string, Map<string, number>>();

        categoryFilteredProductos.forEach((producto) => {
            const tipo = producto.tipo_vehiculo ?? SIN_TIPO;
            const rin = producto.rin ?? SIN_RIN;

            if (!tipos.has(tipo)) {
                tipos.set(tipo, new Map());
            }

            const rines = tipos.get(tipo)!;
            rines.set(rin, (rines.get(rin) ?? 0) + 1);
        });

        return Array.from(tipos.entries())
            .map(([tipo, rines]) => ({
                tipo,
                count: Array.from(rines.values()).reduce((a, b) => a + b, 0),
                rines: Array.from(rines.entries())
                    .map(([rin, count]) => ({ rin, count }))
                    .sort((a, b) =>
                        a.rin.localeCompare(b.rin, 'es', { numeric: true }),
                    ),
            }))
            .sort((a, b) => a.tipo.localeCompare(b.tipo, 'es'));
    }, [categoryFilteredProductos]);

    const groupFilteredProductos = useMemo(() => {
        if (!activeGroup) {
            return categoryFilteredProductos;
        }

        return categoryFilteredProductos.filter((producto) => {
            if (
                (producto.tipo_vehiculo ?? SIN_TIPO) !==
                activeGroup.tipoVehiculo
            ) {
                return false;
            }

            return (
                !activeGroup.rin ||
                (producto.rin ?? SIN_RIN) === activeGroup.rin
            );
        });
    }, [categoryFilteredProductos, activeGroup]);

    const activeGroupLabel = activeGroup
        ? `${activeGroup.tipoVehiculo}${activeGroup.rin ? ` · ${activeGroup.rin}` : ''}`
        : null;

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

                <div className="flex flex-col gap-1 md:flex-row">
                    <aside
                        className={cn(
                            'w-full shrink-0 self-start rounded-lg border p-3 text-sm',
                            filtroCompacto ? 'md:w-12 md:p-2' : 'md:w-56',
                        )}
                    >
                        <div className="flex items-center justify-between gap-2">
                            {/* On phones the filter is a collapsible bar above the table. */}
                            <button
                                type="button"
                                onClick={() =>
                                    setFiltroAbierto((current) => !current)
                                }
                                aria-expanded={filtroAbierto}
                                data-test="productos-filtro-toggle"
                                className={cn(
                                    'flex flex-1 items-center justify-between gap-2 text-left font-semibold md:pointer-events-none',
                                    filtroCompacto && 'md:hidden',
                                )}
                            >
                                <span>Tipo de vehículo / Rin</span>
                                <span className="flex items-center gap-2 md:hidden">
                                    {activeGroupLabel ? (
                                        <span className="text-muted-foreground text-xs font-normal">
                                            {activeGroupLabel}
                                        </span>
                                    ) : null}
                                    <ChevronDown
                                        className={cn(
                                            'size-4 transition-transform',
                                            !filtroAbierto && '-rotate-90',
                                        )}
                                    />
                                </span>
                            </button>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                onClick={toggleFiltroCompacto}
                                aria-pressed={filtroCompacto}
                                title={
                                    filtroCompacto
                                        ? `Expandir filtro${activeGroupLabel ? ` (${activeGroupLabel})` : ''}`
                                        : 'Compactar filtro'
                                }
                                data-test="productos-filtro-compactar"
                                className="relative hidden size-7 shrink-0 md:inline-flex"
                            >
                                {filtroCompacto ? (
                                    <PanelLeftOpen className="size-4" />
                                ) : (
                                    <PanelLeftClose className="size-4" />
                                )}
                                {filtroCompacto && activeGroup ? (
                                    <span className="bg-primary absolute top-0.5 right-0.5 size-2 rounded-full" />
                                ) : null}
                            </Button>
                        </div>
                        <div
                            className={cn(
                                'mt-2 space-y-1',
                                filtroCompacto ? 'md:hidden' : 'md:block',
                                !filtroAbierto && 'hidden',
                            )}
                        >
                            <button
                                type="button"
                                onClick={() => setActiveGroup(null)}
                                data-test="productos-group-all"
                                className={cn(
                                    'hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1 text-left',
                                    !activeGroup &&
                                        'bg-accent text-accent-foreground',
                                )}
                            >
                                <span>Todos</span>
                                <span className="text-muted-foreground text-xs">
                                    {categoryFilteredProductos.length}
                                </span>
                            </button>

                            <div className="max-h-[60vh] overflow-y-auto pr-1">
                                {groupTree.map((group) => (
                                    <div key={group.tipo} className="mt-1">
                                        <div className="flex items-center">
                                            <button
                                                type="button"
                                                onClick={() =>
                                                    toggleGroup(group.tipo)
                                                }
                                                aria-label={`${expandedGroups.has(group.tipo) ? 'Contraer' : 'Expandir'} ${group.tipo}`}
                                                data-test={`productos-group-toggle-${group.tipo}`}
                                                className="text-muted-foreground hover:bg-accent shrink-0 rounded p-1"
                                            >
                                                {expandedGroups.has(
                                                    group.tipo,
                                                ) ? (
                                                    <ChevronDown className="size-4" />
                                                ) : (
                                                    <ChevronRight className="size-4" />
                                                )}
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => {
                                                    setActiveGroup({
                                                        tipoVehiculo:
                                                            group.tipo,
                                                    });
                                                    setExpandedGroups(
                                                        (current) =>
                                                            new Set(
                                                                current,
                                                            ).add(group.tipo),
                                                    );
                                                }}
                                                data-test={`productos-group-tipo-${group.tipo}`}
                                                className={cn(
                                                    'hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1 text-left font-medium',
                                                    activeGroup?.tipoVehiculo ===
                                                        group.tipo &&
                                                        !activeGroup?.rin &&
                                                        'bg-accent text-accent-foreground',
                                                )}
                                            >
                                                <span>{group.tipo}</span>
                                                <span className="text-muted-foreground text-xs">
                                                    {group.count}
                                                </span>
                                            </button>
                                        </div>

                                        {expandedGroups.has(group.tipo) ? (
                                            <div className="ml-3 border-l pl-2">
                                                {group.rines.map((rin) => (
                                                    <button
                                                        key={rin.rin}
                                                        type="button"
                                                        onClick={() =>
                                                            setActiveGroup({
                                                                tipoVehiculo:
                                                                    group.tipo,
                                                                rin: rin.rin,
                                                            })
                                                        }
                                                        data-test={`productos-group-rin-${group.tipo}-${rin.rin}`}
                                                        className={cn(
                                                            'text-muted-foreground hover:bg-accent flex w-full items-center justify-between rounded px-2 py-1 text-left',
                                                            activeGroup?.tipoVehiculo ===
                                                                group.tipo &&
                                                                activeGroup?.rin ===
                                                                    rin.rin &&
                                                                'bg-accent text-accent-foreground',
                                                        )}
                                                    >
                                                        <span>{rin.rin}</span>
                                                        <span className="text-xs">
                                                            {rin.count}
                                                        </span>
                                                    </button>
                                                ))}
                                            </div>
                                        ) : null}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </aside>

                    <div className="min-w-0 flex-1">
                        <DataTable
                            data={groupFilteredProductos}
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
                            pageResetKey={`${categoriaTab}|${activeGroup?.tipoVehiculo ?? ''}|${activeGroup?.rin ?? ''}`}
                        />
                    </div>
                </div>
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
                    productos={productos}
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
