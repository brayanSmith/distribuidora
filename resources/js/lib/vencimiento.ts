/** Days a separado waits for the cliente unless another day is picked (as on the server). */
export const DIAS_RECOGIDA_SEPARADO = 7;

/** Today plus some days, as Y-m-d in local time: the suggested due date of a credit. */
export function fechaMasDias(dias: number): string {
    const fecha = new Date();
    fecha.setDate(fecha.getDate() + dias);

    return [
        fecha.getFullYear(),
        String(fecha.getMonth() + 1).padStart(2, '0'),
        String(fecha.getDate()).padStart(2, '0'),
    ].join('-');
}

/** Days from today to a Y-m-d date (negative when it already passed). */
export function diasHasta(fecha: string): number {
    const dia = 24 * 60 * 60 * 1000;

    return Math.round(
        (Date.parse(`${fecha}T00:00:00`) -
            Date.parse(`${fechaMasDias(0)}T00:00:00`)) /
            dia,
    );
}

/** A Y-m-d date as the user reads it. */
export function formatoFecha(valor: string | null | undefined): string {
    return valor
        ? new Date(`${valor}T00:00:00`).toLocaleDateString('es-CO')
        : '—';
}

/** "Vencido hace 3 días", "Vence hoy", "Vence en 5 días" (`a`: vencida for compras). */
export function plazo(dias: number | null, a: 'o' | 'a' = 'o'): string {
    if (dias === null) {
        return 'Sin fecha de vencimiento';
    }

    if (dias < 0) {
        return `Vencid${a} hace ${-dias} ${dias === -1 ? 'día' : 'días'}`;
    }

    if (dias === 0) {
        return 'Vence hoy';
    }

    return `Vence en ${dias} ${dias === 1 ? 'día' : 'días'}`;
}
