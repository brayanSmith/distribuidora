import type { Dispatch, SetStateAction } from 'react';
import { useMemo } from 'react';

export type PosAbono = {
    id: number;
    pucId: number;
    pucNombre: string;
    monto: number;
    conCuantoPago: number;
    descripcion: string;
};

export type PosNewAbono = Omit<PosAbono, 'id'>;

/** The observación de pago the abonos build: each description, as a list. */
const observacionDeAbonos = (abonos: PosAbono[]): string =>
    abonos
        .filter((abono) => abono.descripcion !== '')
        .map((abono) => `- ${abono.descripcion}`)
        .join('\n');

/**
 * Payments (abonos) collected at checkout, before the pedido exists.
 * `observacionEditada` is the observación de pago typed by hand (null while
 * it just follows the abonos).
 */
export function usePosAbonos(
    abonos: PosAbono[],
    setAbonos: Dispatch<SetStateAction<PosAbono[]>>,
    observacionEditada: string | null,
    setObservacionEditada: (observacion: string | null) => void,
) {
    /**
     * Applies a change of abonos, carrying an edited observación along: the
     * list the abonos used to build is swapped for the new one, keeping
     * whatever the user wrote after it.
     */
    const cambiarAbonos = (siguientes: PosAbono[]) => {
        if (observacionEditada !== null) {
            const anterior = observacionDeAbonos(abonos);
            const nueva = observacionDeAbonos(siguientes);

            if (observacionEditada.startsWith(anterior)) {
                const resto = observacionEditada.slice(anterior.length);

                setObservacionEditada(
                    anterior === '' && nueva !== '' && resto !== ''
                        ? `${nueva}\n${resto}`
                        : nueva + resto,
                );
            }
        }

        setAbonos(siguientes);
    };

    const addAbono = (abono: PosNewAbono) => {
        cambiarAbonos([
            ...abonos,
            {
                ...abono,
                id: abonos.reduce((max, item) => Math.max(max, item.id), 0) + 1,
            },
        ]);
    };

    const removeAbono = (id: number) => {
        cambiarAbonos(abonos.filter((abono) => abono.id !== id));
    };

    const clear = () => {
        setAbonos([]);
        setObservacionEditada(null);
    };

    const totalAbonado = useMemo(
        () => abonos.reduce((sum, abono) => sum + abono.monto, 0),
        [abonos],
    );

    /** The pedido's observación de pago: what was typed, or else the abonos' list. */
    const observacionPago = useMemo(
        () => observacionEditada ?? observacionDeAbonos(abonos),
        [abonos, observacionEditada],
    );

    return {
        abonos,
        addAbono,
        removeAbono,
        clear,
        totalAbonado,
        observacionPago,
    };
}
