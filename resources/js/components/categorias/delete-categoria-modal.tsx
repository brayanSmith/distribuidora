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
import { destroy } from '@/routes/categorias';
import type { Categoria } from '@/types';

type Props = {
    categoria: Categoria | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function DeleteCategoriaModal({
    categoria,
    open,
    onOpenChange,
}: Props) {
    const [processing, setProcessing] = useState(false);

    const deleteCategoria = () => {
        if (!categoria) {
            return;
        }

        router.visit(destroy([categoria.id]), {
            onStart: () => setProcessing(true),
            onFinish: () => setProcessing(false),
            onSuccess: () => onOpenChange(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Eliminar categoría</DialogTitle>
                    <DialogDescription>
                        ¿Estás seguro de eliminar{' '}
                        <strong>"{categoria?.nombre_categoria}"</strong>? Solo
                        se puede eliminar si no tiene subcategorías ni productos
                        asociados.
                    </DialogDescription>
                </DialogHeader>

                <DialogFooter className="gap-2">
                    <DialogClose asChild>
                        <Button variant="secondary">Cancelar</Button>
                    </DialogClose>

                    <Button
                        variant="destructive"
                        data-test="delete-categoria-confirm"
                        loading={processing}
                        onClick={deleteCategoria}
                    >
                        Eliminar categoría
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
