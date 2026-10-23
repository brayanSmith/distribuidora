import type { Dispatch, SetStateAction } from 'react';
import type { TipoPagoPedido, TipoPrecioPedido } from '@/types';

/** Delivery data of a contra entrega pedido. */
export type PosEntrega = {
    /** The cliente the data was taken from, to take it again when the cliente changes. */
    clienteId: string;
    direccion: string;
    ciudad: string;
    telefono: string;
    recibe: string;
    nota: string;
    /** Day it should be delivered (Y-m-d); '' for as soon as possible. */
    fecha_programada: string;
    /** The user who takes it; '' unassigned (everyone who delivers is told). Missing in carts saved before it existed. */
    mensajero_id?: string;
};

export type PosHeaderState = {
    clienteId: string;
    bodegaId: string;
    vendedorId: string;
    tipoPrecio: TipoPrecioPedido;
    descuento: string;
    flete: string;
    reteica: string;
    retefuente: string;
    tipoPago: TipoPagoPedido;
    /** Due date (Y-m-d) of a pedido on credit; '' until one is picked. */
    fechaVencimiento: string;
    /** Day a separado is picked up (Y-m-d); '' for the default (missing in carts saved before it existed). */
    fechaRecogida?: string;
    /** Where a contra entrega pedido goes (missing in carts saved before it existed). */
    entrega?: PosEntrega;
    observacion: string;
    /** The observación de pago as edited by hand; null follows the abonos. */
    observacionPago: string | null;
    aplicaTurno: boolean;
    facturacionElectronica: boolean;
};

/**
 * The pedido-level fields the POS right panel edits (cliente, bodega,
 * vendedor, tipo de precio, descuento, flete, observación, turno,
 * facturación electrónica), as one state
 * object with a single patch function — keeps the panel's prop list to
 * `header` + `setField` instead of a pair of props per field.
 */
export const defaultPosHeader = (
    tipoPrecio: TipoPrecioPedido = 'DETAL',
): PosHeaderState => ({
    clienteId: '',
    bodegaId: '',
    vendedorId: '',
    tipoPrecio,
    descuento: '0',
    flete: '0',
    reteica: '0',
    retefuente: '0',
    tipoPago: 'CONTADO',
    fechaVencimiento: '',
    observacion: '',
    observacionPago: null,
    aplicaTurno: false,
    facturacionElectronica: false,
});

export function usePosHeader(
    header: PosHeaderState,
    setHeader: Dispatch<SetStateAction<PosHeaderState>>,
) {
    const setField = <K extends keyof PosHeaderState>(
        key: K,
        value: PosHeaderState[K],
    ) => {
        setHeader((prev) => ({ ...prev, [key]: value }));
    };

    /**
     * Empties the pedido (cliente, payment data, extras) for the next sale,
     * keeping what identifies the terminal: bodega, vendedor and tipo de
     * precio.
     */
    const resetVenta = () => {
        setHeader((prev) => ({
            ...defaultPosHeader(prev.tipoPrecio),
            bodegaId: prev.bodegaId,
            vendedorId: prev.vendedorId,
        }));
    };

    return { header, setField, resetVenta };
}
