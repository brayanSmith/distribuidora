import { Head } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import ActionsCell from '@/components/actions-cell';
import CreateSubCategoriaModal from '@/components/sub-categorias/create-sub-categoria-modal';
import DataTable, { type DataTableColumn } from '@/components/data-table';
import DeleteSubCategoriaModal from '@/components/sub-categorias/delete-sub-categoria-modal';
import EditSubCategoriaModal from '@/components/sub-categorias/edit-sub-categoria-modal';
import Heading from '@/components/heading';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { index } from '@/routes/sub-categorias';
import type { CategoriaPermissions, SubCategoria } from '@/types';

type Props = {
    subCategorias: SubCategoria[];
    categorias: { id: number; nombre_categoria: string }[];
    permissions: CategoriaPermissions;
};

export default function SubCategoriasIndex({
    subCategorias,
    categorias,
    permissions,
}: Props) {
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [subCategoriaToEdit, setSubCategoriaToEdit] =
        useState<SubCategoria | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [subCategoriaToDelete, setSubCategoriaToDelete] =
        useState<SubCategoria | null>(null);

    const columns = useMemo<DataTableColumn<SubCategoria>[]>(
        () => [
            {
                key: 'nombre',
                label: 'Nombre',
                getValue: (subCategoria) => subCategoria.nombre_sub_categoria,
                render: (subCategoria) => subCategoria.nombre_sub_categoria,
            },
            {
                key: 'categoria',
                label: 'Categoría',
                getValue: (subCategoria) =>
                    subCategoria.categoria?.nombre_categoria ?? '',
                render: (subCategoria) =>
                    subCategoria.categoria?.nombre_categoria ?? '—',
            },
            {
                key: 'productos',
                label: 'Productos',
                align: 'right',
                getValue: (subCategoria) => subCategoria.productos_count,
                render: (subCategoria) => subCategoria.productos_count,
            },
            {
                key: 'acciones',
                label: 'Acciones',
                align: 'right',
                filter: 'none',
                render: (subCategoria) => (
                    <ActionsCell>
                        {permissions.canUpdate ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        data-test="edit-sub-categoria-button"
                                        onClick={() => {
                                            setSubCategoriaToEdit(subCategoria);
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
                                        data-test="delete-sub-categoria-button"
                                        onClick={() => {
                                            setSubCategoriaToDelete(
                                                subCategoria,
                                            );
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
            <Head title="Subcategorías" />

            <div className="flex flex-col space-y-6">
                <div className="flex items-center justify-between">
                    <Heading
                        variant="small"
                        title="Subcategorías"
                        description="Administra las subcategorías de cada categoría"
                    />

                    {permissions.canCreate ? (
                        <CreateSubCategoriaModal categorias={categorias}>
                            <Button data-test="create-sub-categoria-button">
                                <Plus /> Nueva subcategoría
                            </Button>
                        </CreateSubCategoriaModal>
                    ) : null}
                </div>

                <DataTable
                    data={subCategorias}
                    columns={columns}
                    getRowId={(subCategoria) => subCategoria.id}
                    dataTestPrefix="sub-categoria"
                    searchPlaceholder="Buscar subcategorías..."
                    emptyMessage="No hay subcategorías registradas."
                />
            </div>

            <EditSubCategoriaModal
                subCategoria={subCategoriaToEdit}
                categorias={categorias}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
            />

            <DeleteSubCategoriaModal
                subCategoria={subCategoriaToDelete}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}

SubCategoriasIndex.layout = () => ({
    breadcrumbs: [
        {
            title: 'Subcategorías',
            href: index(),
        },
    ],
});
