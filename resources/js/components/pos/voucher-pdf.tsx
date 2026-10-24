import {
    Document,
    Image,
    Page,
    StyleSheet,
    Text,
    View,
    pdf,
} from '@react-pdf/renderer';
import type { ComponentProps } from 'react';
import { muestra, normalizarDiseno } from '@/lib/voucher-diseno';
import type {
    BloqueVoucher,
    DisenoVoucher,
    Tamano,
} from '@/lib/voucher-diseno';
import type { PosVoucher } from '@/types';

// Loaded on demand (dynamic import) from the "imprimir" button: this module
// pulls in the whole PDF renderer, which is far too heavy for the POS bundle.

/** One style object, as the PDF components take it. */
type Style = Exclude<
    NonNullable<ComponentProps<typeof View>['style']>,
    readonly unknown[]
>;

/** 80 mm thermal-ticket width, in PDF points. */
const PAGE_WIDTH = 226.77;

/** Characters that fit on a line at the normal size, for the page height. */
const CARACTERES_POR_LINEA = 38;

const ESCALA: Record<Tamano, number> = {
    pequeno: 0.85,
    normal: 1,
    grande: 1.3,
};

const styles = StyleSheet.create({
    page: {
        padding: 10,
        fontFamily: 'Helvetica',
        fontSize: 8,
        color: '#000',
    },
    bold: { fontFamily: 'Helvetica-Bold' },
    // Square logos print as a block; wide ones take the ticket's width.
    logoCuadrado: {
        width: 80,
        height: 80,
        objectFit: 'contain',
        alignSelf: 'center',
        marginBottom: 4,
    },
    logoRectangular: {
        width: 180,
        maxHeight: 70,
        objectFit: 'contain',
        alignSelf: 'center',
        marginBottom: 4,
    },
    turno: {
        fontFamily: 'Helvetica-Bold',
        textAlign: 'center',
        letterSpacing: 2,
        borderBottomWidth: 1.5,
        borderBottomColor: '#000',
        alignSelf: 'center',
        paddingBottom: 1,
        marginVertical: 6,
    },
    separator: {
        borderBottomWidth: 0.7,
        borderBottomColor: '#000',
        borderBottomStyle: 'dashed',
        marginVertical: 5,
    },
    row: { flexDirection: 'row', justifyContent: 'space-between' },
    itemHeader: {
        flexDirection: 'row',
        fontFamily: 'Helvetica-Bold',
        borderBottomWidth: 0.7,
        borderBottomColor: '#000',
        paddingBottom: 2,
        marginBottom: 3,
    },
    itemRow: { flexDirection: 'row', marginBottom: 4 },
    colItem: { flex: 1, paddingRight: 4 },
    colCantidad: { width: 48 },
    colTotal: { width: 52, textAlign: 'right' },
    total: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        fontFamily: 'Helvetica-Bold',
        marginVertical: 3,
    },
});

const money = (value: number): string =>
    `$${value.toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    })}`;

function Linea({
    label,
    value,
    style,
}: {
    label: string;
    value: string | null;
    style?: Style;
}) {
    return (
        <Text style={[styles.bold, style ?? {}]}>
            {label}: {value || 'N/A'}
        </Text>
    );
}

function Totales({
    label,
    value,
    bold = false,
}: {
    label: string;
    value: string;
    bold?: boolean;
}) {
    return (
        <View style={styles.row}>
            <Text style={bold ? styles.bold : undefined}>{label}</Text>
            <Text style={bold ? styles.bold : undefined}>{value}</Text>
        </View>
    );
}

/** Lines a text takes at a size, for the page height. */
function lineas(texto: string | null | undefined, tamano: Tamano): number {
    const porLinea = CARACTERES_POR_LINEA / ESCALA[tamano];

    return (texto ?? '')
        .split('\n')
        .reduce(
            (total, parte) =>
                total + Math.max(1, Math.ceil(parte.length / porLinea)),
            0,
        );
}

/** Rough height of a block, so the ticket is one page sized to its content. */
function alturaBloque(bloque: BloqueVoucher, voucher: PosVoucher): number {
    const escala = ESCALA[bloque.tamano];
    const linea = 11 * escala;
    const campos = Object.values(bloque.campos ?? {}).filter(Boolean).length;

    const alto = (() => {
        switch (bloque.tipo) {
            case 'logo':
                return voucher.empresa.logo_url ? 90 : 0;
            case 'empresa':
                return 20 * escala + campos * linea;
            case 'turno':
                return voucher.pedido.turno ? 34 * escala : 0;
            case 'remision':
                return linea * 1.2;
            case 'fecha_vendedor':
                return campos * linea;
            case 'cliente':
                return (1 + campos) * linea;
            case 'observaciones':
                return (
                    (lineas(voucher.pedido.observacion, bloque.tamano) +
                        lineas(
                            voucher.pedido.observacion_pago,
                            bloque.tamano,
                        )) *
                    linea
                );
            case 'entrega':
                return voucher.entrega
                    ? (6 + lineas(voucher.entrega.nota, bloque.tamano)) *
                          linea +
                          20
                    : 0;
            case 'productos':
                return (
                    linea * 2.5 +
                    voucher.detalles.reduce(
                        (total, detalle) =>
                            total +
                            Math.max(1, Math.ceil(detalle.nombre.length / 22)) *
                                linea +
                            4,
                        0,
                    )
                );
            case 'totales':
                return (campos + 2) * linea;
            case 'texto':
                return lineas(bloque.texto, bloque.tamano) * linea;
        }
    })();

    return alto + (bloque.linea ? 12 : 0);
}

function alturaPagina(voucher: PosVoucher, diseno: DisenoVoucher): number {
    return (
        30 +
        diseno.bloques
            .filter((bloque) => bloque.visible)
            .reduce((total, bloque) => total + alturaBloque(bloque, voucher), 0)
    );
}

function Bloque({
    bloque,
    voucher,
    logo,
}: {
    bloque: BloqueVoucher;
    voucher: PosVoucher;
    logo: string | null;
}) {
    const { empresa, pedido, cliente, vendedor, detalles, entrega } = voucher;
    const escala = ESCALA[bloque.tamano];
    const texto: Style = {
        textAlign: bloque.alineacion,
        fontSize: 8 * escala,
    };
    const ver = (campo: string) => muestra(bloque, campo);

    switch (bloque.tipo) {
        case 'logo':
            return logo ? (
                <Image
                    src={logo}
                    style={
                        empresa.formato_logo === 'CUADRADO'
                            ? styles.logoCuadrado
                            : styles.logoRectangular
                    }
                />
            ) : null;

        case 'empresa':
            return (
                <View>
                    <Text
                        style={[
                            styles.bold,
                            texto,
                            { fontSize: 13 * escala, marginBottom: 2 },
                        ]}
                    >
                        {(empresa.nombre ?? '').toUpperCase()}
                    </Text>
                    {ver('direccion') && empresa.direccion ? (
                        <Text style={[styles.bold, texto]}>
                            {empresa.direccion}
                        </Text>
                    ) : null}
                    {ver('telefono') && empresa.telefono ? (
                        <Text style={[styles.bold, texto]}>
                            Tel: {empresa.telefono}
                        </Text>
                    ) : null}
                    {ver('nit') && empresa.nit ? (
                        <Text style={[styles.bold, texto]}>
                            NIT: {empresa.nit}
                        </Text>
                    ) : null}
                </View>
            );

        case 'turno':
            return pedido.turno ? (
                <Text style={[styles.turno, { fontSize: 18 * escala }]}>
                    {pedido.turno}
                </Text>
            ) : null;

        case 'remision':
            return (
                <Text style={[styles.bold, texto, { fontSize: 9 * escala }]}>
                    REMISION N°: {pedido.id}
                </Text>
            );

        case 'fecha_vendedor':
            return (
                <View>
                    {ver('fecha') ? (
                        <Text style={texto}>Fecha: {pedido.fecha}</Text>
                    ) : null}
                    {ver('vendedor') ? (
                        <Text style={[styles.bold, texto]}>
                            Vendedor: {vendedor}
                        </Text>
                    ) : null}
                </View>
            );

        case 'cliente':
            return (
                <View>
                    <Linea
                        label="CLIENTE"
                        value={cliente.razon_social}
                        style={texto}
                    />
                    {ver('documento') ? (
                        <Linea
                            label="NIT"
                            value={cliente.numero_documento}
                            style={texto}
                        />
                    ) : null}
                    {ver('ciudad') ? (
                        <Linea
                            label="CIUDAD"
                            value={cliente.ciudad}
                            style={texto}
                        />
                    ) : null}
                    {ver('direccion') ? (
                        <Linea
                            label="DIR"
                            value={cliente.direccion}
                            style={texto}
                        />
                    ) : null}
                    {ver('telefono') ? (
                        <Linea
                            label="TEL"
                            value={cliente.telefono}
                            style={texto}
                        />
                    ) : null}
                    {ver('email') ? (
                        <Linea
                            label="EMAIL"
                            value={cliente.email}
                            style={texto}
                        />
                    ) : null}
                    {ver('facturacion') ? (
                        <Linea
                            label="FACTURACION ELECTRONICA"
                            value={pedido.facturacion_electronica ? 'SI' : 'NO'}
                            style={texto}
                        />
                    ) : null}
                </View>
            );

        case 'observaciones':
            return (
                <View>
                    {ver('observacion') ? (
                        <Text style={[styles.bold, texto]}>
                            OBSERVACION: {pedido.observacion ?? ''}
                        </Text>
                    ) : null}
                    {ver('observacion_pago') ? (
                        <Text style={[styles.bold, texto]}>
                            OBSERVACION PAGO: {pedido.observacion_pago ?? ''}
                        </Text>
                    ) : null}
                </View>
            );

        case 'entrega':
            return entrega ? (
                <View>
                    <Text
                        style={[
                            styles.bold,
                            {
                                textAlign: 'center',
                                fontSize: 9 * escala,
                                marginBottom: 3,
                            },
                        ]}
                    >
                        CONTRA ENTREGA
                    </Text>
                    <Linea
                        label="ENTREGAR EN"
                        value={`${entrega.direccion}${entrega.ciudad ? `, ${entrega.ciudad}` : ''}`}
                        style={texto}
                    />
                    <Linea label="TEL" value={entrega.telefono} style={texto} />
                    <Linea
                        label="RECIBE"
                        value={entrega.recibe}
                        style={texto}
                    />
                    {ver('fecha') && entrega.fecha_programada ? (
                        <Linea
                            label="FECHA"
                            value={entrega.fecha_programada}
                            style={texto}
                        />
                    ) : null}
                    {ver('mensajero') && entrega.mensajero ? (
                        <Linea
                            label="MENSAJERO"
                            value={entrega.mensajero}
                            style={texto}
                        />
                    ) : null}
                    {ver('nota') && entrega.nota ? (
                        <Linea
                            label="NOTA"
                            value={entrega.nota}
                            style={texto}
                        />
                    ) : null}
                    <View style={[styles.total, { fontSize: 11 * escala }]}>
                        <Text>COBRAR AL ENTREGAR</Text>
                        <Text>{money(pedido.saldo_pendiente)}</Text>
                    </View>
                </View>
            ) : null;

        case 'productos':
            return (
                <View style={{ fontSize: 8 * escala }}>
                    <Text style={[styles.bold, texto, { marginBottom: 3 }]}>
                        PRODUCTOS FACTURADOS
                    </Text>
                    <View style={styles.itemHeader}>
                        <Text style={styles.colItem}>ITEM</Text>
                        <Text style={styles.colCantidad}>CANTIDAD</Text>
                        <Text style={styles.colTotal}>TOTAL</Text>
                    </View>
                    {detalles.map((detalle, index) => (
                        <View key={index} style={styles.itemRow} wrap={false}>
                            <Text style={[styles.colItem, styles.bold]}>
                                {detalle.nombre}
                            </Text>
                            <Text style={[styles.colCantidad, styles.bold]}>
                                {detalle.cantidad}
                            </Text>
                            <Text style={[styles.colTotal, styles.bold]}>
                                {money(detalle.total).replace('.00', '')}
                            </Text>
                        </View>
                    ))}
                </View>
            );

        case 'totales':
            return (
                <View style={{ fontSize: 8 * escala }}>
                    {ver('subtotal') ? (
                        <Totales
                            label="Subtotal"
                            value={money(pedido.subtotal)}
                        />
                    ) : null}
                    {ver('descuento') ? (
                        <Totales
                            label="Descuento"
                            value={`- ${money(pedido.descuento)}`}
                        />
                    ) : null}
                    {ver('flete') ? (
                        <Totales label="Flete" value={money(pedido.flete)} />
                    ) : null}
                    {ver('retefuente') ? (
                        <Totales
                            label="Retefuente"
                            value={money(pedido.retefuente)}
                        />
                    ) : null}
                    {ver('reteica') ? (
                        <Totales
                            label="ReteIca"
                            value={money(pedido.reteica)}
                        />
                    ) : null}
                    <View style={[styles.total, { fontSize: 11 * escala }]}>
                        <Text>TOTAL</Text>
                        <Text>{money(pedido.total_a_pagar)}</Text>
                    </View>
                    {ver('abono') ? (
                        <Totales
                            label="Abono"
                            value={money(pedido.abono)}
                            bold
                        />
                    ) : null}
                    {ver('debe') ? (
                        <Totales
                            label="Debe"
                            value={`+${money(pedido.saldo_pendiente)}`}
                            bold
                        />
                    ) : null}
                </View>
            );

        case 'texto':
            return bloque.texto ? (
                <View>
                    {bloque.texto.split('\n').map((renglon, index) => (
                        <Text
                            key={index}
                            style={[styles.bold, texto, { marginBottom: 2 }]}
                        >
                            {renglon}
                        </Text>
                    ))}
                </View>
            ) : null;
    }
}

function VoucherDocument({
    voucher,
    logo,
    diseno,
}: {
    voucher: PosVoucher;
    logo: string | null;
    diseno: DisenoVoucher;
}) {
    return (
        <Document
            title={`Voucher ${voucher.pedido.turno ?? voucher.pedido.id}`}
        >
            <Page
                size={{
                    width: PAGE_WIDTH,
                    height: alturaPagina(voucher, diseno),
                }}
                style={styles.page}
            >
                {diseno.bloques
                    .filter((bloque) => bloque.visible)
                    .map((bloque) => (
                        <View key={bloque.id}>
                            <Bloque
                                bloque={bloque}
                                voucher={voucher}
                                logo={logo}
                            />
                            {bloque.linea ? (
                                <View style={styles.separator} />
                            ) : null}
                        </View>
                    ))}
            </Page>
        </Document>
    );
}

/** Logos already read, so printing (or previewing) again doesn't fetch them again. */
const logos = new Map<string, Promise<string | null>>();

/** The logo as a data URL (react-pdf can't fetch it cross-origin), read once. */
function cargarLogo(url: string | null): Promise<string | null> {
    if (!url) {
        return Promise.resolve(null);
    }

    if (!logos.has(url)) {
        const lectura = leerLogo(url);
        logos.set(url, lectura);
        // A failed read is tried again next time.
        lectura.then((logo) => logo ?? logos.delete(url));
    }

    return logos.get(url)!;
}

/** Reads the logo; null if it can't, so a missing logo never blocks the voucher. */
async function leerLogo(url: string): Promise<string | null> {
    try {
        // Keep just the path so it loads from this same origin even when
        // APP_URL differs from the address the POS is opened on.
        const response = await fetch(url.replace(/^https?:\/\/[^/]+/, ''));

        if (!response.ok) {
            return null;
        }

        const blob = await response.blob();

        return await new Promise((resolve) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = () => resolve(null);
            reader.readAsDataURL(blob);
        });
    } catch {
        return null;
    }
}

/**
 * The voucher as a PDF, with the company's design (the one it brings, or
 * the one given: the designer's preview).
 */
export async function generarVoucherPdf(
    voucher: PosVoucher,
    diseno?: DisenoVoucher,
): Promise<Blob> {
    const logo = await cargarLogo(voucher.empresa.logo_url);

    return pdf(
        <VoucherDocument
            voucher={voucher}
            logo={logo}
            diseno={diseno ?? normalizarDiseno(voucher.diseno)}
        />,
    ).toBlob();
}
