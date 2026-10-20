import { useMemo, useState } from 'react';
import InputError from '@/components/input-error';
import ProductoImageUpload from '@/components/productos/producto-image-upload';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { useTiposPrecio } from '@/hooks/use-tipos-precio';
import type { CategoriaOption, Producto } from '@/types';

type FormErrors = Partial<Record<string, string>>;

type Props = {
    producto?: Producto | null;
    categorias: CategoriaOption[];
    errors: FormErrors;
};

const SIN_SELECCION = 'ninguna';

export default function ProductoFormFields({
    producto,
    categorias,
    errors,
}: Props) {
    const { puedeCosto, puedeDetal, puedeMayorista } = useTiposPrecio();
    const [inventariable, setInventariable] = useState(
        producto?.inventariable ?? true,
    );
    const [categoriaId, setCategoriaId] = useState<string>(
        producto?.categoria_id ? String(producto.categoria_id) : '',
    );
    const [subCategoriaId, setSubCategoriaId] = useState<string>(
        producto?.sub_categoria_id ? String(producto.sub_categoria_id) : '',
    );
    const subCategorias = useMemo(
        () =>
            categorias.find((c) => String(c.id) === categoriaId)
                ?.sub_categorias ?? [],
        [categorias, categoriaId],
    );

    const handleCategoriaChange = (value: string) => {
        setCategoriaId(value === SIN_SELECCION ? '' : value);
        // A subcategoria only belongs to its own categoria.
        setSubCategoriaId('');
    };

    return (
        <div className="space-y-6">
            <div className="bg-card flex flex-wrap items-end gap-6 rounded-lg border p-4">
                <div className="grid min-w-48 gap-2">
                    <Label className="font-semibold">Categoría</Label>
                    <Select
                        value={categoriaId || SIN_SELECCION}
                        onValueChange={handleCategoriaChange}
                    >
                        <SelectTrigger
                            className="w-full"
                            data-test="producto-categoria"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={SIN_SELECCION}>
                                Sin categoría
                            </SelectItem>
                            {categorias.map((categoria) => (
                                <SelectItem
                                    key={categoria.id}
                                    value={String(categoria.id)}
                                >
                                    {categoria.nombre_categoria}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <input
                        type="hidden"
                        name="categoria_id"
                        value={categoriaId}
                    />
                    <InputError message={errors.categoria_id} />
                </div>

                <div className="grid min-w-48 gap-2">
                    <Label className="font-semibold">Subcategoría</Label>
                    <Select
                        value={subCategoriaId || SIN_SELECCION}
                        onValueChange={(value) =>
                            setSubCategoriaId(
                                value === SIN_SELECCION ? '' : value,
                            )
                        }
                        disabled={subCategorias.length === 0}
                    >
                        <SelectTrigger
                            className="w-full"
                            data-test="producto-sub-categoria"
                        >
                            <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value={SIN_SELECCION}>
                                Sin subcategoría
                            </SelectItem>
                            {subCategorias.map((subCategoria) => (
                                <SelectItem
                                    key={subCategoria.id}
                                    value={String(subCategoria.id)}
                                >
                                    {subCategoria.nombre_sub_categoria}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <input
                        type="hidden"
                        name="sub_categoria_id"
                        value={subCategoriaId}
                    />
                    <InputError message={errors.sub_categoria_id} />
                </div>

                <div className="flex flex-wrap items-center gap-3 pb-2">
                    <Label className="font-semibold">Inventariable</Label>
                    <Switch
                        checked={inventariable}
                        onCheckedChange={setInventariable}
                        data-test="producto-inventariable"
                    />
                    <span className="text-sm">
                        {inventariable ? 'Sí' : 'No'}
                    </span>
                    <input
                        type="hidden"
                        name="inventariable"
                        value={inventariable ? '1' : '0'}
                    />
                </div>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
                <div className="bg-card space-y-4 rounded-lg border p-4 lg:col-span-2">
                    <div className="font-semibold">Datos del Producto</div>

                    <div className="grid gap-4 sm:grid-cols-4">
                        <div className="grid gap-2">
                            <Label htmlFor="sku">SKU</Label>
                            <Input
                                id="sku"
                                name="sku"
                                data-test="producto-sku"
                                defaultValue={producto?.sku ?? ''}
                            />
                            <InputError message={errors.sku} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="marca">Marca</Label>
                            <Input
                                id="marca"
                                name="marca"
                                data-test="producto-marca"
                                defaultValue={producto?.marca ?? ''}
                            />
                            <InputError message={errors.marca} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="referencia_producto">
                                Referencia
                            </Label>
                            <Input
                                id="referencia_producto"
                                name="referencia_producto"
                                data-test="producto-referencia"
                                defaultValue={
                                    producto?.referencia_producto ?? ''
                                }
                            />
                            <InputError message={errors.referencia_producto} />
                        </div>

                        <div className="grid gap-2">
                            <Label htmlFor="descripcion_producto">
                                Descripción
                            </Label>
                            <Input
                                id="descripcion_producto"
                                name="descripcion_producto"
                                data-test="producto-descripcion"
                                defaultValue={
                                    producto?.descripcion_producto ?? ''
                                }
                            />
                            <InputError message={errors.descripcion_producto} />
                        </div>
                    </div>
                </div>

                <div className="bg-card space-y-3 rounded-lg border p-4">
                    <div className="font-semibold">Imágenes del Producto</div>
                    <ProductoImageUpload
                        existentes={producto?.imagenes}
                        errors={errors}
                    />
                </div>
            </div>

            <div className="bg-card space-y-4 rounded-lg border p-4">
                <div className="font-semibold">Precios y Porcentajes</div>
                <div className="grid gap-4 sm:grid-cols-4">
                    {puedeCosto ? (
                        <div className="grid gap-2">
                            <Label htmlFor="costo_producto">Costo</Label>
                            <Input
                                id="costo_producto"
                                name="costo_producto"
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={producto?.costo_producto ?? '0'}
                            />
                            <InputError message={errors.costo_producto} />
                        </div>
                    ) : null}
                    {puedeDetal ? (
                        <div className="grid gap-2">
                            <Label htmlFor="valor_detal">Valor Detal</Label>
                            <Input
                                id="valor_detal"
                                name="valor_detal"
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={producto?.valor_detal ?? '0'}
                            />
                            <InputError message={errors.valor_detal} />
                        </div>
                    ) : null}
                    {puedeMayorista ? (
                        <div className="grid gap-2">
                            <Label htmlFor="valor_mayorista">
                                Valor Mayorista
                            </Label>
                            <Input
                                id="valor_mayorista"
                                name="valor_mayorista"
                                type="number"
                                step="0.01"
                                min="0"
                                defaultValue={producto?.valor_mayorista ?? '0'}
                            />
                            <InputError message={errors.valor_mayorista} />
                        </div>
                    ) : null}
                </div>
            </div>
        </div>
    );
}
