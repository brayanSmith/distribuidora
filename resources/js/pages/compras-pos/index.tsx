import { Head, router } from '@inertiajs/react';
import { Plus, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useMemo, useRef, useState } from 'react';
import CompraPagoModal from '@/components/compras-pos/compra-pago-modal';
import type {
    PagoCompra,
    TipoPagoCompra,
} from '@/components/compras-pos/compra-pago-modal';
import CompraPanel from '@/components/compras-pos/compra-panel';
import ProveedorModal from '@/components/compras-pos/proveedor-modal';
import CompraProductoCard from '@/components/compras-pos/compra-producto-card';
import CompraProductoModal from '@/components/compras-pos/compra-producto-modal';
import type { CompraPosSeleccion } from '@/components/compras-pos/compra-producto-modal';
import Pagination from '@/components/pagination';
import CreateProductoModal from '@/components/productos/create-producto-modal';
import CategoriaFiltro, {
    contarCategorias,
    pasaFiltroCategoria,
    TODAS_LAS_CATEGORIAS,
} from '@/components/productos/categoria-filtro';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useHotkeys } from '@/hooks/use-hotkeys';
import { usePersistedState } from '@/hooks/use-persisted-state';
import { fechaMasDias } from '@/lib/vencimiento';
import { pos, store } from '@/routes/compras';
import { precios } from '@/routes/productos';
import type {
    BodegaOption,
    CategoriaOption,
    CompraPosEncabezado,
    CompraPosLinea,
    CompraPosProducto,
    ProveedorPos,
    PucOption,
} from '@/types';

type Props = {
    productos: CompraPosProducto[];
    categorias: CategoriaOption[];
    proveedores: ProveedorPos[];
    bodegas: BodegaOption[];
    canCreateProveedor: boolean;
    canUpdatePrecios: boolean;
    canCreateProducto: boolean;
    canCreateAbono: boolean;
    pucs: PucOption[];
};

const PAGE_SIZE = 48;

const moneda = new Intl.NumberFormat('es-CO', {
    style: 'currency',
    currency: 'COP',
    maximumFractionDigits: 0,
});

const encabezadoVacio = (bodegaId: string): CompraPosEncabezado => ({
    proveedorId: '',
    factura: '',
    bodegaId,
    recibido: true,
    descuento: '0',
    observaciones: '',
});

const claveLinea = (productoId: number, bodegaId: number) =>
    `${productoId}:${bodegaId}`;

/**
 * Registers purchases like a cash register: tap the products, adjust
 * quantity and cost, pick the proveedor and invoice and save. The compra in
 * progress survives a reload (it is kept in this browser).
 */
export default function ComprasPos({
    productos,
    categorias,
    proveedores,
    bodegas,
    canCreateProveedor,
    canUpdatePrecios,
    canCreateProducto,
    canCreateAbono,
    pucs,
}: Props) {
    const bodegaInicial = bodegas[0] ? String(bodegas[0].id) : '';
    const [encabezado, setEncabezado] = usePersistedState<CompraPosEncabezado>(
        'compras-pos:encabezado',
        () => encabezadoVacio(bodegaInicial),
    );
    const [lineas, setLineas] = usePersistedState<CompraPosLinea[]>(
        'compras-pos:lineas',
        [],
    );
    const [busqueda, setBusqueda] = useState('');
    const [categoria, setCategoria] = useState(TODAS_LAS_CATEGORIAS);
    const [subCategoria, setSubCategoria] = useState('');
    const [pagina, setPagina] = useState(1);
    const [procesando, setProcesando] = useState(false);
    const [errores, setErrores] = useState<Record<string, string>>({});
    const busquedaRef = useRef<HTMLInputElement>(null);
    const nuevoProductoRef = useRef<HTMLButtonElement>(null);
    // The payment step: open while choosing what is paid to the proveedor.
    const [pagando, setPagando] = useState(false);
    const [eligiendoProveedor, setEligiendoProveedor] = useState(false);
    const proveedor =
        proveedores.find(({ id }) => String(id) === encabezado.proveedorId) ??
        null;
    const [pagos, setPagos] = useState<PagoCompra[]>([]);
    const [vencimiento, setVencimiento] = useState('');
    const [tipoPago, setTipoPago] = useState<TipoPagoCompra>('CONTADO');
    const [seleccionado, setSeleccionado] = useState<CompraPosProducto | null>(
        null,
    );

    // A saved bodega the user can no longer use falls back to the first one.
    useEffect(() => {
        if (
            bodegas.length > 0 &&
            !bodegas.some(({ id }) => String(id) === encabezado.bodegaId)
        ) {
            setEncabezado((actual) => ({ ...actual, bodegaId: bodegaInicial }));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [bodegas]);

    const conteos = useMemo(
        () =>
            contarCategorias(
                productos,
                (producto) => producto.categoria_id,
                (producto) => producto.sub_categoria,
            ),
        [productos],
    );

    const filtrados = useMemo(() => {
        const termino = busqueda.trim().toLowerCase();

        return productos.filter(
            (producto) =>
                pasaFiltroCategoria(
                    categoria,
                    subCategoria,
                    producto.categoria_id,
                    producto.sub_categoria,
                ) &&
                (!termino ||
                    `${producto.nombre} ${producto.sku ?? ''}`
                        .toLowerCase()
                        .includes(termino)),
        );
    }, [productos, busqueda, categoria, subCategoria]);

    useEffect(() => setPagina(1), [busqueda, categoria, subCategoria]);

    const totalPaginas = Math.max(Math.ceil(filtrados.length / PAGE_SIZE), 1);
    const paginaActual = Math.min(pagina, totalPaginas);
    const visibles = filtrados.slice(
        (paginaActual - 1) * PAGE_SIZE,
        paginaActual * PAGE_SIZE,
    );

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

    // The modal sets the line of the product in a bodega (adding it or
    // replacing what it had) and saves the sale prices that changed.
    const confirmarProducto = (
        producto: CompraPosProducto,
        seleccion: CompraPosSeleccion,
    ) => {
        const key = claveLinea(producto.id, seleccion.bodegaId);
        const linea: CompraPosLinea = {
            key,
            productoId: producto.id,
            nombre: producto.nombre,
            bodegaId: seleccion.bodegaId,
            cantidad: seleccion.cantidad,
            costoUnitario: seleccion.costoUnitario,
        };
        const yaEstaba = lineas.some((actual) => actual.key === key);

        setLineas((actuales) =>
            actuales.some((actual) => actual.key === key)
                ? actuales.map((actual) =>
                      actual.key === key ? linea : actual,
                  )
                : [...actuales, linea],
        );
        setSeleccionado(null);
        toast.success(
            yaEstaba
                ? `Cambios guardados: ${producto.nombre}`
                : `Agregado a la compra: ${producto.nombre}`,
            {
                description: `${seleccion.cantidad} × ${moneda.format(seleccion.costoUnitario)}`,
            },
        );

        const cambios = {
            ...(seleccion.valorDetal !== null
                ? { valor_detal: seleccion.valorDetal }
                : {}),
            ...(seleccion.valorMayorista !== null
                ? { valor_mayorista: seleccion.valorMayorista }
                : {}),
        };

        if (Object.keys(cambios).length > 0) {
            router.patch(precios.url(producto.id), cambios, {
                only: ['productos', 'flash'],
                preserveScroll: true,
                preserveState: true,
            });
        }
    };

    // Moving a line to a bodega where the product already is merges both.
    const cambiarLinea = (key: string, cambios: Partial<CompraPosLinea>) =>
        setLineas((actuales) => {
            const fusionadas = new Map<string, CompraPosLinea>();

            actuales.forEach((linea) => {
                const nueva =
                    linea.key === key
                        ? {
                              ...linea,
                              ...cambios,
                              key: claveLinea(
                                  linea.productoId,
                                  cambios.bodegaId ?? linea.bodegaId,
                              ),
                          }
                        : linea;
                const existente = fusionadas.get(nueva.key);

                fusionadas.set(
                    nueva.key,
                    existente
                        ? {
                              ...existente,
                              cantidad: existente.cantidad + nueva.cantidad,
                          }
                        : nueva,
                );
            });

            return [...fusionadas.values()];
        });

    const totalCompra = Math.max(
        lineas.reduce(
            (suma, linea) => suma + linea.cantidad * linea.costoUnitario,
            0,
        ) - (Number(encabezado.descuento) || 0),
        0,
    );

    const limpiar = () => {
        setLineas([]);
        setPagos([]);
        setPagando(false);
        setEncabezado(encabezadoVacio(encabezado.bodegaId || bodegaInicial));
        setErrores({});
    };

    const puedeRegistrar =
        lineas.length > 0 &&
        encabezado.proveedorId !== '' &&
        encabezado.factura.trim() !== '';

    // With permission to pay, the payment step comes first; otherwise the
    // compra goes on credit.
    const continuar = () => {
        if (!puedeRegistrar || procesando) {
            return;
        }

        if (canCreateAbono) {
            setVencimiento(fechaMasDias(proveedor?.dias_credito ?? 0));
            // A proveedor that gives credit is usually paid later.
            setTipoPago(proveedor?.dias_credito ? 'CREDITO' : 'CONTADO');
            setPagando(true);
        } else {
            registrar();
        }
    };

    const registrar = () => {
        if (
            procesando ||
            lineas.length === 0 ||
            !encabezado.proveedorId ||
            !encabezado.factura.trim()
        ) {
            return;
        }

        router.post(
            store.url(),
            {
                stay_on_page: true,
                proveedor_id: encabezado.proveedorId,
                factura: encabezado.factura.trim(),
                fecha: new Date().toISOString(),
                descuento: encabezado.descuento || 0,
                observaciones: encabezado.observaciones,
                tipo_pago: canCreateAbono ? tipoPago : 'CREDITO',
                fecha_vencimiento:
                    canCreateAbono && tipoPago === 'CONTADO'
                        ? null
                        : vencimiento || null,
                abonos: pagos.map((pago) => ({
                    puc_id: pago.pucId,
                    monto: pago.monto,
                    descripcion: pago.descripcion,
                })),
                detalles: lineas.map((linea) => ({
                    producto_id: linea.productoId,
                    bodega_id: linea.bodegaId,
                    cantidad: linea.cantidad,
                    precio_unitario: linea.costoUnitario,
                    recibido: encabezado.recibido,
                })),
            },
            {
                preserveScroll: true,
                onStart: () => setProcesando(true),
                onFinish: () => setProcesando(false),
                onError: (errors) => setErrores(errors),
                onSuccess: () => limpiar(),
            },
        );
    };

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
            { key: 'F8', handler: limpiar },
            { key: 'F9', handler: continuar },
        ],
        { ignoreWhenDialog: true },
    );

    return (
        <>
            <Head title="POS Compras" />

            <div className="grid gap-4 lg:grid-cols-[1fr_24rem]">
                <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                        <div className="relative min-w-48 flex-1">
                            <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                            <Input
                                ref={busquedaRef}
                                value={busqueda}
                                onChange={(event) =>
                                    setBusqueda(event.target.value)
                                }
                                placeholder="Buscar por nombre o SKU… (F2)"
                                className="pl-9"
                                data-test="compras-pos-buscar"
                            />
                        </div>
                        <CategoriaFiltro
                            categorias={categorias}
                            categoria={categoria}
                            subCategoria={subCategoria}
                            onChange={(nuevaCategoria, nuevaSub) => {
                                setCategoria(nuevaCategoria);
                                setSubCategoria(nuevaSub);
                            }}
                            conteos={conteos}
                            dataTest="compras-pos-categoria"
                        />
                        {canCreateProducto ? (
                            <CreateProductoModal
                                categorias={categorias}
                                stayOnPage
                            >
                                <Button
                                    ref={nuevoProductoRef}
                                    type="button"
                                    data-test="compras-pos-nuevo-producto"
                                >
                                    <Plus /> Nuevo producto
                                    <kbd className="text-xs opacity-70">F4</kbd>
                                </Button>
                            </CreateProductoModal>
                        ) : null}
                    </div>

                    {visibles.length > 0 ? (
                        <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] items-stretch gap-2">
                            {visibles.map((producto) => (
                                <CompraProductoCard
                                    key={producto.id}
                                    producto={producto}
                                    enCompra={enCompra.get(producto.id) ?? 0}
                                    onAdd={setSeleccionado}
                                />
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground py-8 text-center text-sm">
                            No se encontraron productos.
                        </p>
                    )}

                    {filtrados.length > 0 ? (
                        <div className="flex flex-col items-center gap-2 text-sm">
                            <Pagination
                                page={paginaActual}
                                totalPages={totalPaginas}
                                onPageChange={setPagina}
                                dataTest="compras-pos-pagina"
                            />
                            <span className="text-muted-foreground">
                                {filtrados.length} productos
                            </span>
                        </div>
                    ) : null}
                </div>

                <div className="lg:sticky lg:top-20 lg:self-start">
                    <CompraPanel
                        proveedor={proveedor}
                        onElegirProveedor={() => setEligiendoProveedor(true)}
                        bodegas={bodegas}
                        encabezado={encabezado}
                        onCampo={(campo, valor) =>
                            setEncabezado((actual) => ({
                                ...actual,
                                [campo]: valor,
                            }))
                        }
                        lineas={lineas}
                        onLinea={cambiarLinea}
                        onQuitar={(key) =>
                            setLineas((actuales) =>
                                actuales.filter((linea) => linea.key !== key),
                            )
                        }
                        onLimpiar={limpiar}
                        onRegistrar={continuar}
                        procesando={procesando}
                        errores={errores}
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

            {pagando ? (
                <CompraPagoModal
                    total={totalCompra}
                    pucs={pucs}
                    pagos={pagos}
                    onAgregar={(pago) =>
                        setPagos((actuales) => [
                            ...actuales,
                            {
                                ...pago,
                                id:
                                    actuales.reduce(
                                        (max, item) => Math.max(max, item.id),
                                        0,
                                    ) + 1,
                            },
                        ])
                    }
                    onQuitar={(id) =>
                        setPagos((actuales) =>
                            actuales.filter((pago) => pago.id !== id),
                        )
                    }
                    onRegistrar={registrar}
                    tipoPago={tipoPago}
                    onTipoPago={setTipoPago}
                    vencimiento={vencimiento}
                    onVencimiento={setVencimiento}
                    diasCredito={proveedor?.dias_credito ?? 0}
                    procesando={procesando}
                    errores={errores}
                    onClose={() => setPagando(false)}
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
        </>
    );
}

ComprasPos.layout = () => ({
    breadcrumbs: [
        {
            title: 'POS Compras',
            href: pos(),
        },
    ],
});
