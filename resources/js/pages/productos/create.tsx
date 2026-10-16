import { Form, Head, Link } from '@inertiajs/react';
import ProductoFormFields from '@/components/productos/producto-form-fields';
import { Button } from '@/components/ui/button';
import { index, store } from '@/routes/productos';
import type { CategoriaOption, MarcaOption } from '@/types';

type Props = {
    marcas: MarcaOption[];
    categorias: CategoriaOption[];
};

export default function ProductoCreate({ marcas, categorias }: Props) {
    return (
        <>
            <Head title="Nuevo producto" />

            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="text-muted-foreground text-sm">
                        <Link href={index()}>Productos</Link> {'>'} Crear
                    </div>
                    <h1 className="text-2xl font-bold">Nuevo producto</h1>
                </div>
            </div>

            <Form {...store.form()} className="space-y-6">
                {({ errors, processing }) => (
                    <>
                        <ProductoFormFields
                            marcas={marcas}
                            categorias={categorias}
                            errors={errors}
                        />

                        <div className="flex justify-end gap-2">
                            <Button variant="outline" asChild>
                                <Link href={index()}>Cancelar</Link>
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
        </>
    );
}

ProductoCreate.layout = () => ({
    breadcrumbs: [
        {
            title: 'Productos',
            href: index(),
        },
        {
            title: 'Crear',
            href: '#',
        },
    ],
});
