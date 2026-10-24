import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, HandCoins, ShoppingCart } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import PedidoAbonosCard from '@/components/pedidos/pedido-abonos-card';
import PosAddProductModal from '@/components/pos/pos-add-product-modal';
import PosCartPanel from '@/components/pos/pos-cart-panel';
import type { PosCartEdicion } from '@/components/pos/pos-cart-panel';
import PosCatalog from '@/components/pos/pos-catalog';
import PosClienteHistorialModal from '@/components/pos/pos-cliente-historial-modal';
import PosClienteModal from '@/components/pos/pos-cliente-modal';
import PosRevisarCambiosModal from '@/components/pos/pos-revisar-cambios-modal';
import type { CambioLinea } from '@/components/pos/pos-revisar-cambios-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import {
    Sheet,
    SheetContent,
    SheetDescription,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { useMediaQuery } from '@/hooks/use-media-query';
import { cartLineKey, usePosCart } from '@/hooks/use-pos-cart';
import type { PosCartLine, TipoPrecioLinea } from '@/hooks/use-pos-cart';
import { defaultPosHeader, usePosHeader } from '@/hooks/use-pos-header';
import type { PosHeaderState } from '@/hooks/use-pos-header';
import {
    precioDeLinea,
    precioParaTipo,
    tipoLineaDe,
} from '@/lib/pedido-pricing';
import { calcularTotales } from '@/lib/pos-totals';
import { etiquetaTipoPago } from '@/lib/tipos-pago';
import * as pedidosAbonosRoutes from '@/routes/pedidos/abonos';
import * as pedidosRoutes from '@/routes/pedidos';
import type {
    BodegaOption,
    CategoriaOption,
    ClienteOption,
    Pedido,
    PedidoEditPermissions,
    PosCatalogoProducto,
    PucOption,
    TipoPrecioPedido,
    VendedorOption,
} from '@/types';

type Props = {
    pedido: Pedido & { tipo_pago?: string | null };
    clientes: ClienteOption[];
    productos: PosCatalogoProducto[];
    bodegas: BodegaOption[];
    vendedores: VendedorOption[];
    pucs: PucOption[];
    categorias: CategoriaOption[];
    canCreateProducto: boolean;
    canCreateCliente: boolean;
    permissions: Omit<PedidoEditPermissions, 'canDelete'>;
};

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

const numero = (valor: string | number | null | undefined): string =>
    String(Number(valor ?? 0));

/** The pedido as the POS keeps a sale: its header and its cart lines. */
function encabezadoDe(pedido: Props['pedido']): PosHeaderState {
    return {
        ...defaultPosHeader(pedido.tipo_precio),
        clienteId: String(pedido.cliente_id),
        bodegaId: String(pedido.bodega_id),
        vendedorId: String(pedido.user_id),
        descuento: numero(pedido.descuento),
        flete: numero(pedido.flete),
        reteica: numero(pedido.reteica),
        retefuente: numero(pedido.retefuente),
        observacion: pedido.observacion ?? '',
        observacionPago: pedido.observacion_pago ?? '',
        aplicaTurno: pedido.turno !== null,
        facturacionElectronica: Boolean(pedido.facturacion_electronica),
    };
}

/**
 * The POS in edit mode: a saved pedido loaded in the cart, changed with the
 * same catalog, cart and product window it was sold with, and saved after
 * reviewing what changed. Its payments are kept (and managed apart).
 */
export default function PosEdicionPage({
    pedido,
    clientes,
    productos,
    bodegas,
    vendedores,
    pucs,
    categorias,
    canCreateProducto,
    canCreateCliente,
    permissions,
}: Props) {
    const isDesktop = useMediaQuery('(min-width: 1024px)');
    const pageErrors = (usePage().props.errors ?? {}) as Partial<
        Record<string, string>
    >;

    const productoPorId = useMemo(
        () => new Map(productos.map((producto) => [producto.id, producto])),
        [productos],
    );
    const nombreDe = (producto: PosCatalogoProducto | undefined, id: number) =>
        producto?.concatenar_codigo_nombre ??
        producto?.referencia_producto ??
        `Producto ${id}`;
    const nombreBodega = (bodegaId: number) =>
        bodegas.find((bodega) => bodega.id === bodegaId)?.nombre_bodega ??
        (pedido.bodega?.id === bodegaId ? pedido.bodega.nombre_bodega : '');

    // What the pedido had: the starting point and what changes are compared with.
    const original = useMemo(() => {
        const lineas: PosCartLine[] = (pedido.detalles ?? []).map((detalle) => {
            const bodegaId = detalle.bodega_id ?? pedido.bodega_id;

            return {
                key: cartLineKey(detalle.producto_id, bodegaId),
                productoId: detalle.producto_id,
                bodegaId,
                nombre: nombreDe(
                    productoPorId.get(detalle.producto_id),
                    detalle.producto_id,
                ),
                bodegaNombre: nombreBodega(bodegaId),
                cantidad: Number(detalle.cantidad),
                precioUnitario: Number(detalle.precio_unitario),
                tipoPrecio: detalle.tipo_precio,
            };
        });

        return { header: encabezadoDe(pedido), lineas };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [pedido]);

    const [headerState, setHeaderState] = useState(original.header);
    const [lineas, setLineas] = useState(original.lineas);
    const { header, setField } = usePosHeader(headerState, setHeaderState);
    const cart = usePosCart(lineas, setLineas);

    const [clienteModalOpen, setClienteModalOpen] = useState(false);
    const [historialOpen, setHistorialOpen] = useState(false);
    const [revisarOpen, setRevisarOpen] = useState(false);
    const [abonosOpen, setAbonosOpen] = useState(false);
    const [cartOpen, setCartOpen] = useState(false);
    const [processing, setProcessing] = useState(false);
    const [pendiente, setPendiente] = useState<{
        producto: PosCatalogoProducto;
        bodegaId: string;
    } | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);
    const nuevoProductoRef = useRef<HTMLButtonElement>(null);

    const cliente =
        clientes.find((item) => String(item.id) === header.clienteId) ?? null;
    const clavesOriginales = useMemo(
        () => new Set(original.lineas.map((linea) => linea.key)),
        [original],
    );

    const totalAntes = Number(pedido.total_a_pagar);
    const totalDespues = calcularTotales(cart.totalBruto, header).total;
    const abonado = Number(pedido.abono);

    const cambiosLineas: CambioLinea[] = useMemo(() => {
        const antes = new Map(
            original.lineas.map((linea) => [linea.key, linea]),
        );
        const despues = new Map(lineas.map((linea) => [linea.key, linea]));
        const cambios: CambioLinea[] = [];

        antes.forEach((linea, key) => {
            const ahora = despues.get(key);

            if (!ahora) {
                cambios.push({
                    key,
                    nombre: linea.nombre,
                    tipo: 'quitada',
                    antes: linea,
                });
            } else if (
                ahora.cantidad !== linea.cantidad ||
                ahora.precioUnitario !== linea.precioUnitario
            ) {
                cambios.push({
                    key,
                    nombre: linea.nombre,
                    tipo: 'modificada',
                    antes: linea,
                    despues: ahora,
                });
            }
        });

        despues.forEach((linea, key) => {
            if (!antes.has(key)) {
                cambios.push({
                    key,
                    nombre: linea.nombre,
                    tipo: 'agregada',
                    despues: linea,
                });
            }
        });

        return cambios;
    }, [original, lineas]);

    const cambiosDatos: string[] = useMemo(() => {
        const cambios: string[] = [];
        const clienteAntes = clientes.find(
            (item) => String(item.id) === original.header.clienteId,
        );

        if (header.clienteId !== original.header.clienteId) {
            cambios.push(
                `Cliente: ${clienteAntes?.razon_social ?? '—'} → ${cliente?.razon_social ?? '—'}`,
            );
        }

        if (header.bodegaId !== original.header.bodegaId) {
            cambios.push(
                `Bodega: ${nombreBodega(Number(original.header.bodegaId))} → ${nombreBodega(Number(header.bodegaId))}`,
            );
        }

        if (header.tipoPrecio !== original.header.tipoPrecio) {
            cambios.push(
                `Tipo de precio: ${original.header.tipoPrecio} → ${header.tipoPrecio}`,
            );
        }

        if (
            header.facturacionElectronica !==
            original.header.facturacionElectronica
        ) {
            cambios.push(
                `Facturación electrónica: ${header.facturacionElectronica ? 'Sí' : 'No'}`,
            );
        }

        if (header.observacion !== original.header.observacion) {
            cambios.push('Observación');
        }

        if (
            (header.observacionPago ?? '') !==
            (original.header.observacionPago ?? '')
        ) {
            cambios.push('Observación de pago');
        }

        return cambios;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [header, original, cliente]);

    const hayCambios =
        JSON.stringify(header) !== JSON.stringify(original.header) ||
        JSON.stringify(lineas) !== JSON.stringify(original.lineas);

    // Changing the tipo de precio re-prices the cart, as in the POS.
    const handleFieldChange: typeof setField = (key, value) => {
        setField(key, value);

        if (key === 'tipoPrecio') {
            cart.reprice(
                (productoId) => {
                    const producto = productoPorId.get(productoId);

                    return producto
                        ? precioParaTipo(producto, value as TipoPrecioPedido)
                        : undefined;
                },
                tipoLineaDe(value as TipoPrecioPedido),
            );
        }
    };

    const precioLinea = (productoId: number, tipoPrecio: TipoPrecioLinea) => {
        const producto = productoPorId.get(productoId);

        return producto ? precioDeLinea(producto, tipoPrecio) : undefined;
    };

    const edicion: PosCartEdicion = {
        titulo: `Editando pedido #${pedido.id}`,
        turno: pedido.turno,
        puedeCambiarDatos: permissions.canUpdateDatos,
        lineaEditable: (linea) =>
            clavesOriginales.has(linea.key)
                ? permissions.canUpdateDetalle
                : true,
        lineaRemovible: (linea) =>
            clavesOriginales.has(linea.key)
                ? permissions.canDeleteDetalle
                : true,
    };

    const agregar = (producto: PosCatalogoProducto) => {
        const key = cartLineKey(producto.id, Number(header.bodegaId));

        if (
            !cart.lines.some((linea) => linea.key === key) &&
            !permissions.canCreateDetalle
        ) {
            toast.error(
                'No tienes permiso para agregar productos a un pedido.',
            );

            return;
        }

        setPendiente({ producto, bodegaId: header.bodegaId });
    };

    const editarLinea = (linea: PosCartLine) => {
        const producto = productoPorId.get(linea.productoId);

        if (producto && edicion.lineaEditable(linea)) {
            setPendiente({ producto, bodegaId: String(linea.bodegaId) });
        }
    };

    const stockDisponibleDe = (producto: PosCatalogoProducto): number =>
        header.bodegaId
            ? (producto.stock_por_bodega[header.bodegaId] ?? 0) -
              (cart.lineFor(producto.id, Number(header.bodegaId))?.cantidad ??
                  0)
            : producto.stock_total -
              (cart.reservedByProducto.get(producto.id) ?? 0);

    const descartar = () => {
        if (
            hayCambios &&
            !window.confirm('¿Descartar los cambios hechos al pedido?')
        ) {
            return;
        }

        setHeaderState(original.header);
        setLineas(original.lineas);
    };

    const guardar = () => {
        router.patch(
            pedidosRoutes.update([pedido.id]).url,
            {
                cliente_id: header.clienteId,
                // The pedido keeps the day it was sold.
                fecha: pedido.fecha,
                user_id: header.vendedorId,
                bodega_id: header.bodegaId,
                tipo_precio: header.tipoPrecio,
                facturacion_electronica: header.facturacionElectronica,
                observacion: header.observacion,
                observacion_pago: header.observacionPago,
                descuento: header.descuento || 0,
                flete: header.flete || 0,
                reteica: header.reteica || 0,
                retefuente: header.retefuente || 0,
                detalles: lineas.map((linea) => ({
                    producto_id: linea.productoId,
                    bodega_id: linea.bodegaId,
                    cantidad: linea.cantidad,
                    tipo_precio:
                        linea.tipoPrecio ?? tipoLineaDe(header.tipoPrecio),
                    precio_unitario: linea.precioUnitario,
                })),
            },
            {
                preserveScroll: true,
                onStart: () => setProcessing(true),
                onFinish: () => setProcessing(false),
                onSuccess: () => setRevisarOpen(false),
                onError: (errores) => {
                    if (errores.pedido) {
                        toast.error(errores.pedido);
                    }
                },
            },
        );
    };

    const puedeRevisar =
        cart.lines.length > 0 &&
        header.clienteId !== '' &&
        header.bodegaId !== '';

    useHotkeys(
        [
            {
                key: 'F2',
                handler: () => {
                    searchRef.current?.focus();
                    searchRef.current?.select();
                },
            },
            {
                key: 'F3',
                handler: () =>
                    permissions.canUpdateDatos && setClienteModalOpen(true),
            },
            { key: 'F8', handler: descartar },
            {
                key: 'F9',
                handler: () => puedeRevisar && setRevisarOpen(true),
            },
        ],
        { ignoreWhenDialog: true },
    );

    const cartPanel = (
        <PosCartPanel
            edicion={edicion}
            precioDeLinea={precioLinea}
            cliente={cliente}
            onOpenClientePicker={() => setClienteModalOpen(true)}
            onOpenHistorial={() => setHistorialOpen(true)}
            onProceedToPay={() => setRevisarOpen(true)}
            onReset={descartar}
            canProceder={puedeRevisar}
            bodegas={bodegas}
            vendedores={vendedores}
            header={header}
            onFieldChange={handleFieldChange}
            cart={cart}
            onEditLine={editarLinea}
            errors={pageErrors}
            processing={processing}
        />
    );

    return (
        <>
            <Head title={`Editar pedido #${pedido.id}`} />

            <div
                className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/30"
                data-test="pos-edicion-banner"
            >
                <Button variant="ghost" size="sm" asChild>
                    <Link
                        href={pedidosRoutes.index()}
                        onClick={(event) => {
                            if (
                                hayCambios &&
                                !window.confirm(
                                    '¿Salir sin guardar los cambios del pedido?',
                                )
                            ) {
                                event.preventDefault();
                            }
                        }}
                    >
                        <ArrowLeft />
                        Pedidos
                    </Link>
                </Button>
                <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                        Editando pedido #{pedido.id}
                        {pedido.turno ? ` · Turno ${pedido.turno}` : ''}
                    </div>
                    <div className="text-muted-foreground text-xs">
                        {pedido.cliente?.razon_social ?? 'Sin cliente'} ·{' '}
                        {etiquetaTipoPago(pedido.tipo_pago)} · vendido el{' '}
                        {pedido.fecha
                            ? new Date(pedido.fecha).toLocaleDateString('es-CO')
                            : '—'}
                    </div>
                </div>
                {hayCambios ? (
                    <Badge className="border-transparent bg-amber-500 text-white hover:bg-amber-500">
                        Cambios sin guardar
                    </Badge>
                ) : null}
                <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setAbonosOpen(true)}
                    data-test="pos-edicion-abonos"
                >
                    <HandCoins />
                    Abonos · {moneda.format(abonado)}
                </Button>
            </div>

            <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[1fr_460px] 2xl:grid-cols-[1fr_520px]">
                <PosCatalog
                    productos={productos}
                    stockDisponibleDe={stockDisponibleDe}
                    reservedByProducto={cart.reservedByProducto}
                    precioPorProducto={cart.precioPorProducto}
                    tipoPrecio={header.tipoPrecio}
                    onAdd={agregar}
                    categorias={categorias}
                    canCreateProducto={canCreateProducto}
                    searchRef={searchRef}
                    nuevoProductoRef={nuevoProductoRef}
                    onRefresh={() => router.reload({ only: ['productos'] })}
                    refreshing={false}
                />

                {isDesktop ? (
                    <div className="lg:sticky lg:top-20">{cartPanel}</div>
                ) : null}
            </div>

            {!isDesktop ? (
                <>
                    <Button
                        type="button"
                        size="lg"
                        className="fixed right-4 bottom-4 z-40 h-14 gap-2 rounded-full shadow-lg"
                        onClick={() => setCartOpen(true)}
                        aria-label="Abrir el pedido"
                    >
                        <ShoppingCart className="size-5" />
                        <span className="font-semibold">
                            {moneda.format(totalDespues)}
                        </span>
                    </Button>
                    <Sheet open={cartOpen} onOpenChange={setCartOpen}>
                        <SheetContent
                            side="bottom"
                            className="max-h-[92vh] gap-0 rounded-t-2xl"
                        >
                            <SheetHeader className="border-b py-3 pr-12">
                                <SheetTitle>Pedido #{pedido.id}</SheetTitle>
                                <SheetDescription className="sr-only">
                                    Datos y productos del pedido
                                </SheetDescription>
                            </SheetHeader>
                            <div className="overflow-y-auto p-2">
                                {cartPanel}
                            </div>
                        </SheetContent>
                    </Sheet>
                </>
            ) : null}

            {clienteModalOpen ? (
                <PosClienteModal
                    clientes={clientes}
                    selectedId={header.clienteId}
                    canCreate={canCreateCliente}
                    onSelect={(clienteId) => {
                        setField('clienteId', clienteId);
                        setClienteModalOpen(false);
                    }}
                    onClose={() => setClienteModalOpen(false)}
                />
            ) : null}

            {historialOpen && cliente ? (
                <PosClienteHistorialModal
                    cliente={cliente}
                    onClose={() => setHistorialOpen(false)}
                />
            ) : null}

            {pendiente ? (
                <PosAddProductModal
                    key={`${pendiente.producto.id}:${pendiente.bodegaId}`}
                    producto={pendiente.producto}
                    bodegas={bodegas}
                    defaultBodegaId={pendiente.bodegaId}
                    tipoPrecio={header.tipoPrecio}
                    lineFor={cart.lineFor}
                    onClose={() => setPendiente(null)}
                    onConfirm={(selection) => {
                        cart.upsertLine({
                            productoId: pendiente.producto.id,
                            nombre: nombreDe(
                                pendiente.producto,
                                pendiente.producto.id,
                            ),
                            ...selection,
                        });
                        setPendiente(null);
                    }}
                />
            ) : null}

            {revisarOpen ? (
                <PosRevisarCambiosModal
                    header={header}
                    onFieldChange={setField}
                    puedeCambiarAjustes={permissions.canUpdateDatos}
                    cambiosLineas={cambiosLineas}
                    cambiosDatos={[
                        ...cambiosDatos,
                        ...(
                            [
                                'descuento',
                                'flete',
                                'reteica',
                                'retefuente',
                            ] as const
                        )
                            .filter(
                                (ajuste) =>
                                    Number(header[ajuste] || 0) !==
                                    Number(original.header[ajuste] || 0),
                            )
                            .map(
                                (ajuste) =>
                                    `${ajuste[0].toUpperCase()}${ajuste.slice(1)}: ${moneda.format(Number(original.header[ajuste] || 0))} → ${moneda.format(Number(header[ajuste] || 0))}`,
                            ),
                    ]}
                    totalAntes={totalAntes}
                    totalDespues={totalDespues}
                    abonado={abonado}
                    errors={pageErrors}
                    processing={processing}
                    onGuardar={guardar}
                    onClose={() => setRevisarOpen(false)}
                />
            ) : null}

            <Dialog open={abonosOpen} onOpenChange={setAbonosOpen}>
                <DialogContent className="sm:max-w-3xl">
                    <DialogHeader>
                        <DialogTitle>
                            Abonos del pedido #{pedido.id}
                        </DialogTitle>
                        <DialogDescription>
                            Los pagos del pedido se manejan aparte de sus
                            productos.
                        </DialogDescription>
                    </DialogHeader>
                    {hayCambios ? (
                        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                            Guarda o descarta los cambios del pedido antes de
                            registrar pagos, para no perderlos.
                        </p>
                    ) : (
                        <PedidoAbonosCard
                            pedido={pedido}
                            routes={{
                                pedidos: pedidosRoutes,
                                abonos: pedidosAbonosRoutes,
                            }}
                            pucs={pucs}
                            vendedores={vendedores}
                            canCreate={permissions.canCreateAbono}
                            canUpdate={permissions.canUpdateAbono}
                            canDelete={permissions.canDeleteAbono}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}
