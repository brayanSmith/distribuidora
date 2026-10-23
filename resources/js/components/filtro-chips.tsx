import { cn } from '@/lib/utils';

export type OpcionFiltro<T extends string> = {
    value: T;
    label: string;
    /** Colors of the counter while the chip is not selected. */
    className: string;
};

type Props<T extends string> = {
    opciones: OpcionFiltro<T>[];
    valor: T;
    conteos: Record<T, number>;
    onChange: (valor: T) => void;
    dataTest?: string;
};

/**
 * A row of chips to filter a list already loaded in the page, each one with
 * how many records it has. Changing it never asks the server.
 */
export default function FiltroChips<T extends string>({
    opciones,
    valor,
    conteos,
    onChange,
    dataTest = 'filtro-chips',
}: Props<T>) {
    return (
        <div className="flex flex-wrap gap-2" data-test={dataTest}>
            {opciones.map((opcion) => (
                <button
                    key={opcion.value}
                    type="button"
                    onClick={() => onChange(opcion.value)}
                    aria-pressed={valor === opcion.value}
                    className={cn(
                        'inline-flex items-center gap-2 rounded-full border px-3 py-1 text-sm transition-colors',
                        valor === opcion.value
                            ? 'bg-primary text-primary-foreground border-primary'
                            : 'bg-card hover:bg-accent',
                    )}
                    data-test={`${dataTest}-${opcion.value}`}
                >
                    {opcion.label}
                    <span
                        className={cn(
                            'rounded-full px-1.5 text-xs font-semibold',
                            valor === opcion.value
                                ? 'bg-primary-foreground/20'
                                : opcion.className,
                        )}
                    >
                        {conteos[opcion.value]}
                    </span>
                </button>
            ))}
        </div>
    );
}
