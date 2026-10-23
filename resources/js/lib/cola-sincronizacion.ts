import { http } from '@inertiajs/react';
import { useSyncExternalStore } from 'react';
import { sincronizar as sincronizarCompra } from '@/routes/compras';
import { sincronizar as sincronizarVenta } from '@/routes/pos';
import type { PosVoucher } from '@/types';

/**
 * POS sales and Compras POS compras sent to the server in the background.
 *
 * With slow or unstable internet the POS shouldn't make anyone wait: the
 * operation is closed right away and saved here (localStorage), and this
 * queue sends it on its own, retrying until the server takes it. Each one
 * carries a `codigo_sincronizacion`, so sending it again (the answer got
 * lost on the way) never creates it twice.
 */

export type TipoOperacion = 'venta' | 'compra';

export type OperacionEnCola = {
    tipo: TipoOperacion;
    codigo: string;
    /** When it was made (ISO). */
    creadaEn: string;
    /** What the POS sends, as it was at that moment. */
    datos: Record<string, unknown>;
    /** Who it is with (cliente or proveedor), the total and how many products. */
    resumen: { tercero: string; total: number; productos: number };
    /** The operation as it was in its POS, to reopen it if the server rejects it. */
    borrador: unknown;
    /** pendiente: waiting / retrying; error: rejected, needs someone to look at it. */
    estado: 'pendiente' | 'enviando' | 'error';
    /** Why it is not sent yet (no connection…) or why it was rejected. */
    problema: string | null;
    intentos: number;
};

const NOMBRES: Record<TipoOperacion, string> = {
    venta: 'venta',
    compra: 'compra',
};

const RUTAS: Record<TipoOperacion, () => { url: string }> = {
    venta: sincronizarVenta,
    compra: sincronizarCompra,
};

/** Seconds to wait before each retry; the last one repeats. */
const ESPERAS = [2, 5, 10, 20, 30];

/** A request that takes longer than this is given up and retried. */
const TIEMPO_MAXIMO_MS = 30000;

let usuarioId: number | null = null;
let cola: OperacionEnCola[] = [];
const oyentes = new Set<() => void>();
/** Vouchers of the sales just synced, for the POS success modal. */
const vouchers = new Map<string, PosVoucher>();
const proximoIntento = new Map<string, number>();
let temporizador: number | undefined;
let trabajando = false;

const claveCola = () => `pos:cola-sincronizacion:v1:${usuarioId}`;
const claveReabrir = (tipo: TipoOperacion) =>
    `pos:reabrir-${tipo}:v1:${usuarioId}`;

function leer<T>(clave: string): T[] {
    try {
        const crudo = window.localStorage.getItem(clave);
        const datos = crudo ? JSON.parse(crudo) : [];

        return Array.isArray(datos) ? datos : [];
    } catch {
        return [];
    }
}

function escribir(clave: string, valor: unknown[]): void {
    try {
        window.localStorage.setItem(clave, JSON.stringify(valor));
    } catch {
        // Storage full or unavailable: the queue keeps working in memory.
    }
}

function avisar(): void {
    oyentes.forEach((oyente) => oyente());
}

function guardar(nueva: OperacionEnCola[]): void {
    cola = nueva;
    escribir(claveCola(), cola);
    avisar();
}

function actualizar(codigo: string, cambios: Partial<OperacionEnCola>): void {
    guardar(
        cola.map((operacion) =>
            operacion.codigo === codigo
                ? { ...operacion, ...cambios }
                : operacion,
        ),
    );
}

function programar(): void {
    window.clearTimeout(temporizador);

    const pendientes = cola.filter(
        (operacion) => operacion.estado === 'pendiente',
    );

    if (pendientes.length === 0) {
        return;
    }

    const cuando = Math.min(
        ...pendientes.map(
            (operacion) => proximoIntento.get(operacion.codigo) ?? 0,
        ),
    );

    temporizador = window.setTimeout(
        () => void procesar(),
        Math.max(cuando - Date.now(), 0),
    );
}

/** The first message of a Laravel validation answer. */
function mensajeDeValidacion(cuerpo: string, tipo: TipoOperacion): string {
    const general = `El servidor rechazó la ${NOMBRES[tipo]}.`;

    try {
        const json = JSON.parse(cuerpo) as {
            message?: string;
            errors?: Record<string, string[]>;
        };

        return (
            Object.values(json.errors ?? {})[0]?.[0] ?? json.message ?? general
        );
    } catch {
        return general;
    }
}

async function enviar(operacion: OperacionEnCola): Promise<void> {
    actualizar(operacion.codigo, { estado: 'enviando' });

    try {
        const respuesta = await http.getClient().request({
            method: 'post',
            url: RUTAS[operacion.tipo]().url,
            data: {
                ...operacion.datos,
                codigo_sincronizacion: operacion.codigo,
            },
            headers: { Accept: 'application/json' },
            signal: AbortSignal.timeout(TIEMPO_MAXIMO_MS),
        });

        const cuerpo = JSON.parse(respuesta.data) as { voucher?: PosVoucher };

        if (cuerpo.voucher) {
            vouchers.set(operacion.codigo, cuerpo.voucher);
        }

        proximoIntento.delete(operacion.codigo);
        guardar(cola.filter((item) => item.codigo !== operacion.codigo));
        window.dispatchEvent(
            new CustomEvent('cola-sincronizacion:enviada', {
                detail: operacion.tipo,
            }),
        );
    } catch (error) {
        const respuesta = (
            error as { response?: { status: number; data: string } }
        ).response;
        const intentos = operacion.intentos + 1;

        // Rejected for good: someone has to fix it.
        if (
            respuesta &&
            (respuesta.status === 422 || respuesta.status === 403)
        ) {
            actualizar(operacion.codigo, {
                estado: 'error',
                intentos,
                problema:
                    respuesta.status === 403
                        ? `No tienes permiso para registrar la ${NOMBRES[operacion.tipo]}.`
                        : mensajeDeValidacion(respuesta.data, operacion.tipo),
            });

            return;
        }

        // No connection, a timeout, the server down, the session to renew:
        // it is tried again later.
        proximoIntento.set(
            operacion.codigo,
            Date.now() +
                ESPERAS[Math.min(intentos - 1, ESPERAS.length - 1)] * 1000,
        );
        actualizar(operacion.codigo, {
            estado: 'pendiente',
            intentos,
            problema: !navigator.onLine
                ? 'Sin conexión a internet. Se enviará cuando vuelva.'
                : respuesta &&
                    (respuesta.status === 401 || respuesta.status === 419)
                  ? 'La sesión expiró. Vuelve a iniciar sesión para enviarla.'
                  : 'La conexión falló. Reintentando...',
        });
    }
}

/** Sends what is pending, one by one, oldest first. */
async function procesar(): Promise<void> {
    if (trabajando || usuarioId === null) {
        return;
    }

    trabajando = true;

    try {
        let siguiente: OperacionEnCola | undefined;

        while (
            (siguiente = cola.find(
                (operacion) =>
                    operacion.estado === 'pendiente' &&
                    (proximoIntento.get(operacion.codigo) ?? 0) <= Date.now(),
            ))
        ) {
            await enviar(siguiente);
        }
    } finally {
        trabajando = false;
        programar();
    }
}

/**
 * Starts the queue for the logged-in user: loads what was left unsent (a
 * closed tab, a reload) and sends it. Safe to call many times.
 */
export function iniciarColaSincronizacion(id: number): () => void {
    if (usuarioId !== id) {
        usuarioId = id;
        // Whatever was being sent when the page closed is sent again.
        cola = leer<OperacionEnCola>(claveCola()).map((operacion) =>
            operacion.estado === 'enviando'
                ? { ...operacion, estado: 'pendiente' }
                : operacion,
        );
        avisar();
    }

    const reintentarTodo = () => {
        proximoIntento.clear();
        void procesar();
    };
    // Another tab changed the queue.
    const alCambiarOtraPestana = (event: StorageEvent) => {
        if (event.key === claveCola()) {
            cola = leer<OperacionEnCola>(claveCola());
            avisar();
        }
    };

    window.addEventListener('online', reintentarTodo);
    window.addEventListener('storage', alCambiarOtraPestana);
    void procesar();

    return () => {
        window.removeEventListener('online', reintentarTodo);
        window.removeEventListener('storage', alCambiarOtraPestana);
    };
}

/** A new code (a UUID), also where crypto.randomUUID is missing (plain http). */
export function nuevoCodigoSincronizacion(): string {
    if (typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }

    const bytes = crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;
    const hex = Array.from(bytes, (byte) =>
        byte.toString(16).padStart(2, '0'),
    ).join('');

    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/** Puts a finished operation in the queue and starts sending it. */
export function encolar(
    operacion: Omit<OperacionEnCola, 'estado' | 'problema' | 'intentos'>,
): void {
    guardar([
        ...cola,
        { ...operacion, estado: 'pendiente', problema: null, intentos: 0 },
    ]);
    void procesar();
}

export function reintentar(codigo: string): void {
    proximoIntento.delete(codigo);
    actualizar(codigo, { estado: 'pendiente', problema: null });
    void procesar();
}

export function descartar(codigo: string): void {
    guardar(cola.filter((operacion) => operacion.codigo !== codigo));
}

/**
 * Takes a rejected operation out of the queue and hands it back to its POS,
 * which opens it again to fix it.
 */
export function reabrir(codigo: string): void {
    const operacion = cola.find((item) => item.codigo === codigo);

    if (!operacion) {
        return;
    }

    const clave = claveReabrir(operacion.tipo);
    escribir(clave, [...leer<OperacionEnCola>(clave), operacion]);
    guardar(cola.filter((item) => item.codigo !== codigo));
    window.dispatchEvent(
        new CustomEvent('cola-sincronizacion:reabrir', {
            detail: operacion.tipo,
        }),
    );
}

/** The operations of a type waiting to be reopened in its POS (and forgets them). */
export function tomarParaReabrir(tipo: TipoOperacion): OperacionEnCola[] {
    const operaciones = leer<OperacionEnCola>(claveReabrir(tipo));

    if (operaciones.length > 0) {
        escribir(claveReabrir(tipo), []);
    }

    return operaciones;
}

function suscribir(oyente: () => void): () => void {
    oyentes.add(oyente);

    return () => oyentes.delete(oyente);
}

/** What is not sent yet, kept up to date. */
export function useColaSincronizacion(): OperacionEnCola[] {
    return useSyncExternalStore(suscribir, () => cola);
}

/** The voucher of a sale once the server took it; null meanwhile. */
export function useVoucherSincronizado(
    codigo: string | null,
): PosVoucher | null {
    return useSyncExternalStore(suscribir, () =>
        codigo ? (vouchers.get(codigo) ?? null) : null,
    );
}
