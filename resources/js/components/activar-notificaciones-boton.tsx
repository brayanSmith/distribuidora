import { usePage } from '@inertiajs/react';
import { BellOff, BellRing } from 'lucide-react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import {
    activarPush,
    estadoPush,
    sincronizarPush,
} from '@/lib/notificaciones-push';
import type { EstadoPush } from '@/lib/notificaciones-push';

/** Once per page load, not on every Inertia visit. */
let sincronizada = false;

/**
 * Header button to turn on the operating system's notifications (pending
 * deliveries, cuentas por pagar). It shows only to whoever would get them
 * and only until they are on; once on, it keeps this device's subscription
 * up to date for the user logged in.
 */
export default function ActivarNotificacionesBoton() {
    const { vapidPublicKey, canViewEntregas, canViewCompras } = usePage().props;
    const [estado, setEstado] = useState<EstadoPush>(() => estadoPush());
    const [activando, setActivando] = useState(false);
    const leSirven = !!vapidPublicKey && (canViewEntregas || canViewCompras);

    useEffect(() => {
        if (leSirven && !sincronizada && vapidPublicKey) {
            sincronizada = true;
            sincronizarPush(vapidPublicKey).catch(() => {
                sincronizada = false;
            });
        }
    }, [leSirven, vapidPublicKey]);

    if (!leSirven || estado === 'activadas' || estado === 'no-soportado') {
        return null;
    }

    const activar = async () => {
        setActivando(true);

        try {
            const nuevo = await activarPush(vapidPublicKey as string);
            setEstado(nuevo);

            if (nuevo === 'activadas') {
                toast.success('Notificaciones activadas', {
                    description:
                        'Te avisaremos de las entregas y cuentas por pagar, aunque la app esté cerrada.',
                });
            }
        } catch {
            toast.error('No se pudieron activar las notificaciones.');
        } finally {
            setActivando(false);
        }
    };

    if (estado === 'bloqueadas') {
        return (
            <Tooltip>
                <TooltipTrigger asChild>
                    <span
                        className="text-muted-foreground flex size-8 items-center justify-center"
                        data-test="header-notificaciones-bloqueadas"
                    >
                        <BellOff className="size-4" />
                    </span>
                </TooltipTrigger>
                <TooltipContent className="max-w-64">
                    <p>
                        Bloqueaste las notificaciones. Para recibirlas, da clic
                        en el candado junto a la dirección del navegador y
                        permite las notificaciones.
                    </p>
                </TooltipContent>
            </Tooltip>
        );
    }

    return (
        <Button
            variant="outline"
            size="sm"
            loading={activando}
            onClick={activar}
            aria-label="Activar notificaciones"
            data-test="header-activar-notificaciones"
            className="group/notificaciones gap-0 px-2 has-[>svg]:px-2"
        >
            {activando ? null : <BellRing className="text-amber-500" />}
            {/* Only the icon until the cursor is over it. */}
            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/notificaciones:ml-2 group-hover/notificaciones:max-w-48 group-hover/notificaciones:opacity-100 group-focus-visible/notificaciones:ml-2 group-focus-visible/notificaciones:max-w-48 group-focus-visible/notificaciones:opacity-100">
                Activar notificaciones
            </span>
        </Button>
    );
}
