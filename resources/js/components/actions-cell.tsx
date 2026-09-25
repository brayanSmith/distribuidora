import type { PropsWithChildren } from 'react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

type Props = PropsWithChildren<{
    className?: string;
}>;

/**
 * The content of a table's "Acciones" cell: the row's icon buttons (with
 * their tooltips) aligned to the right. When the column is resized narrower
 * than the buttons need, they stack on several lines instead of being cut
 * off, so use it for every actions column.
 */
export default function ActionsCell({ className, children }: Props) {
    return (
        <TooltipProvider>
            <div
                className={cn('flex flex-wrap justify-end gap-2', className)}
                data-slot="actions-cell"
            >
                {children}
            </div>
        </TooltipProvider>
    );
}
