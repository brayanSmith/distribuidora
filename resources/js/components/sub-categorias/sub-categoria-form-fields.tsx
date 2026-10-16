import { useState } from 'react';
import InputError from '@/components/input-error';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import type { SubCategoria } from '@/types';

type Props = {
    subCategoria?: SubCategoria | null;
    categorias: { id: number; nombre_categoria: string }[];
    errors: Partial<Record<string, string>>;
};

export default function SubCategoriaFormFields({
    subCategoria,
    categorias,
    errors,
}: Props) {
    const [categoriaId, setCategoriaId] = useState(
        subCategoria ? String(subCategoria.categoria_id) : '',
    );

    return (
        <div className="grid gap-4">
            <div className="grid gap-2">
                <Label required>Categoría</Label>
                <Select value={categoriaId} onValueChange={setCategoriaId}>
                    <SelectTrigger
                        className="w-full"
                        data-test="sub-categoria-categoria"
                    >
                        <SelectValue placeholder="Selecciona una categoría" />
                    </SelectTrigger>
                    <SelectContent>
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
                <input type="hidden" name="categoria_id" value={categoriaId} />
                <InputError message={errors.categoria_id} />
            </div>

            <div className="grid gap-2">
                <Label required htmlFor="nombre_sub_categoria">
                    Nombre
                </Label>
                <Input
                    id="nombre_sub_categoria"
                    name="nombre_sub_categoria"
                    data-test="sub-categoria-nombre"
                    defaultValue={subCategoria?.nombre_sub_categoria ?? ''}
                    required
                />
                <InputError message={errors.nombre_sub_categoria} />
            </div>
        </div>
    );
}
