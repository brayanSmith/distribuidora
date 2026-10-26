import { Check, Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import Pagination from '@/components/pagination';
import CreateProveedorModal from '@/components/proveedores/create-proveedor-modal';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { iniciales } from '@/components/pos/pos-cliente-card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { ProveedorPos } from '@/types';

type Props = {
    proveedores: ProveedorPos[];
    selectedId: string;
    /** Whether the user may register a new proveedor from here. */
    canCreate: boolean;
    onSelect: (proveedorId: string) => void;
    onClose: () => void;
};

const PAGE_SIZE = 10;

function textoBusqueda(proveedor: ProveedorPos): string {
    return [
        proveedor.nombre_proveedor,
        proveedor.razon_social_proveedor,
        proveedor.nit_proveedor,
        proveedor.telefono_proveedor,
        proveedor.ciudad_proveedor,
    ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
}

/**
 * Proveedor picker for the compras POS, like the cliente one of the sales
 * POS: a searchable list with their data and a "Nuevo proveedor" shortcut.
 * A proveedor created here is selected once it shows up in the list.
 */
export default function ProveedorModal({
    proveedores,
    selectedId,
    canCreate,
    onSelect,
    onClose,
}: Props) {
    const [busqueda, setBusqueda] = useState('');
    const [pagina, setPagina] = useState(1);
    // Proveedores present when the modal opened; anything else was created
    // from here (the refreshed list may arrive before or after the success).
    const idsIniciales = useRef(new Set(proveedores.map(({ id }) => id)));
    const ultimos = useRef(proveedores);
    const esperandoNuevo = useRef(false);

    ultimos.current = proveedores;

    const seleccionarNuevo = () => {
        if (!esperandoNuevo.current) {
            return;
        }

        const nuevo = ultimos.current
            .filter(({ id }) => !idsIniciales.current.has(id))
            .sort((a, b) => b.id - a.id)[0];

        if (nuevo) {
            esperandoNuevo.current = false;
            idsIniciales.current.add(nuevo.id);
            onSelect(String(nuevo.id));
        }
    };

    useEffect(seleccionarNuevo, [proveedores]);

    const filtrados = useMemo(() => {
        const termino = busqueda.trim().toLowerCase();

        return termino
            ? proveedores.filter((proveedor) =>
                  textoBusqueda(proveedor).includes(termino),
              )
            : proveedores;
    }, [proveedores, busqueda]);

    const totalPaginas = Math.max(Math.ceil(filtrados.length / PAGE_SIZE), 1);
    const paginaActual = Math.min(pagina, totalPaginas);
    const visibles = filtrados.slice(
        (paginaActual - 1) * PAGE_SIZE,
        paginaActual * PAGE_SIZE,
    );

    return (
        <Dialog open onOpenChange={(abierto) => !abierto && onClose()}>
            <DialogContent
                className="flex max-h-[85vh] flex-col sm:max-w-2xl"
                data-test="compras-pos-proveedor-modal"
            >
                <DialogHeader>
                    <DialogTitle>Seleccionar proveedor</DialogTitle>
                </DialogHeader>

                <div className="flex items-center gap-2">
                    <div className="relative flex-1">
                        <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                        <Input
                            value={busqueda}
                            onChange={(event) => {
                                setBusqueda(event.target.value);
                                setPagina(1);
                            }}
                            placeholder="Buscar por nombre, NIT, teléfono, ciudad..."
                            className="pl-9"
                            autoFocus
                            data-test="compras-pos-proveedor-buscar"
                        />
                    </div>

                    {canCreate ? (
                        <CreateProveedorModal
                            onCreated={() => {
                                esperandoNuevo.current = true;
                                seleccionarNuevo();
                            }}
                        >
                            <Button
                                type="button"
                                variant="outline"
                                title="Nuevo proveedor"
                                aria-label="Nuevo proveedor"
                                data-test="compras-pos-proveedor-nuevo"
                            >
                                <Plus />
                                <span className="hidden md:inline">
                                    Nuevo proveedor
                                </span>
                            </Button>
                        </CreateProveedorModal>
                    ) : null}
                </div>

                <div className="-mr-2 grid gap-2 overflow-y-auto pr-2">
                    {filtrados.length === 0 ? (
                        <p className="text-muted-foreground py-8 text-center text-sm">
                            No se encontraron proveedores.
                        </p>
                    ) : (
                        visibles.map((proveedor) => {
                            const elegido = String(proveedor.id) === selectedId;

                            return (
                                <button
                                    key={proveedor.id}
                                    type="button"
                                    onClick={() =>
                                        onSelect(String(proveedor.id))
                                    }
                                    data-test="compras-pos-proveedor-opcion"
                                    className={cn(
                                        'hover:bg-accent grid gap-0.5 rounded-md border p-3 text-left text-sm',
                                        elegido &&
                                            'border-primary bg-primary/5',
                                    )}
                                >
                                    <span className="flex items-center justify-between gap-2 font-semibold">
                                        {proveedor.nombre_proveedor}
                                        {elegido ? (
                                            <Check className="text-primary size-4" />
                                        ) : null}
                                    </span>
                                    <span className="text-muted-foreground grid gap-x-4 sm:grid-cols-2">
                                        <span>
                                            NIT:{' '}
                                            {proveedor.nit_proveedor ?? '—'}
                                        </span>
                                        <span>
                                            Teléfono:{' '}
                                            {proveedor.telefono_proveedor ??
                                                '—'}
                                        </span>
                                        <span>
                                            Ciudad:{' '}
                                            {proveedor.ciudad_proveedor ?? '—'}
                                        </span>
                                        <span>
                                            Tipo:{' '}
                                            {proveedor.tipo_proveedor ?? '—'}
                                        </span>
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>

                {filtrados.length > PAGE_SIZE ? (
                    <Pagination
                        page={paginaActual}
                        totalPages={totalPaginas}
                        onPageChange={setPagina}
                        dataTest="compras-pos-proveedor-pagina"
                    />
                ) : null}
            </DialogContent>
        </Dialog>
    );
}

/** The selected proveedor, compact: who it is and how to reach them. */
export function ProveedorCard({ proveedor }: { proveedor: ProveedorPos }) {
    const contacto = [
        proveedor.nit_proveedor ? `NIT ${proveedor.nit_proveedor}` : null,
        proveedor.telefono_proveedor,
        proveedor.ciudad_proveedor,
    ].filter(Boolean);

    return (
        <div
            className="bg-muted/40 flex items-center gap-3 rounded-md border p-3 text-sm"
            data-test="compras-pos-proveedor-card"
        >
            <span className="bg-primary/10 text-primary flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-bold">
                {iniciales(proveedor.nombre_proveedor)}
            </span>
            <div className="min-w-0">
                <p className="truncate font-semibold">
                    {proveedor.nombre_proveedor}
                </p>
                <p className="text-muted-foreground truncate text-xs">
                    {contacto.length > 0
                        ? contacto.join(' · ')
                        : 'Sin datos de contacto'}
                </p>
                {proveedor.direccion_proveedor ? (
                    <p
                        className="text-muted-foreground truncate text-xs"
                        title={proveedor.direccion_proveedor}
                    >
                        {proveedor.direccion_proveedor}
                    </p>
                ) : null}
            </div>
        </div>
    );
}
