import { Form } from '@inertiajs/react';
import InputError from '@/components/input-error';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { update } from '@/routes/categorias';
import type { Categoria } from '@/types';

type Props = {
    categoria: Categoria | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function EditCategoriaModal({
    categoria,
    open,
    onOpenChange,
}: Props) {
    if (!categoria) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <Form
                    key={String(open)}
                    {...update.form([categoria.id])}
                    className="space-y-6"
                    onSuccess={() => onOpenChange(false)}
                >
                    {({ errors, processing }) => (
                        <>
                            <DialogHeader>
                                <DialogTitle>Editar categoría</DialogTitle>
                                <DialogDescription>
                                    Actualiza el nombre de la categoría.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-2">
                                <Label
                                    required
                                    htmlFor="edit_nombre_categoria"
                                >
                                    Nombre
                                </Label>
                                <Input
                                    id="edit_nombre_categoria"
                                    name="nombre_categoria"
                                    data-test="edit-categoria-nombre"
                                    defaultValue={categoria.nombre_categoria}
                                    required
                                />
                                <InputError message={errors.nombre_categoria} />
                            </div>

                            <DialogFooter className="gap-2">
                                <DialogClose asChild>
                                    <Button variant="secondary">
                                        Cancelar
                                    </Button>
                                </DialogClose>

                                <Button
                                    type="submit"
                                    data-test="edit-categoria-submit"
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
