import { Head } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import ActionsCell from '@/components/actions-cell';
import CreateCategoriaModal from '@/components/categorias/create-categoria-modal';
import DataTable, { type DataTableColumn } from '@/components/data-table';
import DeleteCategoriaModal from '@/components/categorias/delete-categoria-modal';
import EditCategoriaModal from '@/components/categorias/edit-categoria-modal';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { index } from '@/routes/categorias';
import type { Categoria, CategoriaPermissions } from '@/types';

type Props = {
    categorias: Categoria[];
    permissions: CategoriaPermissions;
};

export default function CategoriasIndex({ categorias, permissions }: Props) {
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [categoriaToEdit, setCategoriaToEdit] = useState<Categoria | null>(
        null,
    );
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [categoriaToDelete, setCategoriaToDelete] =
        useState<Categoria | null>(null);

    const columns = useMemo<DataTableColumn<Categoria>[]>(
        () => [
            {
                key: 'nombre',
                label: 'Nombre',
                getValue: (categoria) => categoria.nombre_categoria,
                render: (categoria) => categoria.nombre_categoria,
            },
            {
                key: 'sub_categorias',
                label: 'Subcategorías',
                align: 'right',
                getValue: (categoria) => categoria.sub_categorias_count,
                render: (categoria) => categoria.sub_categorias_count,
            },
            {
                key: 'productos',
                label: 'Productos',
                align: 'right',
                getValue: (categoria) => categoria.productos_count,
                render: (categoria) => categoria.productos_count,
            },
            {
                key: 'acciones',
                label: 'Acciones',
                align: 'right',
                filter: 'none',
                render: (categoria) => (
                    <ActionsCell>
                        {permissions.canUpdate ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        data-test="edit-categoria-button"
                                        onClick={() => {
                                            setCategoriaToEdit(categoria);
                                            setEditDialogOpen(true);
                                        }}
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
                                        data-test="delete-categoria-button"
                                        onClick={() => {
                                            setCategoriaToDelete(categoria);
                                            setDeleteDialogOpen(true);
                                        }}
                                    >
                                        <Trash2 className="h-4 w-4" />
                                    </Button>
                                </TooltipTrigger>
                                <TooltipContent>
                                    <p>Eliminar</p>
                                </TooltipContent>
                            </Tooltip>
                        ) : null}
                    </ActionsCell>
                ),
            },
        ],
        [permissions],
    );

    return (
        <>
            <Head title="Categorías" />

            <div className="flex flex-col space-y-6">
                <div className="flex items-center justify-between">
                    <Heading
                        variant="small"
                        title="Categorías"
                        description="Administra las categorías del catálogo de productos"
                    />

                    {permissions.canCreate ? (
                        <CreateCategoriaModal>
                            <Button data-test="create-categoria-button">
                                <Plus /> Nueva categoría
                            </Button>
                        </CreateCategoriaModal>
                    ) : null}
                </div>

                <DataTable
                    data={categorias}
                    columns={columns}
                    getRowId={(categoria) => categoria.id}
                    dataTestPrefix="categoria"
                    searchPlaceholder="Buscar categorías..."
                    emptyMessage="No hay categorías registradas."
                />
            </div>

            <EditCategoriaModal
                categoria={categoriaToEdit}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
            />

            <DeleteCategoriaModal
                categoria={categoriaToDelete}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}

CategoriasIndex.layout = () => ({
    breadcrumbs: [
        {
            title: 'Categorías',
            href: index(),
        },
    ],
});
