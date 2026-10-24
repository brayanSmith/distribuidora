import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
    AlignCenter,
    AlignLeft,
    AlignRight,
    ChevronDown,
    GripVertical,
    Trash2,
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { BLOQUES } from '@/lib/voucher-diseno';
import type { Alineacion, BloqueVoucher, Tamano } from '@/lib/voucher-diseno';

type Props = {
    bloque: BloqueVoucher;
    onChange: (bloque: BloqueVoucher) => void;
    onRemove?: () => void;
    disabled?: boolean;
};

const TAMANOS: { value: Tamano; label: string }[] = [
    { value: 'pequeno', label: 'Pequeño' },
    { value: 'normal', label: 'Normal' },
    { value: 'grande', label: 'Grande' },
];

/**
 * One block of the voucher in the designer: dragged by its handle, shown or
 * hidden with its switch, and opened to set its alignment, size, fields or
 * text.
 */
export default function BloqueEditor({
    bloque,
    onChange,
    onRemove,
    disabled = false,
}: Props) {
    const [abierto, setAbierto] = useState(
        bloque.tipo === 'texto' && !bloque.texto,
    );
    const meta = BLOQUES[bloque.tipo];
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition,
        isDragging,
    } = useSortable({ id: bloque.id, disabled });

    const cambiar = (cambios: Partial<BloqueVoucher>) =>
        onChange({ ...bloque, ...cambios });

    const resumenTexto =
        bloque.tipo === 'texto'
            ? (bloque.texto?.split('\n')[0] || 'Sin texto').slice(0, 40)
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
            data-test="voucher-bloque"
        >
            <div className="flex items-center gap-2 p-2">
                <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground cursor-grab touch-none p-1 active:cursor-grabbing disabled:cursor-not-allowed"
                    aria-label={`Mover ${meta.label}`}
                    disabled={disabled}
                    {...attributes}
                    {...listeners}
                >
                    <GripVertical className="size-4" />
                </button>

                <button
                    type="button"
                    className="min-w-0 flex-1 text-left"
                    onClick={() => setAbierto((valor) => !valor)}
                >
                    <div className="text-sm font-medium">{meta.label}</div>
                    <div className="text-muted-foreground truncate text-xs">
                        {resumenTexto}
                    </div>
                </button>

                <Switch
                    checked={bloque.visible}
                    onCheckedChange={(visible) => cambiar({ visible })}
                    disabled={disabled}
                    aria-label={`Mostrar ${meta.label}`}
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
                    {bloque.tipo === 'texto' ? (
                        <div className="grid gap-1.5">
                            <Label>Texto</Label>
                            <Textarea
                                value={bloque.texto ?? ''}
                                onChange={(event) =>
                                    cambiar({ texto: event.target.value })
                                }
                                rows={3}
                                maxLength={600}
                                placeholder="Ej.: ¡Gracias por su compra! Síguenos en Instagram @..."
                                disabled={disabled}
                                data-test="voucher-bloque-texto"
                            />
                            <p className="text-muted-foreground text-xs">
                                Cada renglón se imprime en una línea.
                            </p>
                        </div>
                    ) : null}

                    {meta.campos ? (
                        <div className="grid gap-1.5">
                            <Label>Qué muestra</Label>
                            <div className="grid grid-cols-2 gap-1.5">
                                {meta.campos.map((campo) => (
                                    <label
                                        key={campo.clave}
                                        className="flex items-center gap-2 text-sm"
                                    >
                                        <Checkbox
                                            checked={
                                                bloque.campos?.[campo.clave] !==
                                                false
                                            }
                                            onCheckedChange={(marcado) =>
                                                cambiar({
                                                    campos: {
                                                        ...bloque.campos,
                                                        [campo.clave]:
                                                            marcado === true,
                                                    },
                                                })
                                            }
                                            disabled={disabled}
                                        />
                                        {campo.label}
                                    </label>
                                ))}
                            </div>
                        </div>
                    ) : null}

                    <div className="flex flex-wrap items-end gap-4">
                        {meta.alineable || meta.campos ? (
                            <div className="grid gap-1.5">
                                <Label>Alineación</Label>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    value={bloque.alineacion}
                                    onValueChange={(valor) =>
                                        valor &&
                                        cambiar({
                                            alineacion: valor as Alineacion,
                                        })
                                    }
                                    disabled={disabled}
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
                                    <ToggleGroupItem
                                        value="right"
                                        aria-label="Derecha"
                                    >
                                        <AlignRight />
                                    </ToggleGroupItem>
                                </ToggleGroup>
                            </div>
                        ) : null}

                        {bloque.tipo !== 'logo' ? (
                            <div className="grid gap-1.5">
                                <Label>Tamaño de letra</Label>
                                <ToggleGroup
                                    type="single"
                                    variant="outline"
                                    size="sm"
                                    value={bloque.tamano}
                                    onValueChange={(valor) =>
                                        valor &&
                                        cambiar({ tamano: valor as Tamano })
                                    }
                                    disabled={disabled}
                                >
                                    {TAMANOS.map((tamano) => (
                                        <ToggleGroupItem
                                            key={tamano.value}
                                            value={tamano.value}
                                            className="px-2 text-xs"
                                        >
                                            {tamano.label}
                                        </ToggleGroupItem>
                                    ))}
                                </ToggleGroup>
                            </div>
                        ) : null}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                        <label className="flex items-center gap-2 text-sm">
                            <Checkbox
                                checked={bloque.linea}
                                onCheckedChange={(marcado) =>
                                    cambiar({ linea: marcado === true })
                                }
                                disabled={disabled}
                            />
                            Línea punteada debajo
                        </label>
                        {onRemove ? (
                            <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="text-red-600"
                                onClick={onRemove}
                                disabled={disabled}
                            >
                                <Trash2 />
                                Quitar
                            </Button>
                        ) : null}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
