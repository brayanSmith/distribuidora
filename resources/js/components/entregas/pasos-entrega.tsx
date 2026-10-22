import { Check, CircleCheck, HandCoins, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { currencyFormatter } from '@/components/record-view';
import { cn } from '@/lib/utils';

type Paso = {
    clave: 'despachar' | 'cobrar' | 'entregar';
    label: string;
    icono: typeof Truck;
    hecho: boolean;
    habilitado: boolean;
    onClick: () => void;
};

type Props = {
    estado: 'POR_DESPACHAR' | 'EN_CAMINO';
    saldo: number;
    canUpdate: boolean;
    canCobrar: boolean;
    entregando: boolean;
    onDespachar: () => void;
    onCobrar: () => void;
    onEntregar: () => void;
};

/**
 * The steps of an active delivery, in order: despachar, cobrar and entregar.
 * Each one unlocks when the one before is done, and it says what is next.
 */
export default function PasosEntrega({
    estado,
    saldo,
    canUpdate,
    canCobrar,
    entregando,
    onDespachar,
    onCobrar,
    onEntregar,
}: Props) {
    const despachado = estado === 'EN_CAMINO';
    const cobrado = saldo <= 0;

    const pasos: Paso[] = [
        {
            clave: 'despachar',
            label: 'Despachar',
            icono: Truck,
            hecho: despachado,
            habilitado: canUpdate && !despachado,
            onClick: onDespachar,
        },
        {
            clave: 'cobrar',
            label: 'Cobrar',
            icono: HandCoins,
            hecho: cobrado,
            habilitado: canCobrar && despachado && !cobrado,
            onClick: onCobrar,
        },
        {
            clave: 'entregar',
            label: 'Entregado',
            icono: CircleCheck,
            hecho: false,
            habilitado: canUpdate && despachado && cobrado,
            onClick: onEntregar,
        },
    ];

    const siguiente = !despachado
        ? 'Siguiente: despachar el pedido.'
        : !cobrado
          ? `Siguiente: cobrar ${currencyFormatter.format(saldo)} al entregar.${canCobrar ? '' : ' No tienes permiso para cobrar.'}`
          : 'Cobrado. Ya puedes marcarlo entregado.';

    return (
        <div className="grid gap-1.5" data-test="entrega-pasos">
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
                                loading={
                                    paso.clave === 'entregar' && entregando
                                }
                                onClick={paso.onClick}
                                className={cn(
                                    'flex-1 px-2',
                                    paso.hecho &&
                                        'border-emerald-300 text-emerald-700 disabled:opacity-100 dark:border-emerald-900 dark:text-emerald-400',
                                )}
                                data-test={`entrega-${paso.clave}`}
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
