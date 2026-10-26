import { Minus, Plus } from 'lucide-react';
import { useState } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    value: number;
    onChange: (cantidad: number) => void;
    /** The least it can be (1, or what already arrived of a compra line). */
    min?: number;
    disabled?: boolean;
    className?: string;
    dataTest?: string;
};

/**
 * A quantity with − / + buttons around it, that can also be typed. An
 * emptied field waits for the new number instead of dropping to zero.
 */
export default function CantidadStepper({
    value,
    onChange,
    min = 1,
    disabled = false,
    className,
    dataTest,
}: Props) {
    const [texto, setTexto] = useState<string | null>(null);
    const cambiar = (cantidad: number) => onChange(Math.max(cantidad, min));

    return (
        <div
            className={cn(
                'flex h-8 shrink-0 items-center overflow-hidden rounded-md border',
                disabled && 'opacity-60',
                className,
            )}
        >
            <button
                type="button"
                aria-label="Menos"
                onClick={() => cambiar(value - 1)}
                disabled={disabled || value <= min}
                className="hover:bg-accent flex h-full w-7 items-center justify-center disabled:pointer-events-none disabled:opacity-40"
            >
                <Minus className="size-3.5" />
            </button>
            <input
                type="number"
                inputMode="decimal"
                min={min}
                value={texto ?? value}
                disabled={disabled}
                onChange={(event) => {
                    setTexto(event.target.value);
                    const cantidad = Number(event.target.value);

                    if (cantidad > 0) {
                        cambiar(cantidad);
                    }
                }}
                onBlur={() => setTexto(null)}
                aria-label="Cantidad"
                className="h-full w-10 [appearance:textfield] border-x bg-transparent text-center text-sm tabular-nums outline-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                data-test={dataTest}
            />
            <button
                type="button"
                aria-label="Más"
                onClick={() => cambiar(value + 1)}
                disabled={disabled}
                className="hover:bg-accent flex h-full w-7 items-center justify-center disabled:pointer-events-none disabled:opacity-40"
            >
                <Plus className="size-3.5" />
            </button>
        </div>
    );
}
