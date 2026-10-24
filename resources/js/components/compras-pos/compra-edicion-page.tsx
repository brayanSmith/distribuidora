import { Head, Link, router, usePage } from '@inertiajs/react';
import { ArrowLeft, HandCoins, Trash2 } from 'lucide-react';
import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import CompraAbonosCard from '@/components/compras/compra-abonos-card';
import DeleteCompraModal from '@/components/compras/delete-compra-modal';
import CompraCatalogo from '@/components/compras-pos/compra-catalogo';
import CompraPanel from '@/components/compras-pos/compra-panel';
import CompraProductoModal from '@/components/compras-pos/compra-producto-modal';
import type { CompraPosSeleccion } from '@/components/compras-pos/compra-producto-modal';
import CompraRevisarCambiosModal from '@/components/compras-pos/compra-revisar-cambios-modal';
import type {
    CambioLineaCompra,
    DatosFactura,
} from '@/components/compras-pos/compra-revisar-cambios-modal';
import ProveedorModal from '@/components/compras-pos/proveedor-modal';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { index, update } from '@/routes/compras';
import { precios } from '@/routes/productos';
import type {
    AbonoCompra,
    BodegaOption,
    CategoriaOption,
    Compra,
    CompraDetalle,
    CompraPosEncabezado,
    CompraPosLinea,
    CompraPosProducto,
    ProveedorPos,
    PucOption,
} from '@/types';

type Props = {
    compra: Compra & {
        abonos?: AbonoCompra[];
        detalles_compra?: CompraDetalle[];
    };
    productos: CompraPosProducto[];
    categorias: CategoriaOption[];
    proveedores: ProveedorPos[];
    bodegas: BodegaOption[];
    canCreateProveedor: boolean;
    canUpdatePrecios: boolean;
    canCreateProducto: boolean;
    canCreateAbono: boolean;
    canDeleteAbono: boolean;
    canDelete: boolean;
    pucs: PucOption[];
};

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

const claveLinea = (productoId: number, bodegaId: number) =>
    `${productoId}:${bodegaId}`;

/** Y-m-d of a date the server sent, as the date field takes it. */
function soloFecha(valor: string | null): string {
    if (!valor) {
        return '';
    }

    const fecha = new Date(valor);

    return Number.isNaN(fecha.getTime())
        ? valor.slice(0, 10)
        : [
              fecha.getFullYear(),
              String(fecha.getMonth() + 1).padStart(2, '0'),
              String(fecha.getDate()).padStart(2, '0'),
          ].join('-');
}

const totalDe = (lineas: CompraPosLinea[], descuento: string) =>
    Math.max(
        lineas.reduce(
            (suma, linea) => suma + linea.cantidad * linea.costoUnitario,
            0,
        ) - (Number(descuento) || 0),
        0,
    );

/**
 * The Compras POS in edit mode: a saved compra loaded in the cart, changed
 * with the same catalog and product window it was registered with. What
 * already arrived at the bodega can't be lowered here; removing it is a
 * return of the goods, asked first.
 */
export default function CompraEdicionPage({
    compra,
    productos,
    categorias,
    proveedores,
    bodegas,
    canCreateProveedor,
    canUpdatePrecios,
    canCreateProducto,
    canCreateAbono,
    canDeleteAbono,
    canDelete,
    pucs,
}: Props) {
    const pageErrors = (usePage().props.errors ?? {}) as Record<string, string>;
    const productoPorId = useMemo(
        () => new Map(productos.map((producto) => [producto.id, producto])),
        [productos],
    );

    // What the compra had: the starting point and what changes are compared with.
    const original = useMemo(() => {
        const detalles = compra.detalles_compra ?? [];
        const lineas: CompraPosLinea[] = detalles.map((detalle) => ({
            key: claveLinea(detalle.producto_id, detalle.bodega_id),
            productoId: detalle.producto_id,
            nombre:
                productoPorId.get(detalle.producto_id)?.nombre ??
                `Producto ${detalle.producto_id}`,
            bodegaId: detalle.bodega_id,
            cantidad: Number(detalle.cantidad),
            costoUnitario: Number(detalle.precio_unitario),
        }));
        const encabezado: CompraPosEncabezado = {
            proveedorId: String(compra.proveedor_id),
            factura: compra.factura,
            bodegaId: String(detalles[0]?.bodega_id ?? bodegas[0]?.id ?? ''),
            // The lines added now arrive as the compra did.
            recibido: compra.estado === 'RECIBIDA',
            descuento: String(Number(compra.descuento ?? 0)),
            observaciones: compra.observaciones ?? '',
        };
        const datos: DatosFactura = {
            factura: compra.factura,
            fecha: soloFecha(compra.fecha),
            fechaVencimiento: compra.fecha_vencimiento ?? '',
        };

        return {
            lineas,
            encabezado,
            datos,
            recibidas: new Map(
                detalles.map((detalle) => [
                    claveLinea(detalle.producto_id, detalle.bodega_id),
                    Number(detalle.cantidad_recibida),
                ]),
            ),
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [compra]);

    const [encabezado, setEncabezado] = useState(original.encabezado);
    const [lineas, setLineas] = useState(original.lineas);
    const [datos, setDatos] = useState(original.datos);
    const [seleccionado, setSeleccionado] = useState<CompraPosProducto | null>(
        null,
    );
    const [eligiendoProveedor, setEligiendoProveedor] = useState(false);
    const [revisando, setRevisando] = useState(false);
    const [viendoPagos, setViendoPagos] = useState(false);
    const [borrando, setBorrando] = useState(false);
    const [procesando, setProcesando] = useState(false);
    const busquedaRef = useRef<HTMLInputElement>(null);
    const nuevoProductoRef = useRef<HTMLButtonElement>(null);

    const proveedor =
        proveedores.find(({ id }) => String(id) === encabezado.proveedorId) ??
        null;
    // The factura is edited in the review step and shown in the panel too.
    const encabezadoVisible = { ...encabezado, factura: datos.factura };

    const enCompra = useMemo(() => {
        const porProducto = new Map<number, number>();
        lineas.forEach((linea) =>
            porProducto.set(
                linea.productoId,
                (porProducto.get(linea.productoId) ?? 0) + linea.cantidad,
            ),
        );

        return porProducto;
    }, [lineas]);

    const cambiosLineas: CambioLineaCompra[] = useMemo(() => {
        const antes = new Map(
            original.lineas.map((linea) => [linea.key, linea]),
        );
        const despues = new Map(lineas.map((linea) => [linea.key, linea]));
        const cambios: CambioLineaCompra[] = [];

        antes.forEach((linea, key) => {
            const ahora = despues.get(key);

            if (!ahora) {
                cambios.push({
                    key,
                    nombre: linea.nombre,
                    tipo: 'quitada',
                    antes: linea,
                    devueltas: original.recibidas.get(key) ?? 0,
                });
            } else if (
                ahora.cantidad !== linea.cantidad ||
                ahora.costoUnitario !== linea.costoUnitario
            ) {
                cambios.push({
                    key,
                    nombre: linea.nombre,
                    tipo: 'modificada',
                    antes: linea,
                    despues: ahora,
                    devueltas: 0,
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
                    devueltas: 0,
                });
            }
        });

        return cambios;
    }, [original, lineas]);

    const cambiosDatos: string[] = useMemo(() => {
        const cambios: string[] = [];
        const proveedorAntes = proveedores.find(
            ({ id }) => String(id) === original.encabezado.proveedorId,
        );

        if (encabezado.proveedorId !== original.encabezado.proveedorId) {
            cambios.push(
                `Proveedor: ${proveedorAntes?.nombre_proveedor ?? '—'} → ${proveedor?.nombre_proveedor ?? '—'}`,
            );
        }

        if (datos.factura.trim() !== original.datos.factura) {
            cambios.push(
                `Factura: ${original.datos.factura} → ${datos.factura.trim()}`,
            );
        }

        if (datos.fecha !== original.datos.fecha) {
            cambios.push(`Fecha: ${original.datos.fecha} → ${datos.fecha}`);
        }

        if (datos.fechaVencimiento !== original.datos.fechaVencimiento) {
            cambios.push(
                `Vencimiento: ${original.datos.fechaVencimiento || '—'} → ${datos.fechaVencimiento || '—'}`,
            );
        }

        if (
            Number(encabezado.descuento || 0) !==
            Number(original.encabezado.descuento || 0)
        ) {
            cambios.push(
                `Descuento: ${moneda.format(Number(original.encabezado.descuento || 0))} → ${moneda.format(Number(encabezado.descuento || 0))}`,
            );
        }

        if (encabezado.observaciones !== original.encabezado.observaciones) {
            cambios.push('Observaciones');
        }

        return cambios;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [encabezado, datos, original, proveedor]);

    const hayCambios = cambiosLineas.length > 0 || cambiosDatos.length > 0;

    const confirmarProducto = (
        producto: CompraPosProducto,
        seleccion: CompraPosSeleccion,
    ) => {
        const key = claveLinea(producto.id, seleccion.bodegaId);
        // What already arrived of a line is the least it can have.
        const minimo = original.recibidas.get(key) ?? 0;
        const linea: CompraPosLinea = {
            key,
            productoId: producto.id,
            nombre: producto.nombre,
            bodegaId: seleccion.bodegaId,
            cantidad: Math.max(seleccion.cantidad, minimo),
            costoUnitario: seleccion.costoUnitario,
        };

        setLineas((actuales) =>
            actuales.some((actual) => actual.key === key)
                ? actuales.map((actual) =>
                      actual.key === key ? linea : actual,
                  )
                : [...actuales, linea],
        );
        setSeleccionado(null);

        const cambiosPrecio = {
            ...(seleccion.valorDetal !== null
                ? { valor_detal: seleccion.valorDetal }
                : {}),
            ...(seleccion.valorMayorista !== null
                ? { valor_mayorista: seleccion.valorMayorista }
                : {}),
        };

        if (Object.keys(cambiosPrecio).length > 0) {
            router.patch(precios.url(producto.id), cambiosPrecio, {
                only: ['productos', 'flash'],
                preserveScroll: true,
                preserveState: true,
            });
        }
    };

    const cambiarLinea = (key: string, cambios: Partial<CompraPosLinea>) =>
        setLineas((actuales) =>
            actuales.map((linea) =>
                linea.key === key
                    ? {
                          ...linea,
                          ...cambios,
                          key: claveLinea(
                              linea.productoId,
                              cambios.bodegaId ?? linea.bodegaId,
                          ),
                      }
                    : linea,
            ),
        );

    const quitar = (key: string) => {
        const recibida = original.recibidas.get(key) ?? 0;
        const linea = lineas.find((item) => item.key === key);

        if (
            recibida > 0 &&
            !window.confirm(
                `${linea?.nombre ?? 'Esta línea'} ya se recibió: al guardar se sacarán ${recibida} unidades de la bodega. ¿Quitarla?`,
            )
        ) {
            return;
        }

        setLineas((actuales) => actuales.filter((item) => item.key !== key));
    };

    const descartar = () => {
        if (
            hayCambios &&
            !window.confirm('¿Descartar los cambios hechos a la compra?')
        ) {
            return;
        }

        setEncabezado(original.encabezado);
        setLineas(original.lineas);
        setDatos(original.datos);
    };

    const guardar = () => {
        router.patch(
            update([compra.id]).url,
            {
                factura: datos.factura.trim(),
                proveedor_id: encabezado.proveedorId,
                // Same day: keep the time it had.
                fecha:
                    datos.fecha === original.datos.fecha
                        ? compra.fecha
                        : datos.fecha,
                fecha_vencimiento: datos.fechaVencimiento || null,
                observaciones: encabezado.observaciones,
                descuento: encabezado.descuento || 0,
                detalles: lineas.map((linea) => {
                    const recibida = original.recibidas.get(linea.key);

                    return {
                        producto_id: linea.productoId,
                        bodega_id: linea.bodegaId,
                        cantidad: linea.cantidad,
                        precio_unitario: linea.costoUnitario,
                        // A line it had keeps what arrived; a new one, as told.
                        cantidad_recibida: recibida ?? 0,
                        recibido:
                            recibida === undefined
                                ? encabezado.recibido
                                : recibida >= linea.cantidad,
                    };
                }),
            },
            {
                preserveScroll: true,
                onStart: () => setProcesando(true),
                onFinish: () => setProcesando(false),
                onSuccess: () => setRevisando(false),
                onError: () => toast.error('Revisa los datos de la compra.'),
            },
        );
    };

    const puedeRevisar =
        lineas.length > 0 &&
        encabezado.proveedorId !== '' &&
        datos.factura.trim() !== '';

    useHotkeys(
        [
            {
                key: 'F2',
                handler: () => {
                    busquedaRef.current?.focus();
                    busquedaRef.current?.select();
                },
            },
            { key: 'F3', handler: () => setEligiendoProveedor(true) },
            { key: 'F4', handler: () => nuevoProductoRef.current?.click() },
            { key: 'F8', handler: descartar },
            { key: 'F9', handler: () => puedeRevisar && setRevisando(true) },
        ],
        { ignoreWhenDialog: true },
    );

    return (
        <>
            <Head title={`Editar compra ${compra.factura}`} />

            <div
                className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 dark:border-sky-900 dark:bg-sky-950/30"
                data-test="compra-edicion-banner"
            >
                <Button variant="ghost" size="sm" asChild>
                    <Link
                        href={index()}
                        onClick={(event) => {
                            if (
                                hayCambios &&
                                !window.confirm(
                                    '¿Salir sin guardar los cambios de la compra?',
                                )
                            ) {
                                event.preventDefault();
                            }
                        }}
                    >
                        <ArrowLeft />
                        Compras
                    </Link>
                </Button>
                <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                        Editando compra {compra.factura}
                    </div>
                    <div className="text-muted-foreground text-xs">
                        {compra.proveedor?.nombre_proveedor ?? 'Sin proveedor'}{' '}
                        ·{' '}
                        {compra.estado === 'RECIBIDA'
                            ? 'Recibida'
                            : 'Pendiente por recibir'}{' '}
                        · Total {moneda.format(Number(compra.total_a_pagar))}
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
                    onClick={() => setViendoPagos(true)}
                    data-test="compra-edicion-pagos"
                >
                    <HandCoins />
                    Pagos · {moneda.format(Number(compra.abono))}
                </Button>
                {canDelete ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="text-red-600"
                        onClick={() => setBorrando(true)}
                        data-test="compra-delete-button"
                    >
                        <Trash2 />
                        Borrar
                    </Button>
                ) : null}
            </div>

            <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
                <CompraCatalogo
                    productos={productos}
                    categorias={categorias}
                    canCreateProducto={canCreateProducto}
                    enCompra={enCompra}
                    onSeleccionar={setSeleccionado}
                    busquedaRef={busquedaRef}
                    nuevoProductoRef={nuevoProductoRef}
                />

                <div className="lg:sticky lg:top-20 lg:self-start">
                    <CompraPanel
                        edicion={{
                            titulo: `Editando compra ${compra.factura}`,
                            recibidas: original.recibidas,
                        }}
                        proveedor={proveedor}
                        onElegirProveedor={() => setEligiendoProveedor(true)}
                        bodegas={bodegas}
                        encabezado={encabezadoVisible}
                        onCampo={(campo, valor) =>
                            campo === 'factura'
                                ? setDatos((actual) => ({
                                      ...actual,
                                      factura: String(valor),
                                  }))
                                : setEncabezado((actual) => ({
                                      ...actual,
                                      [campo]: valor,
                                  }))
                        }
                        lineas={lineas}
                        onLinea={cambiarLinea}
                        onQuitar={quitar}
                        onLimpiar={descartar}
                        onRegistrar={() => puedeRevisar && setRevisando(true)}
                        procesando={procesando}
                        errores={pageErrors}
                    />
                </div>
            </div>

            {eligiendoProveedor ? (
                <ProveedorModal
                    proveedores={proveedores}
                    selectedId={encabezado.proveedorId}
                    canCreate={canCreateProveedor}
                    onSelect={(proveedorId) => {
                        setEncabezado((actual) => ({ ...actual, proveedorId }));
                        setEligiendoProveedor(false);
                    }}
                    onClose={() => setEligiendoProveedor(false)}
                />
            ) : null}

            {seleccionado ? (
                <CompraProductoModal
                    key={seleccionado.id}
                    producto={seleccionado}
                    bodegas={bodegas}
                    defaultBodegaId={encabezado.bodegaId}
                    lineaEn={(bodegaId) =>
                        lineas.find(
                            (linea) =>
                                linea.key ===
                                claveLinea(seleccionado.id, bodegaId),
                        )
                    }
                    canUpdatePrecios={canUpdatePrecios}
                    onConfirm={(seleccion) =>
                        confirmarProducto(seleccionado, seleccion)
                    }
                    onClose={() => setSeleccionado(null)}
                />
            ) : null}

            {revisando ? (
                <CompraRevisarCambiosModal
                    datos={datos}
                    onDatos={setDatos}
                    cambiosLineas={cambiosLineas}
                    cambiosDatos={cambiosDatos}
                    totalAntes={Number(compra.total_a_pagar)}
                    totalDespues={totalDe(lineas, encabezado.descuento)}
                    pagado={Number(compra.abono)}
                    errors={pageErrors}
                    processing={procesando}
                    onGuardar={guardar}
                    onClose={() => setRevisando(false)}
                />
            ) : null}

            <Dialog open={viendoPagos} onOpenChange={setViendoPagos}>
                <DialogContent className="sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle>
                            Pagos de la compra {compra.factura}
                        </DialogTitle>
                        <DialogDescription>
                            Los pagos al proveedor se manejan aparte de los
                            productos.
                        </DialogDescription>
                    </DialogHeader>
                    {hayCambios ? (
                        <p className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-300">
                            Guarda o descarta los cambios de la compra antes de
                            registrar pagos, para no perderlos.
                        </p>
                    ) : (
                        <CompraAbonosCard
                            compra={compra}
                            pucs={pucs}
                            canCreate={canCreateAbono}
                            canDelete={canDeleteAbono}
                        />
                    )}
                </DialogContent>
            </Dialog>

            <DeleteCompraModal
                compra={borrando ? compra : null}
                open={borrando}
                onOpenChange={setBorrando}
            />
        </>
    );
}
