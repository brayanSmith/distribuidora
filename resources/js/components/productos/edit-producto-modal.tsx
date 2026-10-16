import { Form } from '@inertiajs/react';
import ProductoFormFields from '@/components/productos/producto-form-fields';
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
import { update } from '@/routes/productos';
import type { CategoriaOption, MarcaOption, Producto } from '@/types';

type Props = {
    marcas: MarcaOption[];
    categorias: CategoriaOption[];
    producto: Producto | null;
    open: boolean;
    onOpenChange: (open: boolean) => void;
};

export default function EditProductoModal({
    marcas,
    categorias,
    producto,
    open,
    onOpenChange,
}: Props) {
    if (!producto) {
        return null;
    }

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[90vh] w-full overflow-y-auto sm:max-w-3xl lg:max-w-5xl">
                <Form
                    key={`${producto.id}-${String(open)}`}
                    {...update.form([producto.id])}
                    className="space-y-6"
                    onSuccess={() => onOpenChange(false)}
                >
                    {({ errors, processing }) => (
                        <>
                            <DialogHeader>
                                <DialogTitle>Editar producto</DialogTitle>
                                <DialogDescription>
                                    Actualiza los datos del producto.
                                </DialogDescription>
                            </DialogHeader>

                            <ProductoFormFields
                                producto={producto}
                                marcas={marcas}
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
                                    data-test="producto-submit"
                                    disabled={processing}
                                >
                                    Guardar Producto
                                </Button>
                            </DialogFooter>
                        </>
                    )}
                </Form>
            </DialogContent>
        </Dialog>
    );
}
