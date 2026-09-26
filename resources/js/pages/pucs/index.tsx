import { Head, usePage } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { useMemo, useState } from 'react';
import ActionsCell from '@/components/actions-cell';
import CreatePucModal from '@/components/create-puc-modal';
import DataTable, { type DataTableColumn } from '@/components/data-table';
import DeletePucModal from '@/components/delete-puc-modal';
import EditPucModal from '@/components/edit-puc-modal';
import Heading from '@/components/heading';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { index } from '@/routes/pucs';
import type { Puc, PucPermissions } from '@/types';

type Props = {
    pucs: Puc[];
    permissions: PucPermissions;
};

export default function PucsIndex({ pucs, permissions }: Props) {
    const [editDialogOpen, setEditDialogOpen] = useState(false);
    const [pucToEdit, setPucToEdit] = useState<Puc | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [pucToDelete, setPucToDelete] = useState<Puc | null>(null);

    const openEditDialog = (puc: Puc) => {
        setPucToEdit(puc);
        setEditDialogOpen(true);
    };

    const openDeleteDialog = (puc: Puc) => {
        setPucToDelete(puc);
        setDeleteDialogOpen(true);
    };

    const columns = useMemo<DataTableColumn<Puc>[]>(
        () => [
            {
                key: 'tipo',
                label: 'Tipo',
                getValue: (puc) => puc.tipo,
                render: (puc) => <Badge variant="secondary">{puc.tipo}</Badge>,
            },
            {
                key: 'cuenta',
                label: 'Cuenta',
                getValue: (puc) => puc.cuenta,
                render: (puc) => puc.cuenta,
            },
            {
                key: 'subcuenta',
                label: 'Subcuenta',
                getValue: (puc) => puc.subcuenta,
                render: (puc) => puc.subcuenta,
            },
            {
                key: 'concepto',
                label: 'Concepto',
                getValue: (puc) => puc.concepto,
                render: (puc) => puc.concepto,
            },
            {
                key: 'descripcion',
                label: 'Descripción',
                getValue: (puc) => puc.descripcion ?? '',
                render: (puc) => puc.descripcion ?? '—',
            },
            {
                key: 'acciones',
                label: 'Acciones',
                align: 'right',
                filter: 'none',
                render: (puc) => (
                    <ActionsCell>
                        {permissions.canUpdate ? (
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        data-test="edit-puc-button"
                                        onClick={() => openEditDialog(puc)}
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
                                        data-test="delete-puc-button"
                                        onClick={() => openDeleteDialog(puc)}
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
            <Head title="Medios de pago" />

            <div className="flex flex-col space-y-6">
                <div className="flex items-center justify-between">
                    <Heading
                        variant="small"
                        title="Medios de pago"
                        description="Administra los medios de pago (cuentas del plan único de cuentas, PUC)"
                    />

                    {permissions.canCreate ? (
                        <CreatePucModal>
                            <Button data-test="create-puc-button">
                                <Plus /> Nuevo medio de pago
                            </Button>
                        </CreatePucModal>
                    ) : null}
                </div>

                <DataTable
                    data={pucs}
                    columns={columns}
                    getRowId={(puc) => puc.id}
                    dataTestPrefix="puc"
                    searchPlaceholder="Buscar cuentas..."
                    emptyMessage="No hay cuentas registradas."
                />
            </div>

            <EditPucModal
                puc={pucToEdit}
                open={editDialogOpen}
                onOpenChange={setEditDialogOpen}
            />

            <DeletePucModal
                puc={pucToDelete}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}

PucsIndex.layout = () => ({
    breadcrumbs: [
        {
            title: 'Medios de pago',
            href: index(),
        },
    ],
});
