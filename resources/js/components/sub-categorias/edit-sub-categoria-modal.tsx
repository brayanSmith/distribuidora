import { Form } from '@inertiajs/react';
import SubCategoriaFormFields from '@/components/sub-categorias/sub-categoria-form-fields';
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
import { update } from '@/routes/sub-categorias';
import type { SubCategoria } from '@/types';

type Props = {
    subCategoria: SubCategoria | null;
    categorias: { id: number; nombre_categoria: string }[];
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function EditSubCategoriaModal({
    subCategoria,
    categorias,
    open,
    onOpenChange,
}: Props) {
    if (!subCategoria) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <Form
                    key={`${subCategoria.id}-${String(open)}`}
                    {...update.form([subCategoria.id])}
                    className="space-y-6"
                    onSuccess={() => onOpenChange(false)}
                >
                    {({ errors, processing }) => (
                        <>
                            <DialogHeader>
                                <DialogTitle>Editar subcategoría</DialogTitle>
                                <DialogDescription>
                                    Actualiza los datos de la subcategoría.
                                </DialogDescription>
                            </DialogHeader>

                            <SubCategoriaFormFields
                                subCategoria={subCategoria}
                                categorias={categorias}
                                errors={errors}
                            />

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button variant="secondary">
                                        Cancelar
                                    </Button>
                                </DialogClose>

                                <Button
                                    type="submit"
                                    data-test="edit-sub-categoria-submit"
                                    disabled={processing}
                                >
                                    Guardar cambios
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
