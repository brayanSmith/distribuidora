import { router } from '@inertiajs/react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { destroy } from '@/routes/sub-categorias';
import type { SubCategoria } from '@/types';

type Props = {
    subCategoria: SubCategoria | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function DeleteSubCategoriaModal({
    subCategoria,
    open,
    onOpenChange,
}: Props) {
    const [processing, setProcessing] = useState(false);

    const deleteSubCategoria = () => {
        if (!subCategoria) {
            return;
        }

        router.visit(destroy([subCategoria.id]), {
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Eliminar subcategoría</DialogTitle>
                    <DialogDescription>
                        ¿Estás seguro de eliminar{' '}
                        <strong>"{subCategoria?.nombre_sub_categoria}"</strong>
                        ? Solo se puede eliminar si no tiene productos
                        asociados.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary">Cancelar</Button>
                    </DialogClose>

                    <Button
                        variant="destructive"
                        data-test="delete-sub-categoria-confirm"
                        loading={processing}
                        onClick={deleteSubCategoria}
                    >
                        Eliminar subcategoría
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
