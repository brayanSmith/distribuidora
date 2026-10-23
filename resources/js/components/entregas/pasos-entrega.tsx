import { CircleCheck, HandCoins, Truck } from 'lucide-react';
import Pasos from '@/components/pasos';
import { currencyFormatter } from '@/components/record-view';

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

    const siguiente = !despachado
        ? 'Siguiente: despachar el pedido.'
        : !cobrado
          ? `Siguiente: cobrar ${currencyFormatter.format(saldo)} al entregar.${canCobrar ? '' : ' No tienes permiso para cobrar.'}`
          : 'Cobrado. Ya puedes marcarlo entregado.';

    return (
        <Pasos
            dataTest="entrega-pasos"
            siguiente={siguiente}
            pasos={[
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
                    cargando: entregando,
                    onClick: onEntregar,
                },
            ]}
        />
    );
}
