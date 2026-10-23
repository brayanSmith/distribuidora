import type { TipoPagoPedido } from '@/types';

/**
 * The tipos de pago of a pedido, with what each one is for, so whoever sells
 * picks the right one.
 */
export const TIPOS_PAGO: {
    value: TipoPagoPedido;
    label: string;
    descripcion: string;
}[] = [
    {
        value: 'CONTADO',
        label: 'Contado',
        descripcion:
            'El cliente paga todo ahora y se lleva el pedido en este momento.',
    },
    {
        value: 'SEPARADO',
        label: 'Separado',
        descripcion:
            'El cliente aparta el pedido para recogerlo en la tienda otro día (por ejemplo, si no hay stock). Puede abonar ahora y paga el resto al recogerlo. Queda en Separados.',
    },
    {
        value: 'CREDITO',
        label: 'Crédito',
        descripcion:
            'El cliente se lleva el pedido ahora y paga después, hasta la fecha de vencimiento. Queda en Cuentas por cobrar.',
    },
    {
        value: 'CONTRA_ENTREGA',
        label: 'Contra entrega',
        descripcion:
            'Se envía el pedido a la dirección del cliente y se cobra al entregarlo. Queda en Entregas para despacharlo.',
    },
];

/** The name of a tipo de pago as the user reads it ("Contra entrega"). */
export function etiquetaTipoPago(valor: string | null | undefined): string {
    return (
        TIPOS_PAGO.find((tipo) => tipo.value === valor)?.label ?? valor ?? '—'
    );
}
