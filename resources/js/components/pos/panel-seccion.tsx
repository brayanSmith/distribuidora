import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

type Props = {
    titulo: string;
    /** A small action at the right of the title (e.g. "Remover lista"). */
    accion?: ReactNode;
    className?: string;
    children: ReactNode;
};

/**
 * A titled part of a POS side panel (Cliente, Productos, Opciones...), so
 * the panel reads at a glance.
 */
export default function PanelSeccion({
    titulo,
    accion,
    className,
    children,
}: Props) {
    return (
        <section className={cn('grid gap-2', className)}>
            <div className="flex items-center justify-between gap-2">
                <h3 className="text-muted-foreground text-xs font-semibold tracking-wide uppercase">
                    {titulo}
                </h3>
                {accion}
            </div>
            {children}
        </section>
    );
}
