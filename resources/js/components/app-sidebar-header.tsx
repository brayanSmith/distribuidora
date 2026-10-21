import { usePage, usePoll } from '@inertiajs/react';
import { Upload } from 'lucide-react';
import { useEffect } from 'react';
import { Breadcrumbs } from '@/components/breadcrumbs';
import ImportarModal from '@/components/importaciones/importar-modal';
import { Button } from '@/components/ui/button';
import { SidebarTrigger } from '@/components/ui/sidebar';
import type { BreadcrumbItem as BreadcrumbItemType } from '@/types';

export function AppSidebarHeader({
    breadcrumbs = [],
}: {
    breadcrumbs?: BreadcrumbItemType[];
}) {
    const { tiposImportacion, importacionesSinLeer, importacionesEnCurso } =
        usePage().props;
    const puedeImportar = tiposImportacion.length > 0;

    // While an import runs, check now and then whether it finished so the
    // unread counter shows up without leaving the page.
    const { start, stop } = usePoll(
        10000,
        { only: ['importacionesSinLeer', 'importacionesEnCurso'] },
        { autoStart: false },
    );
    useEffect(() => {
        if (puedeImportar && importacionesEnCurso > 0) {
            start();
        } else {
            stop();
        }
    }, [puedeImportar, importacionesEnCurso, start, stop]);

    return (
        <header className="border-sidebar-border/50 flex h-16 shrink-0 items-center gap-2 border-b px-6 transition-[width,height] ease-linear group-has-data-[collapsible=icon]/sidebar-wrapper:h-12 md:px-4">
            <div className="flex items-center gap-2">
                <SidebarTrigger className="-ml-1" />
                <Breadcrumbs breadcrumbs={breadcrumbs} />
            </div>

            {puedeImportar ? (
                <div className="ml-auto flex items-center gap-2">
                    <ImportarModal>
                        <Button
                            variant="outline"
                            size="sm"
                            aria-label="Importar"
                            data-test="header-importar"
                            className="group/importar relative gap-0 px-2 has-[>svg]:px-2"
                        >
                            <Upload />
                            {/* Only the icon until the cursor is over it. */}
                            <span className="max-w-0 overflow-hidden whitespace-nowrap opacity-0 transition-all duration-200 group-hover/importar:ml-2 group-hover/importar:max-w-40 group-hover/importar:opacity-100 group-focus-visible/importar:ml-2 group-focus-visible/importar:max-w-40 group-focus-visible/importar:opacity-100">
                                Importar
                            </span>
                            {importacionesSinLeer > 0 ? (
                                <span
                                    data-test="header-importaciones-sin-leer"
                                    className="absolute -top-1.5 -right-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] leading-none font-semibold text-white tabular-nums"
                                >
                                    {importacionesSinLeer > 99
                                        ? '99+'
                                        : importacionesSinLeer}
                                </span>
                            ) : null}
                        </Button>
                    </ImportarModal>
                </div>
            ) : null}
        </header>
    );
}
