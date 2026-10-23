import { Check } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

export type Paso = {
    clave: string;
    label: string;
    icono: LucideIcon;
    hecho: boolean;
    /** Unlocked: the steps before it are done and the user may do it. */
    habilitado: boolean;
    cargando?: boolean;
    onClick: () => void;
};

type Props = {
    pasos: Paso[];
    /** What comes next, shown under the steps. */
    siguiente: string;
    dataTest?: string;
};

/**
 * Numbered steps done in order (1. Despachar → 2. Cobrar → 3. Entregado…):
 * the current one stands out, the next ones stay locked and the done ones
 * show a check.
 */
export default function Pasos({ pasos, siguiente, dataTest = 'pasos' }: Props) {
    return (
        <div className="grid gap-1.5" data-test={dataTest}>
            <div className="flex items-center gap-1">
                {pasos.map((paso, indice) => {
                    const Icono = paso.icono;

                    return (
                        <div
                            key={paso.clave}
                            className="flex flex-1 items-center gap-1"
                        >
                            {indice > 0 ? (
                                <div
                                    className={cn(
                                        'h-px w-2 shrink-0',
                                        pasos[indice - 1].hecho
                                            ? 'bg-emerald-500'
                                            : 'bg-border',
                                    )}
                                />
                            ) : null}
                            <Button
                                size="sm"
                                variant={
                                    paso.habilitado ? 'default' : 'outline'
                                }
                                disabled={!paso.habilitado}
                                loading={paso.cargando}
                                onClick={paso.onClick}
                                className={cn(
                                    'flex-1 px-2',
                                    paso.hecho &&
                                        'border-emerald-300 text-emerald-700 disabled:opacity-100 dark:border-emerald-900 dark:text-emerald-400',
                                )}
                                data-test={`paso-${paso.clave}`}
                            >
                                {paso.hecho ? <Check /> : <Icono />}
                                <span className="truncate">
                                    {indice + 1}. {paso.label}
                                </span>
                            </Button>
                        </div>
                    );
                })}
            </div>
            <p className="text-muted-foreground text-xs">{siguiente}</p>
        </div>
    );
}
