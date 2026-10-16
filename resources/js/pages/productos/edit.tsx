import { Form, Head, Link, router, usePage } from '@inertiajs/react';
import { useState } from 'react';
import DeleteProductoModal from '@/components/productos/delete-producto-modal';
import ProductoFormFields from '@/components/productos/producto-form-fields';
import { Button } from '@/components/ui/button';
import { index, show, update } from '@/routes/productos';
import type { CategoriaOption, MarcaOption, Producto } from '@/types';

type Props = {
    producto: Producto;
    marcas: MarcaOption[];
    categorias: CategoriaOption[];
    permissions: { canDelete: boolean };
};

export default function ProductoEdit({
    producto,
    marcas,
    categorias,
    permissions,
}: Props) {
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

    const nombre = producto.concatenar_codigo_nombre || 'Producto';

    return (
        <>
            <Head title={`Editar ${nombre}`} />

            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="text-muted-foreground text-sm">
                        <Link href={index()}>Productos</Link> {'>'} {nombre}{' '}
                        {'>'} Editar
                    </div>
                    <h1 className="text-2xl font-bold">Editar {nombre}</h1>
                </div>

                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href={show([producto.id])}>Ver</Link>
                    </Button>
                    {permissions.canDelete ? (
                        <Button
                            variant="destructive"
                            data-test="producto-delete-button"
                            onClick={() => setDeleteDialogOpen(true)}
                        >
                            Borrar
                        </Button>
                    ) : null}
                </div>
            </div>

            <Form {...update.form([producto.id])} className="space-y-6">
                {({ errors, processing }) => (
                    <>
                        <ProductoFormFields
                            producto={producto}
                            marcas={marcas}
                            categorias={categorias}
                            errors={errors}
                        />

                        <div className="flex justify-end gap-2">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => router.visit(index())}
                            >
                                Cancelar
                            </Button>
                            <Button
                                type="submit"
                                data-test="producto-submit"
                                disabled={processing}
                            >
                                Guardar Producto
                            </Button>
                        </div>
                    </>
                )}
            </Form>

            <DeleteProductoModal
                producto={producto}
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            />
        </>
    );
}

ProductoEdit.layout = () => ({
    breadcrumbs: [
        {
            title: 'Productos',
            href: index(),
        },
    ],
});
