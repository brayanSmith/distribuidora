import { Form } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
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
    DialogTrigger,
} from '@/components/ui/dialog';
import { store } from '@/routes/sub-categorias';

type Props = PropsWithChildren<{
    categorias: { id: number; nombre_categoria: string }[];
}>;

export default function CreateSubCategoriaModal({
    categorias,
    children,
}: Props) {
    const [open, setOpen] = useState(false);

    return (
        <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent>
                <Form
                    key={String(open)}
                    {...store.form()}
                    className="space-y-6"
                    onSuccess={() => setOpen(false)}
                >
                    {({ errors, processing }) => (
                        <>
                            <DialogHeader>
                                <DialogTitle>Nueva subcategoría</DialogTitle>
                                <DialogDescription>
                                    Crea una subcategoría dentro de una
                                    categoría.
                                </DialogDescription>
                            </DialogHeader>

                            <SubCategoriaFormFields
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
                                    data-test="create-sub-categoria-submit"
                                    disabled={processing}
                                >
                                    Crear subcategoría
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
