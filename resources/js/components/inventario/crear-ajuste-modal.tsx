import { useForm } from '@inertiajs/react';
import { ArrowRight, ClipboardCheck, Minus, Plus } from 'lucide-react';
import { useMemo, useState } from 'react';
import type { PropsWithChildren } from 'react';
import Combobox from '@/components/combobox';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
    DialogTrigger,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group';
import { cn } from '@/lib/utils';
import { store } from '@/routes/ajustes-inventario';
import type { BodegaOption, ProductoOption } from '@/types';

export type TipoAjuste = 'CONTEO' | 'ENTRADA' | 'SALIDA';

export type StockActual = {
    producto_id: number;
    bodega_id: number;
    stock: string | number;
};

type Props = PropsWithChildren<{
    productos: ProductoOption[];
    bodegas: BodegaOption[];
    stocks: StockActual[];
    motivos: string[];
}>;

const TIPOS: {
    value: TipoAjuste;
    label: string;
    icono: typeof Plus;
    ayuda: string;
}[] = [
    {
        value: 'CONTEO',
        label: 'Conteo físico',
        icono: ClipboardCheck,
        ayuda: 'Escribe cuántas unidades contaste: el sistema ajusta la diferencia.',
    },
    {
        value: 'ENTRADA',
        label: 'Entrada',
        icono: Plus,
        ayuda: 'Unidades que aparecieron o se agregan (sobrantes, devoluciones sin documento).',
    },
    {
        value: 'SALIDA',
        label: 'Salida',
        icono: Minus,
        ayuda: 'Unidades que se retiran (dañadas, perdidas, vencidas, obsequios).',
    },
];

const numero = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 2 });

/**
 * A manual correction of a producto's stock in a bodega. Before saving it
 * shows what there is, what there will be and the difference.
 */
export default function CrearAjusteModal({
    productos,
    bodegas,
    stocks,
    motivos,
    children,
}: Props) {
    const [open, setOpen] = useState(false);
    const form = useForm({
        tipo: 'CONTEO' as TipoAjuste,
        producto_id: '',
        bodega_id: bodegas.length === 1 ? String(bodegas[0].id) : '',
        cantidad: '',
        motivo: '',
        nota: '',
    });
    const { data, setData, errors, processing } = form;

    const productoOptions = useMemo(
        () =>
            productos.map((producto) => ({
                value: String(producto.id),
                label:
                    producto.concatenar_codigo_nombre ??
                    producto.referencia_producto ??
                    `Producto ${producto.id}`,
            })),
        [productos],
    );

    const stockActual = useMemo(
        () =>
            Number(
                stocks.find(
                    (fila) =>
                        String(fila.producto_id) === data.producto_id &&
                        String(fila.bodega_id) === data.bodega_id,
                )?.stock ?? 0,
            ),
        [stocks, data.producto_id, data.bodega_id],
    );

    const cantidad = Number(data.cantidad) || 0;
    const diferencia =
        data.tipo === 'CONTEO'
            ? cantidad - stockActual
            : data.tipo === 'ENTRADA'
              ? cantidad
              : -cantidad;
    const listo =
        data.producto_id !== '' &&
        data.bodega_id !== '' &&
        data.cantidad !== '';
    const tipo = TIPOS.find((opcion) => opcion.value === data.tipo)!;

    const cambiarAbierto = (abierto: boolean) => {
        setOpen(abierto);

        if (!abierto) {
            form.reset();
            form.clearErrors();
        }
    };

    const guardar = (event: React.FormEvent) => {
        event.preventDefault();
        form.post(store().url, {
            preserveScroll: true,
            onSuccess: () => cambiarAbierto(false),
        });
    };

    return (
        <Dialog open={open} onOpenChange={cambiarAbierto}>
            <DialogTrigger asChild>{children}</DialogTrigger>
            <DialogContent className="sm:max-w-lg">
                <form onSubmit={guardar} className="grid gap-4">
                    <DialogHeader>
                        <DialogTitle>Nuevo ajuste de inventario</DialogTitle>
                        <DialogDescription>
                            Corrige el stock de un producto en una bodega. Queda
                            en sus movimientos con el motivo.
                        </DialogDescription>
                    </DialogHeader>

                    <div className="grid gap-2">
                        <ToggleGroup
                            type="single"
                            variant="outline"
                            value={data.tipo}
                            onValueChange={(valor) =>
                                valor && setData('tipo', valor as TipoAjuste)
                            }
                            className="justify-start"
                            data-test="ajuste-tipo"
                        >
                            {TIPOS.map((opcion) => (
                                <ToggleGroupItem
                                    key={opcion.value}
                                    value={opcion.value}
                                    className="data-[state=on]:bg-primary data-[state=on]:text-primary-foreground gap-1.5 px-3"
                                >
                                    <opcion.icono />
                                    {opcion.label}
                                </ToggleGroupItem>
                            ))}
                        </ToggleGroup>
                        <p className="text-muted-foreground text-xs">
                            {tipo.ayuda}
                        </p>
                    </div>

                    <div className="grid gap-2">
                        <Label required>Producto</Label>
                        <Combobox
                            options={productoOptions}
                            value={data.producto_id}
                            onValueChange={(valor) =>
                                setData('producto_id', valor)
                            }
                            placeholder="Seleccione un producto..."
                            searchPlaceholder="Buscar producto..."
                            emptyText="No se encontraron productos."
                            dataTest="ajuste-producto"
                        />
                        <InputError message={errors.producto_id} />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        <div className="grid gap-2">
                            <Label required>Bodega</Label>
                            <Combobox
                                options={bodegas.map((bodega) => ({
                                    value: String(bodega.id),
                                    label: bodega.nombre_bodega,
                                }))}
                                value={data.bodega_id}
                                onValueChange={(valor) =>
                                    setData('bodega_id', valor)
                                }
                                placeholder="Bodega..."
                                searchPlaceholder="Buscar bodega..."
                                emptyText="No se encontraron bodegas."
                                dataTest="ajuste-bodega"
                            />
                            <InputError message={errors.bodega_id} />
                        </div>
                        <div className="grid gap-2">
                            <Label required htmlFor="ajuste-cantidad">
                                {data.tipo === 'CONTEO'
                                    ? 'Cantidad contada'
                                    : 'Unidades'}
                            </Label>
                            <Input
                                id="ajuste-cantidad"
                                type="number"
                                min="0"
                                step="any"
                                value={data.cantidad}
                                onChange={(event) =>
                                    setData('cantidad', event.target.value)
                                }
                                data-test="ajuste-cantidad"
                            />
                            <InputError message={errors.cantidad} />
                        </div>
                    </div>

                    {data.producto_id && data.bodega_id ? (
                        <div
                            className="bg-muted/40 flex flex-wrap items-center justify-center gap-3 rounded-md border p-3 text-sm"
                            data-test="ajuste-resumen"
                        >
                            <div className="text-center">
                                <div className="text-muted-foreground text-xs">
                                    En el sistema
                                </div>
                                <div className="text-lg font-semibold tabular-nums">
                                    {numero.format(stockActual)}
                                </div>
                            </div>
                            <ArrowRight className="text-muted-foreground size-4" />
                            <div className="text-center">
                                <div className="text-muted-foreground text-xs">
                                    Quedará
                                </div>
                                <div className="text-lg font-semibold tabular-nums">
                                    {listo
                                        ? numero.format(
                                              stockActual + diferencia,
                                          )
                                        : '—'}
                                </div>
                            </div>
                            {listo ? (
                                <span
                                    className={cn(
                                        'rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums',
                                        diferencia > 0 &&
                                            'bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300',
                                        diferencia < 0 &&
                                            'bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300',
                                        diferencia === 0 &&
                                            'bg-muted text-muted-foreground',
                                    )}
                                >
                                    {diferencia > 0 ? '+' : ''}
                                    {numero.format(diferencia)}
                                </span>
                            ) : null}
                        </div>
                    ) : null}

                    <div className="grid gap-2">
                        <Label required htmlFor="ajuste-motivo">
                            Motivo
                        </Label>
                        <div className="flex flex-wrap gap-1.5">
                            {motivos.map((motivo) => (
                                <button
                                    key={motivo}
                                    type="button"
                                    onClick={() => setData('motivo', motivo)}
                                    className={cn(
                                        'rounded-full border px-2.5 py-0.5 text-xs transition-colors',
                                        data.motivo === motivo
                                            ? 'bg-primary text-primary-foreground border-primary'
                                            : 'hover:bg-accent',
                                    )}
                                >
                                    {motivo}
                                </button>
                            ))}
                        </div>
                        <Input
                            id="ajuste-motivo"
                            value={data.motivo}
                            onChange={(event) =>
                                setData('motivo', event.target.value)
                            }
                            placeholder="O escribe otro motivo"
                            maxLength={100}
                            data-test="ajuste-motivo"
                        />
                        <InputError message={errors.motivo} />
                    </div>

                    <div className="grid gap-2">
                        <Label htmlFor="ajuste-nota">Nota</Label>
                        <Input
                            id="ajuste-nota"
                            value={data.nota}
                            onChange={(event) =>
                                setData('nota', event.target.value)
                            }
                            placeholder="Detalle opcional"
                            maxLength={255}
                        />
                    </div>

                    <DialogFooter className="gap-2">
                        <DialogClose asChild>
                            <Button type="button" variant="secondary">
                                Cancelar
                            </Button>
                        </DialogClose>
                        <Button
                            type="submit"
                            disabled={processing}
                            data-test="ajuste-guardar"
                        >
                            Guardar ajuste
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
