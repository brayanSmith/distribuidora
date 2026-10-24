import type { TipoPrecioLinea } from '@/hooks/use-pos-cart';
import { useTiposPrecio } from '@/hooks/use-tipos-precio';
import { cn } from '@/lib/utils';

type Props = {
    value: TipoPrecioLinea;
    onChange: (tipoPrecio: TipoPrecioLinea) => void;
    /** `compact` shows D / M (cart lines); `full` the whole names. */
    size?: 'compact' | 'full';
    dataTest?: string;
    disabled?: boolean;
};

const OPCIONES = [
    {
        value: 'DETAL' as const,
        corto: 'D',
        nombre: 'Detal',
        activo: 'bg-emerald-600 text-white',
    },
    {
        value: 'MAYORISTA' as const,
        corto: 'M',
        nombre: 'Mayorista',
        activo: 'bg-amber-500 text-white',
    },
    {
        value: 'PERSONALIZADO' as const,
        corto: 'P',
        nombre: 'Personalizado',
        activo: 'bg-sky-600 text-white',
    },
];

/**
 * Grouped Detal / Mayorista / Personalizado switch for the price a product is
 * sold at. Only the list prices the user may see are offered.
 */
export default function TipoPrecioToggle({
    value,
    onChange,
    size = 'compact',
    dataTest = 'tipo-precio-toggle',
    disabled = false,
}: Props) {
    const { puedeDetal, puedeMayorista } = useTiposPrecio();
    // A hand-typed price is always possible; the list prices only when seen.
    const opciones = OPCIONES.filter(
        (opcion) =>
            opcion.value === 'PERSONALIZADO' ||
            (opcion.value === 'DETAL' ? puedeDetal : puedeMayorista),
    );

    if (opciones.length < 2) {
        return null;
    }

    return (
        <div
            role="radiogroup"
            aria-label="Tipo de precio"
            className={cn(
                'flex shrink-0 overflow-hidden rounded-md border text-xs font-medium',
                size === 'compact' ? 'h-8' : 'h-9 w-full text-sm',
            )}
            data-test={dataTest}
        >
            {opciones.map((opcion) => (
                <button
                    key={opcion.value}
                    type="button"
                    role="radio"
                    aria-checked={value === opcion.value}
                    title={
                        opcion.value === 'PERSONALIZADO'
                            ? 'Precio personalizado'
                            : `Vender al ${opcion.nombre.toLowerCase()}`
                    }
                    disabled={disabled}
                    onClick={() =>
                        value !== opcion.value && onChange(opcion.value)
                    }
                    data-test={`${dataTest}-${opcion.value}`}
                    className={cn(
                        'transition-colors disabled:cursor-not-allowed disabled:opacity-60',
                        size === 'compact' ? 'w-7' : 'flex-1',
                        value === opcion.value
                            ? opcion.activo
                            : 'hover:bg-accent',
                    )}
                >
                    {size === 'compact' ? opcion.corto : opcion.nombre}
                </button>
            ))}
        </div>
    );
}
