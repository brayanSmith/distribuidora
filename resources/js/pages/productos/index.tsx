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
    CategoriaOption,
    MarcaOption,
    Producto,
    ProductoPermissions,
} from '@/types';

/** `TODOS`, `SIN_CATEGORIA` or the id of a categoria. */
type CategoriaTab = string;

const TAB_TODOS = 'TODOS';
const TAB_SIN_CATEGORIA = 'SIN_CATEGORIA';

type Props = {
    productos: Producto[];
    eliminados: boolean;
    bodegas: Bodega[];
    marcas: MarcaOption[];
    categorias: CategoriaOption[];
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

const SIN_CATEGORIA = 'Sin categoría';
const SIN_SUB_CATEGORIA = 'Sin subcategoría';

const categoriaDe = (producto: Producto): string =>
    producto.categoria ?? SIN_CATEGORIA;
const subCategoriaDe = (producto: Producto): string =>
    producto.sub_categoria ?? SIN_SUB_CATEGORIA;

/** Each row renders many controls, so bigger pages make the table sluggish. */
const PAGE_SIZE_OPTIONS = [25, 50, 100];
const PAGE_SIZE_MAX = 100;

/** A subcategoria of the filter, with how many productos it has. */
type SubCategoriaFilterOption = { value: string; count: number };

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
};

/** Servicios (any producto marked as not inventariable) never carry stock. */
function esSinStock(producto: Producto): boolean {
    return !producto.inventariable;
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
    categorias,
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
    const categoriaTabs = useMemo<{ value: CategoriaTab; label: string }[]>(
        () => [
            { value: TAB_TODOS, label: 'Todos' },
            ...categorias.map((categoria) => ({
                value: String(categoria.id),
                label: categoria.nombre_categoria,
            })),
            { value: TAB_SIN_CATEGORIA, label: SIN_CATEGORIA },
        ],
        [categorias],
    );
    const [subCategoriaSel, setSubCategoriaSel] = usePersistedState<string>(
        `filtro:${storageKey}:sub-categoria`,
        '',
        {
            scope: 'session',
            merge: (stored) =>
                productos.some(
                    (producto) => subCategoriaDe(producto) === stored,
                )
                    ? stored
                    : '',
        },
    );
    const [categoriaTab, setCategoriaTab] = usePersistedState<CategoriaTab>(
        `filtro:${storageKey}:categoria`,
        TAB_TODOS,
        {
            scope: 'session',
            merge: (stored) =>
                categoriaTabs.some((tab) => tab.value === stored)
                    ? stored
                    : TAB_TODOS,
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
                    (key !== 'almacen_p' || permissions.canViewAlmacenP),
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
        if (categoriaTab === TAB_TODOS) {
            return productos;
        }

        return productos.filter((producto) =>
            categoriaTab === TAB_SIN_CATEGORIA
                ? producto.categoria_id === null
                : String(producto.categoria_id) === categoriaTab,
        );
    }, [productos, categoriaTab]);

    const categoriaCounts = useMemo(() => {
        const counts: Record<string, number> = {
            [TAB_TODOS]: productos.length,
        };

        productos.forEach((producto) => {
            const tab =
                producto.categoria_id === null
                    ? TAB_SIN_CATEGORIA
                    : String(producto.categoria_id);
            counts[tab] = (counts[tab] ?? 0) + 1;
        });

        return counts;
    }, [productos]);

    const handleCategoriaTabChange = (value: string) => {
        setCategoriaTab(value);
        setSubCategoriaSel('');
    };

    // Subcategorias of the tab, with how many productos each one has.
    const subCategoriaOptions = useMemo<SubCategoriaFilterOption[]>(() => {
        const counts = new Map<string, number>();

        categoryFilteredProductos.forEach((producto) => {
            const subCategoria = subCategoriaDe(producto);

            counts.set(subCategoria, (counts.get(subCategoria) ?? 0) + 1);
        });

        return Array.from(counts.entries())
            .sort(([a], [b]) => a.localeCompare(b, 'es'))
            .map(([value, count]) => ({ value, count }));
    }, [categoryFilteredProductos]);

    const filteredProductos = useMemo(
        () =>
            categoryFilteredProductos.filter(
                (producto) =>
                    !subCategoriaSel ||
                    subCategoriaDe(producto) === subCategoriaSel,
            ),
        [categoryFilteredProductos, subCategoriaSel],
    );
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
                            <CreateProductoModal
                                marcas={marcas}
                                categorias={categorias}
                            >
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
                        {categoriaTabs.map((tab) => (
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
                                Subcategoría
                            </Label>
                            <Select
                                value={
                                    subCategoriaSel === ''
                                        ? 'ALL'
                                        : subCategoriaSel
                                }
                                onValueChange={(value) =>
                                    setSubCategoriaSel(
                                        value === 'ALL' ? '' : value,
                                    )
                                }
                            >
                                <SelectTrigger
                                    className="w-full"
                                    data-test="productos-filtro-sub-categoria"
                                >
                                    <SelectValue placeholder="Todas" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="ALL">Todas</SelectItem>
                                    {subCategoriaOptions.map((option) => (
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

                        {subCategoriaSel !== '' ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => setSubCategoriaSel('')}
                                data-test="productos-filtro-limpiar"
                            >
                                <X className="size-4" />
                                Limpiar
                            </Button>
                        ) : null}
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
                    // Grouped by categoria, or by subcategoria inside a categoria tab.
                    groupBy={
                        categoriaTab === TAB_TODOS ? categoriaDe : subCategoriaDe
                    }
                    groupLabel={(grupo) => grupo}
                    pageSizeMax={PAGE_SIZE_MAX}
                    pageResetKey={`${categoriaTab}|${subCategoriaSel}`}
                />
            </div>
            <DeleteProductoModal
                producto={productoToDelete}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />

            <EditProductoModal
                marcas={marcas}
                categorias={categorias}
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
