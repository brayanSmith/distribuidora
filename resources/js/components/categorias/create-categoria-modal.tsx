import { Form } from '@inertiajs/react';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
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
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { store } from '@/routes/categorias';

export default function CreateCategoriaModal({ children }: PropsWithChildren) {
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
                                <DialogTitle>Nueva categoría</DialogTitle>
                                <DialogDescription>
                                    Crea una nueva categoría para el catálogo de
                                    productos.
                                </DialogDescription>
                            </DialogHeader>

                            <div className="grid gap-2">
                                <Label required htmlFor="nombre_categoria">
                                    Nombre
                                </Label>
                                <Input
                                    id="nombre_categoria"
                                    name="nombre_categoria"
                                    data-test="create-categoria-nombre"
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
                                    data-test="create-categoria-submit"
                                    disabled={processing}
                                >
                                    Crear categoría
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
