import { useTiposPrecio } from '@/hooks/use-tipos-precio';
import {
    History,
    PackageSearch,
    Plus,
    RotateCcw,
    ShoppingCart,
    Trash2,
    UserRound,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import Combobox from '@/components/combobox';
import InputError from '@/components/input-error';
import PanelSeccion from '@/components/pos/panel-seccion';
import PosCartItem from '@/components/pos/pos-cart-item';
import PosClienteCard from '@/components/pos/pos-cliente-card';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { PosCartLine, TipoPrecioLinea } from '@/hooks/use-pos-cart';
import { tipoLineaDe } from '@/lib/pedido-pricing';
import type { PosHeaderState } from '@/hooks/use-pos-header';
import { calcularTotales } from '@/lib/pos-totals';
import type {
    BodegaOption,
    ClienteOption,
    TipoPrecioPedido,
    VendedorOption,
} from '@/types';

type CartApi = {
    lines: PosCartLine[];
    setCantidad: (key: string, cantidad: number) => void;
    setPrecioUnitario: (key: string, precio: number) => void;
    setTipoPrecio: (
        key: string,
        tipoPrecio: TipoPrecioLinea,
        precio: number,
    ) => void;
    removeLine: (key: string) => void;
    clear: () => void;
    totalBruto: number;
};

/**
 * Editing a pedido already saved: what may change, the turno it keeps and
 * the actions of the edit instead of paying.
 */
export type PosCartEdicion = {
    /** E.g. "Editando pedido #120". */
    titulo: string;
    turno: string | null;
    /** Cliente, bodega, tipo de precio and facturación (pedidos.update-datos). */
    puedeCambiarDatos: boolean;
    lineaEditable: (line: PosCartLine) => boolean;
    lineaRemovible: (line: PosCartLine) => boolean;
};

type Props = {
    /** Present while editing a saved pedido. */
    edicion?: PosCartEdicion;
    /** The unit price of a product sold at a tipo de precio. */
    precioDeLinea: (
        productoId: number,
        tipoPrecio: TipoPrecioLinea,
    ) => number | undefined;
    cliente: ClienteOption | null;
    onOpenClientePicker: () => void;
    onOpenHistorial: () => void;
    onProceedToPay: () => void;
    onReset: () => void;
    /** Whether the pedido has what it needs to go to payment. */
    canProceder: boolean;
    bodegas: BodegaOption[];
    vendedores: VendedorOption[];
    header: PosHeaderState;
    onFieldChange: <K extends keyof PosHeaderState>(
        key: K,
        value: PosHeaderState[K],
    ) => void;
    cart: CartApi;
    onEditLine: (line: PosCartLine) => void;
    errors: Partial<Record<string, string>>;
    processing: boolean;
};

const currencyFormatter = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

/**
 * The right panel: the pedido's data and cart in a scrollable body, with
 * the totals and the pay / reset buttons pinned at the bottom so they are
 * always in reach however long the cart gets.
 */
export default function PosCartPanel({
    edicion,
    precioDeLinea,
    cliente,
    onOpenClientePicker,
    onOpenHistorial,
    onProceedToPay,
    onReset,
    canProceder,
    bodegas,
    vendedores,
    header,
    onFieldChange,
    cart,
    onEditLine,
    errors,
    processing,
}: Props) {
    const { tiposPedido } = useTiposPrecio();
    const bodegaOptions = useMemo(
        () =>
            bodegas.map((bodega) => ({
                value: String(bodega.id),
                label: bodega.nombre_bodega,
            })),
        [bodegas],
    );
    const vendedorOptions = useMemo(
        () =>
            vendedores.map((vendedor) => ({
                value: String(vendedor.id),
                label: vendedor.name,
            })),
        [vendedores],
    );

    const { subtotal, total } = calcularTotales(cart.totalBruto, header);
    const datosBloqueados = edicion !== undefined && !edicion.puedeCambiarDatos;
    const [verObservacion, setVerObservacion] = useState(false);
    const unidades = cart.lines.reduce((suma, line) => suma + line.cantidad, 0);
    const vendedor =
        vendedorOptions.find((option) => option.value === header.vendedorId)
            ?.label ?? '—';

    return (
        <div className="bg-card flex flex-col overflow-hidden rounded-lg border shadow-sm lg:max-h-[calc(100svh-6rem)]">
            <div className="bg-primary text-primary-foreground flex shrink-0 items-center justify-between gap-3 px-4 py-3">
                <div className="min-w-0">
                    <div className="flex items-center gap-2 font-semibold">
                        <ShoppingCart className="size-4 shrink-0" />
                        <span className="truncate">
                            {edicion ? edicion.titulo : 'Facturar'}
                        </span>
                    </div>
                    <div className="text-primary-foreground/75 text-xs">
                        {cart.lines.length}{' '}
                        {cart.lines.length === 1 ? 'producto' : 'productos'} ·{' '}
                        {unidades} {unidades === 1 ? 'unidad' : 'unidades'}
                    </div>
                </div>
                <span className="text-lg font-bold tabular-nums">
                    {currencyFormatter.format(total)}
                </span>
            </div>

            <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto p-4">
                <PanelSeccion
                    titulo="Cliente"
                    accion={
                        cliente ? (
                            <div className="flex items-center gap-1">
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={onOpenHistorial}
                                    data-test="pos-cliente-historial"
                                >
                                    <History className="size-3.5" />
                                    Historial
                                </Button>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 px-2 text-xs"
                                    onClick={onOpenClientePicker}
                                    disabled={datosBloqueados}
                                    data-test="pos-cliente"
                                >
                                    <UserRound className="size-3.5" />
                                    Cambiar
                                    <kbd className="opacity-60">F3</kbd>
                                </Button>
                            </div>
                        ) : null
                    }
                >
                    {cliente ? (
                        <PosClienteCard cliente={cliente} />
                    ) : (
                        <button
                            type="button"
                            onClick={onOpenClientePicker}
                            disabled={datosBloqueados}
                            data-test="pos-cliente"
                            className="hover:border-primary hover:bg-primary/5 text-muted-foreground hover:text-foreground flex w-full items-center gap-3 rounded-md border-2 border-dashed p-3 text-left text-sm transition-colors"
                        >
                            <UserRound className="size-5 shrink-0" />
                            <span className="flex-1 font-medium">
                                Seleccionar cliente
                            </span>
                            <kbd className="text-xs opacity-70">F3</kbd>
                        </button>
                    )}
                    <InputError message={errors.cliente_id} />
                </PanelSeccion>

                <PanelSeccion titulo="Datos de la venta">
                    <div className="grid grid-cols-2 gap-2">
                        <div className="grid gap-1.5">
                            <Label required className="text-xs">
                                Bodega
                            </Label>
                            {datosBloqueados ? (
                                <Input
                                    value={
                                        bodegaOptions.find(
                                            (option) =>
                                                option.value ===
                                                header.bodegaId,
                                        )?.label ?? ''
                                    }
                                    readOnly
                                    className="bg-muted/40"
                                    data-test="pos-bodega"
                                />
                            ) : (
                                <Combobox
                                    options={bodegaOptions}
                                    value={header.bodegaId}
                                    onValueChange={(value) =>
                                        onFieldChange('bodegaId', value)
                                    }
                                    searchPlaceholder="Buscar bodega..."
                                    emptyText="No se encontraron bodegas."
                                    dataTest="pos-bodega"
                                />
                            )}
                            <InputError message={errors.bodega_id} />
                        </div>

                        <div className="grid gap-1.5">
                            <Label required className="text-xs">
                                Tipo de precio
                            </Label>
                            <Select
                                disabled={datosBloqueados}
                                value={header.tipoPrecio}
                                onValueChange={(value) =>
                                    onFieldChange(
                                        'tipoPrecio',
                                        value as TipoPrecioPedido,
                                    )
                                }
                            >
                                <SelectTrigger
                                    className="w-full"
                                    data-test="pos-tipo-precio"
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    {tiposPedido.includes('DETAL') ? (
                                        <SelectItem value="DETAL">
                                            Detal
                                        </SelectItem>
                                    ) : null}
                                    {tiposPedido.includes('MAYORISTA') ? (
                                        <SelectItem value="MAYORISTA">
                                            Mayorista
                                        </SelectItem>
                                    ) : null}
                                    {tiposPedido.includes('OTRO') ? (
                                        <SelectItem value="OTRO">
                                            Costo
                                        </SelectItem>
                                    ) : null}
                                </SelectContent>
                            </Select>
                            <InputError message={errors.tipo_precio} />
                        </div>
                    </div>
                    {/* Always the logged-in user (or who sold an edited pedido): shown, not edited. */}
                    <p
                        className="text-muted-foreground text-xs"
                        data-test="pos-vendedor"
                    >
                        Vendedor:{' '}
                        <span className="text-foreground font-medium">
                            {vendedor}
                        </span>
                    </p>
                    <InputError message={errors.user_id} />
                </PanelSeccion>

                <PanelSeccion
                    titulo={`Productos${cart.lines.length > 0 ? ` (${cart.lines.length})` : ''}`}
                    accion={
                        cart.lines.length > 0 && !edicion ? (
                            <button
                                type="button"
                                onClick={cart.clear}
                                data-test="pos-remover-lista"
                                className="text-muted-foreground hover:text-destructive flex items-center gap-1 text-xs"
                            >
                                <Trash2 className="size-3.5" />
                                Remover lista
                            </button>
                        ) : null
                    }
                >
                    {cart.lines.length === 0 ? (
                        <div className="text-muted-foreground flex flex-col items-center gap-1.5 rounded-md border border-dashed py-6 text-center text-sm">
                            <PackageSearch className="size-6 opacity-60" />
                            Tu carrito está vacío.
                            <span className="text-xs">
                                Toca un producto del catálogo para agregarlo.
                            </span>
                        </div>
                    ) : (
                        <div className="grid gap-2">
                            {cart.lines.map((line) => (
                                <PosCartItem
                                    key={line.key}
                                    line={line}
                                    onCantidadChange={(cantidad) =>
                                        cart.setCantidad(line.key, cantidad)
                                    }
                                    onPrecioChange={(precio) =>
                                        cart.setPrecioUnitario(line.key, precio)
                                    }
                                    tipoPrecio={
                                        line.tipoPrecio ??
                                        tipoLineaDe(header.tipoPrecio)
                                    }
                                    onTipoPrecioChange={(tipo) =>
                                        cart.setTipoPrecio(
                                            line.key,
                                            tipo,
                                            precioDeLinea(
                                                line.productoId,
                                                tipo,
                                            ) ?? line.precioUnitario,
                                        )
                                    }
                                    onEdit={() => onEditLine(line)}
                                    onRemove={() => cart.removeLine(line.key)}
                                    editable={
                                        edicion?.lineaEditable(line) ?? true
                                    }
                                    removible={
                                        edicion?.lineaRemovible(line) ?? true
                                    }
                                />
                            ))}
                        </div>
                    )}
                    <InputError message={errors.detalles} />
                </PanelSeccion>

                <PanelSeccion titulo="Opciones">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                        {edicion ? (
                            // An edited pedido keeps its turno.
                            <span className="text-muted-foreground text-sm">
                                {edicion.turno
                                    ? `Turno ${edicion.turno}`
                                    : 'Sin turno'}
                            </span>
                        ) : (
                            <Label
                                htmlFor="pos-aplica-turno"
                                className="flex items-center gap-2"
                            >
                                <Switch
                                    id="pos-aplica-turno"
                                    checked={header.aplicaTurno}
                                    onCheckedChange={(checked) =>
                                        onFieldChange('aplicaTurno', checked)
                                    }
                                    data-test="pos-aplica-turno"
                                />
                                Aplica turno
                            </Label>
                        )}

                        <Label
                            htmlFor="pos-facturacion-electronica"
                            className="flex items-center gap-2"
                        >
                            <Checkbox
                                id="pos-facturacion-electronica"
                                disabled={datosBloqueados}
                                checked={header.facturacionElectronica}
                                onCheckedChange={(checked) =>
                                    onFieldChange(
                                        'facturacionElectronica',
                                        checked === true,
                                    )
                                }
                                data-test="pos-facturacion-electronica"
                            />
                            Facturación electrónica
                        </Label>
                    </div>

                    {verObservacion || header.observacion ? (
                        <div className="grid gap-1.5">
                            <Label
                                htmlFor="pos-observacion"
                                className="text-xs"
                            >
                                Observación
                            </Label>
                            <Textarea
                                id="pos-observacion"
                                rows={2}
                                autoFocus={
                                    verObservacion && !header.observacion
                                }
                                value={header.observacion}
                                onChange={(event) =>
                                    onFieldChange(
                                        'observacion',
                                        event.target.value,
                                    )
                                }
                                data-test="pos-observacion"
                            />
                        </div>
                    ) : (
                        <button
                            type="button"
                            onClick={() => setVerObservacion(true)}
                            className="text-primary flex items-center gap-1 justify-self-start text-sm hover:underline"
                            data-test="pos-agregar-observacion"
                        >
                            <Plus className="size-3.5" />
                            Agregar observación
                        </button>
                    )}
                    <InputError message={errors.observacion} />
                </PanelSeccion>
            </div>

            <div className="bg-muted/30 shrink-0 space-y-3 border-t p-4">
                <div className="space-y-0.5 text-sm">
                    <div className="text-muted-foreground flex justify-between">
                        <span>Total bruto</span>
                        <span className="tabular-nums">
                            {currencyFormatter.format(cart.totalBruto)}
                        </span>
                    </div>
                    {subtotal !== cart.totalBruto ? (
                        <div className="text-muted-foreground flex justify-between">
                            <span>Subtotal</span>
                            <span className="tabular-nums">
                                {currencyFormatter.format(subtotal)}
                            </span>
                        </div>
                    ) : null}
                    <div className="flex items-baseline justify-between pt-1">
                        <span className="font-semibold">Total</span>
                        <span className="text-2xl font-bold tabular-nums">
                            {currencyFormatter.format(total)}
                        </span>
                    </div>
                </div>

                <Button
                    type="button"
                    size="lg"
                    className="h-11 w-full text-base"
                    disabled={!canProceder || processing}
                    onClick={onProceedToPay}
                    data-test="pos-proceder-pago"
                >
                    {edicion ? 'Revisar y guardar' : 'Proceder al pago'}
                    <kbd className="text-xs opacity-70">F9</kbd>
                </Button>

                <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive w-full"
                    loading={processing}
                    onClick={onReset}
                    data-test="pos-resetear-pedido"
                >
                    <RotateCcw className="size-4" />
                    {edicion ? 'Descartar cambios' : 'Resetear pedido'}
                    <kbd className="text-xs opacity-70">F8</kbd>
                </Button>
            </div>
        </div>
    );
}
