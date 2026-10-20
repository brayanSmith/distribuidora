import { Check, ChevronDown, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuSeparator,
    DropdownMenuSub,
    DropdownMenuSubContent,
    DropdownMenuSubTrigger,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { cn } from '@/lib/utils';
import type { CategoriaOption } from '@/types';

/** No categoria filter. */
export const TODAS_LAS_CATEGORIAS = 'TODOS';
/** Productos without a categoria. */
export const SIN_CATEGORIA = 'SIN_CATEGORIA';

export type ConteosCategorias = {
    total: number;
    /** By categoria id (or SIN_CATEGORIA). */
    porCategoria: Record<string, number>;
    /** By `<categoria id>|<subcategoria name>`. */
    porSubCategoria: Record<string, number>;
};

/**
 * How many items each categoria and subcategoria has, for the filter's counts.
 */
export function contarCategorias<T>(
    items: T[],
    categoriaDe: (item: T) => number | null,
    subCategoriaDe: (item: T) => string | null,
): ConteosCategorias {
    const conteos: ConteosCategorias = {
        total: items.length,
        porCategoria: {},
        porSubCategoria: {},
    };

    items.forEach((item) => {
        const categoriaId = categoriaDe(item);
        const clave =
            categoriaId === null ? SIN_CATEGORIA : String(categoriaId);
        conteos.porCategoria[clave] = (conteos.porCategoria[clave] ?? 0) + 1;

        const subCategoria = subCategoriaDe(item);

        if (categoriaId !== null && subCategoria) {
            const claveSub = `${categoriaId}|${subCategoria}`;
            conteos.porSubCategoria[claveSub] =
                (conteos.porSubCategoria[claveSub] ?? 0) + 1;
        }
    });

    return conteos;
}

/** Whether an item passes the categoria / subcategoria picked in the filter. */
export function pasaFiltroCategoria(
    categoria: string,
    subCategoria: string,
    categoriaId: number | null,
    subCategoriaNombre: string | null,
): boolean {
    if (categoria === TODAS_LAS_CATEGORIAS) {
        return true;
    }

    if (categoria === SIN_CATEGORIA) {
        return categoriaId === null;
    }

    return (
        String(categoriaId) === categoria &&
        (subCategoria === '' || subCategoriaNombre === subCategoria)
    );
}

function Item({
    activo,
    etiqueta,
    cantidad,
}: {
    activo: boolean;
    etiqueta: string;
    cantidad: number;
}) {
    return (
        <span className="flex w-full items-center gap-2">
            <Check className={cn('size-4 shrink-0', !activo && 'invisible')} />
            <span className="flex-1">{etiqueta}</span>
            <span className="text-muted-foreground text-xs">{cantidad}</span>
        </span>
    );
}

type Props = {
    categorias: CategoriaOption[];
    /** TODAS_LAS_CATEGORIAS, SIN_CATEGORIA or a categoria id. */
    categoria: string;
    /** The subcategoria name, '' for all of the categoria. */
    subCategoria: string;
    onChange: (categoria: string, subCategoria: string) => void;
    conteos: ConteosCategorias;
    dataTest?: string;
    className?: string;
};

/**
 * Categoria filter as a single button: each categoria with subcategorias
 * opens them as a submenu on hover, with how many items each one has.
 */
export default function CategoriaFiltro({
    categorias,
    categoria,
    subCategoria,
    onChange,
    conteos,
    dataTest = 'filtro-categoria',
    className,
}: Props) {
    const actual = categorias.find(({ id }) => String(id) === categoria);
    const etiqueta =
        categoria === SIN_CATEGORIA
            ? 'Sin categoría'
            : actual
              ? subCategoria
                  ? `${actual.nombre_categoria} › ${subCategoria}`
                  : actual.nombre_categoria
              : 'Todas las categorías';

    return (
        <div className={cn('flex items-center', className)}>
            <DropdownMenu>
                <DropdownMenuTrigger asChild>
                    <Button variant="outline" data-test={dataTest}>
                        <span className="truncate">{etiqueta}</span>
                        <ChevronDown className="opacity-60" />
                    </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start" className="min-w-56">
                    <DropdownMenuItem
                        onSelect={() => onChange(TODAS_LAS_CATEGORIAS, '')}
                    >
                        <Item
                            activo={categoria === TODAS_LAS_CATEGORIAS}
                            etiqueta="Todas las categorías"
                            cantidad={conteos.total}
                        />
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />

                    {categorias.map((opcion) => {
                        const id = String(opcion.id);
                        const activa = categoria === id;
                        const cantidad = conteos.porCategoria[id] ?? 0;

                        if (opcion.sub_categorias.length === 0) {
                            return (
                                <DropdownMenuItem
                                    key={id}
                                    onSelect={() => onChange(id, '')}
                                >
                                    <Item
                                        activo={activa}
                                        etiqueta={opcion.nombre_categoria}
                                        cantidad={cantidad}
                                    />
                                </DropdownMenuItem>
                            );
                        }

                        return (
                            <DropdownMenuSub key={id}>
                                <DropdownMenuSubTrigger
                                    data-test={`${dataTest}-${id}`}
                                    onClick={() => onChange(id, '')}
                                >
                                    <Item
                                        activo={activa}
                                        etiqueta={opcion.nombre_categoria}
                                        cantidad={cantidad}
                                    />
                                </DropdownMenuSubTrigger>
                                <DropdownMenuSubContent className="min-w-52">
                                    <DropdownMenuItem
                                        onSelect={() => onChange(id, '')}
                                    >
                                        <Item
                                            activo={
                                                activa && subCategoria === ''
                                            }
                                            etiqueta={`Todas de ${opcion.nombre_categoria}`}
                                            cantidad={cantidad}
                                        />
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    {opcion.sub_categorias.map((sub) => (
                                        <DropdownMenuItem
                                            key={sub.id}
                                            onSelect={() =>
                                                onChange(
                                                    id,
                                                    sub.nombre_sub_categoria,
                                                )
                                            }
                                        >
                                            <Item
                                                activo={
                                                    activa &&
                                                    subCategoria ===
                                                        sub.nombre_sub_categoria
                                                }
                                                etiqueta={
                                                    sub.nombre_sub_categoria
                                                }
                                                cantidad={
                                                    conteos.porSubCategoria[
                                                        `${id}|${sub.nombre_sub_categoria}`
                                                    ] ?? 0
                                                }
                                            />
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuSubContent>
                            </DropdownMenuSub>
                        );
                    })}

                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                        onSelect={() => onChange(SIN_CATEGORIA, '')}
                    >
                        <Item
                            activo={categoria === SIN_CATEGORIA}
                            etiqueta="Sin categoría"
                            cantidad={conteos.porCategoria[SIN_CATEGORIA] ?? 0}
                        />
                    </DropdownMenuItem>
                </DropdownMenuContent>
            </DropdownMenu>

            {categoria !== TODAS_LAS_CATEGORIAS ? (
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    aria-label="Quitar filtro de categoría"
                    onClick={() => onChange(TODAS_LAS_CATEGORIAS, '')}
                    data-test={`${dataTest}-limpiar`}
                >
                    <X className="size-4" />
                </Button>
            ) : null}
        </div>
    );
}
