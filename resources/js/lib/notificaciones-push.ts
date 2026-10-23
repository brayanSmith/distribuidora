import { http } from '@inertiajs/react';
import { destroy, store } from '@/routes/push-suscripciones';

/**
 * Push notifications of this device: asking for permission, subscribing the
 * browser and telling the server where to send them. The service worker
 * (`public/sw.js`) is the one that shows them, even with the app closed.
 */

export type EstadoPush =
    /** The browser can't (old browser, or plain http outside localhost). */
    | 'no-soportado'
    /** Never asked yet. */
    | 'pendiente'
    | 'activadas'
    /** The user said no: only they can turn them on in the browser settings. */
    | 'bloqueadas';

export function estadoPush(): EstadoPush {
    if (
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
    ) {
        return 'no-soportado';
    }

    return {
        granted: 'activadas',
        denied: 'bloqueadas',
        default: 'pendiente',
    }[Notification.permission] as EstadoPush;
}

/** The public VAPID key (base64url) as the bytes pushManager expects. */
function claveComoBytes(clave: string): Uint8Array<ArrayBuffer> {
    const base64 = (clave + '='.repeat((4 - (clave.length % 4)) % 4))
        .replace(/-/g, '+')
        .replace(/_/g, '/');

    return Uint8Array.from(atob(base64), (caracter) => caracter.charCodeAt(0));
}

/** Subscribes this browser (or takes its subscription) and saves it for the user. */
async function guardarSuscripcion(vapidPublicKey: string): Promise<void> {
    const registro = await navigator.serviceWorker.register('/sw.js');
    await navigator.serviceWorker.ready;

    const suscripcion =
        (await registro.pushManager.getSubscription()) ??
        (await registro.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: claveComoBytes(vapidPublicKey),
        }));

    await http.getClient().request({
        method: 'post',
        url: store().url,
        data: {
            ...suscripcion.toJSON(),
            content_encoding: PushManager.supportedContentEncodings?.includes(
                'aes128gcm',
            )
                ? 'aes128gcm'
                : 'aesgcm',
        },
        headers: { Accept: 'application/json' },
    });
}

/** Asks for permission (the browser's dialog) and turns the notifications on. */
export async function activarPush(vapidPublicKey: string): Promise<EstadoPush> {
    if (estadoPush() === 'no-soportado') {
        return 'no-soportado';
    }

    if ((await Notification.requestPermission()) !== 'granted') {
        return estadoPush();
    }

    await guardarSuscripcion(vapidPublicKey);

    return 'activadas';
}

/**
 * With permission already given, makes sure the server sends this device's
 * notifications to whoever is logged in now (a shared POS computer, a
 * subscription the browser renewed).
 */
export async function sincronizarPush(vapidPublicKey: string): Promise<void> {
    if (estadoPush() === 'activadas') {
        await guardarSuscripcion(vapidPublicKey);
    }
}

/** Stops this device's notifications. */
export async function desactivarPush(): Promise<void> {
    const registro = await navigator.serviceWorker.getRegistration('/sw.js');
    const suscripcion = await registro?.pushManager.getSubscription();

    if (!suscripcion) {
        return;
    }

    await http.getClient().request({
        method: 'delete',
        url: destroy().url,
        data: { endpoint: suscripcion.endpoint },
        headers: { Accept: 'application/json' },
    });
    await suscripcion.unsubscribe();
}
