import { Head, Link } from '@inertiajs/react';
import { useTiposPrecio } from '@/hooks/use-tipos-precio';
import { Pencil } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { edit, index } from '@/routes/productos';
import type { Producto } from '@/types';

type Props = {
    producto: Omit<Producto, 'categoria' | 'sub_categoria'> & {
        categoria: { nombre_categoria: string } | null;
        sub_categoria: { nombre_sub_categoria: string } | null;
    };
};

function Field({
    label,
    value,
}: {
    label: string;
    value: string | number | null | undefined;
}) {
    return (
        <div className="grid gap-1">
            <span className="text-muted-foreground text-sm">{label}</span>
            <span className="font-medium">{value ?? '—'}</span>
        </div>
    );
}

export default function ProductoShow({ producto }: Props) {
    const { puedeCosto, puedeDetal, puedeMayorista } = useTiposPrecio();
    const nombre = producto.concatenar_codigo_nombre || 'Producto';

    return (
        <>
            <Head title={nombre} />

            <div className="mb-6 flex items-center justify-between">
                <div>
                    <div className="text-muted-foreground text-sm">
                        <Link href={index()}>Productos</Link> {'>'} {nombre}
                    </div>
                    <h1 className="text-2xl font-bold">{nombre}</h1>
                </div>

                <Button asChild>
                    <Link href={edit([producto.id])}>
                        <Pencil /> Editar
                    </Link>
                </Button>
            </div>

            <div className="space-y-6">
                <div className="bg-card flex flex-wrap items-center gap-8 rounded-lg border p-4">
                    <Field
                        label="Categoría"
                        value={producto.categoria?.nombre_categoria}
                    />
                    <Field
                        label="Subcategoría"
                        value={producto.sub_categoria?.nombre_sub_categoria}
                    />
                    <Field
                        label="Inventariable"
                        value={producto.inventariable ? 'Sí' : 'No'}
                    />
                </div>

                <div className="grid gap-6 lg:grid-cols-3">
                    <div className="bg-card space-y-4 rounded-lg border p-4 lg:col-span-2">
                        <div className="font-semibold">Datos del Producto</div>
                        <div className="grid gap-4 sm:grid-cols-4">
                            <Field
                                label="Referencia"
                                value={producto.referencia_producto}
                            />
                            <Field
                                label="Marca"
                                value={producto.marca?.marca}
                            />
                            <Field
                                label="Descripción"
                                value={producto.descripcion_producto}
                            />
                            <Field label="SKU" value={producto.sku} />
                        </div>
                    </div>

                    <div className="bg-card space-y-3 rounded-lg border p-4">
                        <div className="font-semibold">
                            Imágenes del Producto
                        </div>
                        {producto.imagenes.length > 0 ? (
                            <div className="grid grid-cols-2 gap-2">
                                {producto.imagenes.map((imagen) => (
                                    <img
                                        key={imagen.id}
                                        src={imagen.url}
                                        alt={nombre}
                                        className="aspect-square w-full rounded-md border object-contain"
                                    />
                                ))}
                            </div>
                        ) : (
                            <p className="text-muted-foreground text-sm">
                                Sin imagen
                            </p>
                        )}
                    </div>
                </div>

                <div className="bg-card space-y-4 rounded-lg border p-4">
                    <div className="font-semibold">Precios y Porcentajes</div>
                    <div className="grid gap-4 sm:grid-cols-4">
                        {puedeCosto ? (
                            <Field
                                label="Costo"
                                value={producto.costo_producto}
                            />
                        ) : null}
                        {puedeDetal ? (
                            <Field
                                label="Valor Detal"
                                value={producto.valor_detal}
                            />
                        ) : null}
                        {puedeMayorista ? (
                            <Field
                                label="Valor Mayorista"
                                value={producto.valor_mayorista}
                            />
                        ) : null}
                    </div>
                </div>
            </div>
        </>
    );
}

ProductoShow.layout = () => ({
    breadcrumbs: [
        {
            title: 'Productos',
            href: index(),
        },
    ],
});
