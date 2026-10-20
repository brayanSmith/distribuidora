import { router } from '@inertiajs/react';
import { useCallback, useEffect, useState } from 'react';

/** A safety net so a spinner can never stay forever if no event clears it. */
const TIEMPO_MAXIMO_MS = 15000;

/**
 * The path of the section the user just clicked while its page loads, or null.
 * It is set on the click itself (not when the request starts) so the menu
 * reacts at once, and cleared when the visit ends, however it ends.
 */
export function useNavegando(): {
    pendiente: string | null;
    iniciar: (ruta: string) => void;
} {
    const [pendiente, setPendiente] = useState<string | null>(null);

    useEffect(() => {
        const limpiar = () => setPendiente(null);
        const quitarFin = router.on('finish', limpiar);
        const quitarNavegacion = router.on('navigate', limpiar);

        return () => {
            quitarFin();
            quitarNavegacion();
        };
    }, []);

    useEffect(() => {
        if (pendiente === null) {
            return;
        }

        const temporizador = setTimeout(
            () => setPendiente(null),
            TIEMPO_MAXIMO_MS,
        );

        return () => clearTimeout(temporizador);
    }, [pendiente]);

    const iniciar = useCallback((ruta: string) => setPendiente(ruta), []);

    return { pendiente, iniciar };
}
