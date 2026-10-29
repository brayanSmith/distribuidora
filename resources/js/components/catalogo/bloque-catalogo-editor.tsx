import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    AlignCenter,
    AlignLeft,
    ChevronDown,
    Copy,
    FileText,
    GripVertical,
    LayoutGrid,
    SeparatorHorizontal,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import Combobox from '@/components/combobox';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import {
    BLOQUES_CATALOGO,
    ORDENES_PRODUCTOS,
    TAMANOS_TARJETAS,
} from '@/lib/catalogo-diseno';
import type {
    BloqueCatalogo,
    CategoriaOpcion,
    OrdenProductos,
    TamanoTarjetas,
} from '@/lib/catalogo-diseno';
import { cn } from '@/lib/utils';

type Props = {
    bloque: BloqueCatalogo;
    categorias: CategoriaOpcion[];
    onChange: (bloque: BloqueCatalogo) => void;
    onDuplicate: () => void;
    onRemove: () => void;
};

const ICONOS = {
    categoria: LayoutGrid,
    texto: FileText,
    salto: SeparatorHorizontal,
};

/**
 * One block of the catalog in the editor: dragged by its handle, shown or
 * hidden with its switch and opened to set what it shows.
 */
export default function BloqueCatalogoEditor({
    bloque,
    categorias,
    onChange,
    onDuplicate,
    onRemove,
}: Props) {
    const [abierto, setAbierto] = useState(
        bloque.tipo === 'texto' && !bloque.texto,
    );
    const meta = BLOQUES_CATALOGO[bloque.tipo];
    const Icono = ICONOS[bloque.tipo];
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: bloque.id });

    const cambiar = (cambios: Partial<BloqueCatalogo>) =>
        onChange({ ...bloque, ...cambios });

    const categoria = categorias.find(
        (item) => item.id === bloque.categoria_id,
    );

    const titulo =
        bloque.tipo === 'categoria'
            ? bloque.titulo ||
              categoria?.nombre_categoria ||
              'Elige una categoría'
            : bloque.tipo === 'texto'
              ? bloque.titulo ||
                (bloque.texto?.split('\n')[0] || 'Sin texto').slice(0, 50)
              : meta.label;

    const resumen =
        bloque.tipo === 'categoria'
            ? [
                  bloque.titulo ? categoria?.nombre_categoria : null,
                  TAMANOS_TARJETAS.find((item) => item.value === bloque.tamano)
                      ?.label,
                  bloque.solo_con_stock ? 'Solo con stock' : null,
                  bloque.subcategorias !== false ? 'Por subcategorías' : null,
              ]
                  .filter(Boolean)
                  .join(' · ')
            : meta.descripcion;

    return (
        <div
            ref={setNodeRef}
            style={{
                transform: CSS.Transform.toString(transform),
                transition,
            }}
            className={cn(
                'bg-card rounded-md border',
                isDragging && 'relative z-10 shadow-lg',
                !bloque.visible && 'opacity-60',
            )}
            data-test="catalogo-bloque"
        >
            <div className="flex items-center gap-2 p-2">
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground cursor-grab touch-none p-1 active:cursor-grabbing"
                    aria-label={`Mover ${titulo}`}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" />
                </button>

                <span className="bg-muted text-muted-foreground flex size-7 shrink-0 items-center justify-center rounded-md">
                    <Icono className="size-4" />
                </span>

                <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setAbierto((valor) => !valor)}
                >
                    <div
                        className={cn(
                            'truncate text-sm font-medium',
                            bloque.tipo === 'categoria' &&
                                !categoria &&
                                'text-red-600',
                        )}
                    >
                        {titulo}
                    </div>
                    <div className="text-muted-foreground truncate text-xs">
                        {resumen}
                    </div>
                </button>

                <Switch
                    checked={bloque.visible}
                    onCheckedChange={(visible) => cambiar({ visible })}
                    aria-label={`Mostrar ${titulo}`}
                />
                <button
                    type="button"
                    onClick={() => setAbierto((valor) => !valor)}
                    className="text-muted-foreground p-1"
                    aria-label="Opciones"
                >
                    <ChevronDown
                        className={cn(
                            'size-4 transition-transform',
                            abierto && 'rotate-180',
                        )}
                    />
                </button>
            </div>

            {abierto ? (
                <div className="grid gap-3 border-t p-3">
                    {bloque.tipo === 'categoria' ? (
                        <>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <div className="grid gap-1.5">
                                    <Label required>Categoría</Label>
                                    <Combobox
                                        options={categorias.map((item) => ({
                                            value: String(item.id),
                                            label: item.nombre_categoria,
                                        }))}
                                        value={
                                            bloque.categoria_id
                                                ? String(bloque.categoria_id)
                                                : ''
                                        }
                                        onValueChange={(valor) =>
                                            cambiar({
                                                categoria_id: Number(valor),
                                            })
                                        }
                                        placeholder="Elige una categoría"
                                        searchPlaceholder="Buscar categoría..."
                                        dataTest="catalogo-bloque-categoria"
                                    />
                                </div>
                                <div className="grid gap-1.5">
                                    <Label>Título</Label>
                                    <Input
                                        value={bloque.titulo ?? ''}
                                        onChange={(event) =>
                                            cambiar({
                                                titulo: event.target.value,
                                            })
                                        }
                                        placeholder={
                                            categoria?.nombre_categoria ??
                                            'El de la categoría'
                                        }
                                        maxLength={80}
                                    />
                                </div>
                            </div>

                            <div className="grid gap-1.5">
                                <Label>Tamaño de las tarjetas</Label>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    value={bloque.tamano ?? 'auto'}
                                    onValueChange={(valor) =>
                                        valor &&
                                        cambiar({
                                            tamano: valor as TamanoTarjetas,
                                        })
                                    }
                                    className="flex-wrap justify-start"
                                >
                                    {TAMANOS_TARJETAS.map((tamano) => (
                                        <ToggleGroupItem
                                            key={tamano.value}
                                            value={tamano.value}
                                            className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-2 text-xs"
                                        >
                                            {tamano.label}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>

                            <div className="flex flex-wrap items-end gap-4">
                                <div className="grid gap-1.5">
                                    <Label>Ordenar por</Label>
                                    <ToggleGroup
                                        type="single"
                                        variant="outline"
                                        size="sm"
                                        value={bloque.orden ?? 'nombre'}
                                        onValueChange={(valor) =>
                                            valor &&
                                            cambiar({
                                                orden: valor as OrdenProductos,
                                            })
                                        }
                                        className="justify-start"
                                    >
                                        {ORDENES_PRODUCTOS.map((orden) => (
                                            <ToggleGroupItem
                                                key={orden.value}
                                                value={orden.value}
                                                className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground px-2 text-xs"
                                            >
                                                {orden.label}
                                            </ToggleGroupItem>
                                        ))}
                                    </ToggleGroup>
                                </div>
                                <label className="flex items-center gap-2 pb-1.5 text-sm">
                                    <Checkbox
                                        checked={bloque.solo_con_stock === true}
                                        onCheckedChange={(marcado) =>
                                            cambiar({
                                                solo_con_stock:
                                                    marcado === true,
                                            })
                                        }
                                    />
                                    Solo productos con stock
                                </label>
                                <label className="flex items-center gap-2 pb-1.5 text-sm">
                                    <Checkbox
                                        checked={bloque.subcategorias !== false}
                                        onCheckedChange={(marcado) =>
                                            cambiar({
                                                subcategorias: marcado === true,
                                            })
                                        }
                                        data-test="catalogo-bloque-subcategorias"
                                    />
                                    Dividir por subcategorías
                                </label>
                            </div>
                        </>
                    ) : null}

                    {bloque.tipo === 'texto' ? (
                        <>
                            <div className="grid gap-1.5">
                                <Label>Título</Label>
                                <Input
                                    value={bloque.titulo ?? ''}
                                    onChange={(event) =>
                                        cambiar({ titulo: event.target.value })
                                    }
                                    placeholder="Opcional. Ej.: Formas de pago"
                                    maxLength={80}
                                />
                            </div>
                            <div className="grid gap-1.5">
                                <Label>Texto</Label>
                                <Textarea
                                    value={bloque.texto ?? ''}
                                    onChange={(event) =>
                                        cambiar({ texto: event.target.value })
                                    }
                                    rows={3}
                                    maxLength={1000}
                                    placeholder="Ej.: Envíos a todo el país. Pedido mínimo $100.000."
                                    data-test="catalogo-bloque-texto"
                                />
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    value={bloque.alineacion ?? 'left'}
                                    onValueChange={(valor) =>
                                        valor &&
                                        cambiar({
                                            alineacion: valor as
                                                | 'left'
                                                | 'center',
                                        })
                                    }
                                >
                                    <ToggleGroupItem
                                        value="left"
                                        aria-label="Izquierda"
                                    >
                                        <AlignLeft />
                                    </ToggleGroupItem>
                                    <ToggleGroupItem
                                        value="center"
                                        aria-label="Centro"
                                    >
                                        <AlignCenter />
                                    </ToggleGroupItem>
                                </ToggleGroup>
                                <label className="flex items-center gap-2 text-sm">
                                    <Checkbox
                                        checked={bloque.destacado === true}
                                        onCheckedChange={(marcado) =>
                                            cambiar({
                                                destacado: marcado === true,
                                            })
                                        }
                                    />
                                    En un recuadro de color
                                </label>
                            </div>
                        </>
                    ) : null}

                    <div className="flex justify-end gap-1">
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={onDuplicate}
                        >
                            <Copy />
                            Duplicar
                        </Button>
                        <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="text-red-600"
                            onClick={onRemove}
                        >
                            <Trash2 />
                            Quitar
                        </Button>
                    </div>
                </div>
            ) : null}
        </div>
    );
}
