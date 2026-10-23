import { router, usePage } from '@inertiajs/react';
import {
    CloudAlert,
    CloudUpload,
    RotateCcw,
    ShoppingCart,
    Trash2,
} from 'lucide-react';
import { useEffect } from 'react';
import { currencyFormatter } from '@/components/record-view';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import {
    descartar,
    iniciarColaSincronizacion,
    reabrir,
    reintentar,
    useColaSincronizacion,
} from '@/lib/cola-sincronizacion';
import type { TipoOperacion } from '@/lib/cola-sincronizacion';
import { cn } from '@/lib/utils';
import { pos as comprasPos } from '@/routes/compras';
import { index as posIndex } from '@/routes/pos';

/** Where each kind is reopened, and how it is called. */
const TIPOS: Record<
    TipoOperacion,
    { etiqueta: string; pos: () => { url: string }; boton: string }
> = {
    venta: { etiqueta: 'Venta', pos: posIndex, boton: 'Abrir en el POS' },
    compra: {
        etiqueta: 'Compra',
        pos: comprasPos,
        boton: 'Abrir en el POS de compras',
    },
};

/**
 * Header button for the sales and compras still being sent in the
 * background. It keeps the queue running on every page and only shows up
 * while there is something pending: how many, and the ones the server
 * rejected, to retry, reopen in their POS or discard.
 */
export default function ColaSincronizacionIndicador() {
    const usuarioId = usePage().props.auth.user?.id;
    const cola = useColaSincronizacion();

    useEffect(() => {
        if (usuarioId) {
            return iniciarColaSincronizacion(usuarioId);
        }
    }, [usuarioId]);

    if (cola.length === 0) {
        return null;
    }

    const conError = cola.filter(
        (operacion) => operacion.estado === 'error',
    ).length;
    const enviando = cola.some((operacion) => operacion.estado === 'enviando');

    const abrirEnSuPos = (codigo: string, tipo: TipoOperacion) => {
        reabrir(codigo);

        // Its POS opens it again; from another page, go there.
        const destino = TIPOS[tipo].pos().url;

        if (
            window.location.pathname !==
            new URL(destino, window.location.origin).pathname
        ) {
            router.visit(destino);
        }
    };

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button
                    variant="outline"
                    size="sm"
                    className={cn(
                        'relative gap-1.5 px-2',
                        conError > 0 &&
                            'border-red-300 text-red-600 dark:border-red-900 dark:text-red-400',
                    )}
                    aria-label="Por sincronizar"
                    data-test="header-cola-sincronizacion"
                >
                    {conError > 0 ? (
                        <CloudAlert />
                    ) : enviando ? (
                        <Spinner />
                    ) : (
                        <CloudUpload />
                    )}
                    <span className="text-xs tabular-nums">{cola.length}</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80">
                <DropdownMenuLabel>
                    Por sincronizar
                    <p className="text-muted-foreground text-xs font-normal">
                        Ya se registraron en el POS; se envían solas al
                        servidor.
                    </p>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <div className="max-h-80 space-y-1 overflow-y-auto p-1">
                    {cola.map((operacion) => (
                        <div
                            key={operacion.codigo}
                            className={cn(
                                'rounded-md border p-2 text-sm',
                                operacion.estado === 'error' &&
                                    'border-red-200 bg-red-50 dark:border-red-900 dark:bg-red-950/30',
                            )}
                            data-test="cola-operacion"
                        >
                            <div className="flex items-center justify-between gap-2">
                                <span className="truncate font-medium">
                                    <span className="text-muted-foreground font-normal">
                                        {TIPOS[operacion.tipo].etiqueta} ·{' '}
                                    </span>
                                    {operacion.resumen.tercero}
                                </span>
                                <span className="shrink-0 font-semibold">
                                    {currencyFormatter.format(
                                        operacion.resumen.total,
                                    )}
                                </span>
                            </div>
                            <div className="text-muted-foreground flex items-center gap-1.5 text-xs">
                                {operacion.estado === 'enviando' ? (
                                    <Spinner className="size-3" />
                                ) : null}
                                {new Date(
                                    operacion.creadaEn,
                                ).toLocaleTimeString('es-CO', {
                                    hour: '2-digit',
                                    minute: '2-digit',
                                })}{' '}
                                · {operacion.resumen.productos}{' '}
                                {operacion.resumen.productos === 1
                                    ? 'producto'
                                    : 'productos'}
                                {operacion.estado === 'enviando'
                                    ? ' · enviando...'
                                    : ''}
                            </div>
                            {operacion.problema ? (
                                <p
                                    className={cn(
                                        'mt-1 text-xs',
                                        operacion.estado === 'error'
                                            ? 'text-red-700 dark:text-red-400'
                                            : 'text-amber-700 dark:text-amber-400',
                                    )}
                                >
                                    {operacion.problema}
                                </p>
                            ) : null}
                            {operacion.estado === 'error' ? (
                                <div className="mt-2 flex flex-wrap gap-1">
                                    <Button
                                        size="sm"
                                        variant="outline"
                                        className="h-7 text-xs"
                                        onClick={() =>
                                            abrirEnSuPos(
                                                operacion.codigo,
                                                operacion.tipo,
                                            )
                                        }
                                        data-test="cola-operacion-reabrir"
                                    >
                                        <ShoppingCart />
                                        {TIPOS[operacion.tipo].boton}
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs"
                                        onClick={() =>
                                            reintentar(operacion.codigo)
                                        }
                                    >
                                        <RotateCcw />
                                        Reintentar
                                    </Button>
                                    <Button
                                        size="sm"
                                        variant="ghost"
                                        className="h-7 text-xs text-red-600"
                                        onClick={() => {
                                            if (
                                                window.confirm(
                                                    `¿Descartar esta ${TIPOS[operacion.tipo].etiqueta.toLowerCase()}? No se registrará.`,
                                                )
                                            ) {
                                                descartar(operacion.codigo);
                                            }
                                        }}
                                    >
                                        <Trash2 />
                                        Descartar
                                    </Button>
                                </div>
                            ) : null}
                        </div>
                    ))}
                </div>
            </DropdownMenuContent>
        </DropdownMenu>
    );
}
