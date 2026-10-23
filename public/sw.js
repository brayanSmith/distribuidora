/*
 * Service worker for push notifications. The browser keeps it alive in the
 * background, so the notifications show up even with the app closed.
 */

self.addEventListener('push', (event) => {
    const { title = 'Distribuidora', ...opciones } = event.data
        ? event.data.json()
        : {};

    event.waitUntil(self.registration.showNotification(title, opciones));
});

// Clicking a notification opens its page: in a window of the app if there is
// one open, in a new one otherwise.
self.addEventListener('notificationclick', (event) => {
    event.notification.close();

    const url = new URL(
        event.notification.data?.url ?? '/',
        self.location.origin,
    ).href;

    event.waitUntil(
        self.clients
            .matchAll({ type: 'window', includeUncontrolled: true })
            .then((ventanas) => {
                const abierta = ventanas.find(
                    (ventana) =>
                        new URL(ventana.url).origin === self.location.origin,
                );

                if (abierta) {
                    return abierta
                        .focus()
                        .then((ventana) => ventana.navigate(url));
                }

                return self.clients.openWindow(url);
            }),
    );
});
