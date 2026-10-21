import { cn } from '@/lib/utils';

type Props = {
    /** 0–100; null while the total is not known yet (moving stripe). */
    porcentaje: number | null;
    className?: string;
    dataTest?: string;
};

/** A progress bar: filled up to the percentage, or a moving stripe when unknown. */
export default function BarraProgreso({
    porcentaje,
    className,
    dataTest = 'barra-progreso',
}: Props) {
    const valor =
        porcentaje === null ? null : Math.min(Math.max(porcentaje, 0), 100);

    return (
        <div
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={valor ?? undefined}
            data-test={dataTest}
            className={cn(
                'bg-muted relative h-2 w-full overflow-hidden rounded-full',
                className,
            )}
        >
            {valor === null ? (
                <div className="absolute inset-y-0 w-1/3 animate-[barra-indeterminada_1.2s_ease-in-out_infinite] rounded-full bg-sky-500" />
            ) : (
                <div
                    className="h-full rounded-full bg-gradient-to-r from-sky-500 to-emerald-500 transition-[width] duration-500 ease-out"
                    style={{ width: `${valor}%` }}
                />
            )}
            <style>{`@keyframes barra-indeterminada { 0% { left: -33%; } 100% { left: 100%; } }`}</style>
        </div>
    );
}
