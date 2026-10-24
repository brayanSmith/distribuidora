/**
 * The design of the printed voucher: blocks stacked top to bottom, each one
 * shown or hidden, aligned, sized and with the fields it prints. Being a
 * stack, the ticket grows with the sale and nothing ever overlaps.
 */

export type TipoBloque =
    | 'logo'
    | 'empresa'
    | 'turno'
    | 'remision'
    | 'fecha_vendedor'
    | 'cliente'
    | 'observaciones'
    | 'entrega'
    | 'productos'
    | 'totales'
    | 'texto';

export type Alineacion = 'left' | 'center' | 'right';

export type Tamano = 'pequeno' | 'normal' | 'grande';

export type BloqueVoucher = {
    id: string;
    tipo: TipoBloque;
    visible: boolean;
    alineacion: Alineacion;
    tamano: Tamano;
    /** A dashed line after the block. */
    linea: boolean;
    /** Free text (texto blocks). */
    texto?: string;
    /** Which optional fields it prints. */
    campos?: Record<string, boolean>;
};

export type DisenoVoucher = { version: 1; bloques: BloqueVoucher[] };

type MetaBloque = {
    label: string;
    descripcion: string;
    /** The optional fields, on by default unless said otherwise. */
    campos?: { clave: string; label: string; activo?: boolean }[];
    /** Can be added more than once (free text). */
    repetible?: boolean;
    /** Alignment makes sense for it. */
    alineable?: boolean;
};

export const BLOQUES: Record<TipoBloque, MetaBloque> = {
    logo: { label: 'Logo', descripcion: 'El logo de la empresa.' },
    empresa: {
        label: 'Datos de la empresa',
        descripcion: 'Nombre y datos de contacto.',
        alineable: true,
        campos: [
            { clave: 'direccion', label: 'Dirección' },
            { clave: 'telefono', label: 'Teléfono' },
            { clave: 'nit', label: 'NIT' },
        ],
    },
    turno: {
        label: 'Turno',
        descripcion: 'El turno grande, cuando la venta lo tiene.',
    },
    remision: {
        label: 'Número de remisión',
        descripcion: 'REMISIÓN N°.',
        alineable: true,
    },
    fecha_vendedor: {
        label: 'Fecha y vendedor',
        descripcion: 'Cuándo y quién vendió.',
        alineable: true,
        campos: [
            { clave: 'fecha', label: 'Fecha' },
            { clave: 'vendedor', label: 'Vendedor' },
        ],
    },
    cliente: {
        label: 'Datos del cliente',
        descripcion: 'Nombre del cliente y sus datos.',
        campos: [
            { clave: 'documento', label: 'NIT / documento' },
            { clave: 'ciudad', label: 'Ciudad' },
            { clave: 'direccion', label: 'Dirección' },
            { clave: 'telefono', label: 'Teléfono' },
            { clave: 'email', label: 'Email' },
            { clave: 'facturacion', label: 'Facturación electrónica' },
        ],
    },
    observaciones: {
        label: 'Observaciones',
        descripcion: 'Las observaciones de la venta y del pago.',
        campos: [
            { clave: 'observacion', label: 'Observación' },
            { clave: 'observacion_pago', label: 'Observación de pago' },
        ],
    },
    entrega: {
        label: 'Datos de entrega',
        descripcion:
            'Solo en ventas contra entrega: dirección y lo que se cobra.',
        campos: [
            { clave: 'fecha', label: 'Fecha programada' },
            { clave: 'mensajero', label: 'Mensajero' },
            { clave: 'nota', label: 'Nota' },
        ],
    },
    productos: {
        label: 'Productos',
        descripcion: 'La lista de productos con cantidad y total.',
    },
    totales: {
        label: 'Totales',
        descripcion: 'El total y sus ajustes, lo abonado y lo que se debe.',
        campos: [
            { clave: 'subtotal', label: 'Subtotal' },
            { clave: 'descuento', label: 'Descuento' },
            { clave: 'flete', label: 'Flete' },
            { clave: 'retefuente', label: 'Retefuente' },
            { clave: 'reteica', label: 'ReteICA' },
            { clave: 'abono', label: 'Abono' },
            { clave: 'debe', label: 'Debe' },
        ],
    },
    texto: {
        label: 'Texto libre',
        descripcion: 'Un mensaje: garantía, agradecimiento, redes sociales...',
        repetible: true,
        alineable: true,
    },
};

/** Text the voucher had printed before it could be designed. */
const PIE_ORIGINAL = [
    'Las llantas tienen 3 años de garantía por desperfectos de fábrica.',
    'NO cubre daños ocasionados por mal uso. NO aplica Huevos en los costados',
    '¡GRACIAS POR SU COMPRA!',
].join('\n');

function bloque(
    tipo: TipoBloque,
    cambios: Partial<BloqueVoucher> = {},
): BloqueVoucher {
    return {
        id: tipo,
        tipo,
        visible: true,
        alineacion: 'center',
        tamano: 'normal',
        linea: false,
        campos: Object.fromEntries(
            (BLOQUES[tipo].campos ?? []).map((campo) => [
                campo.clave,
                campo.activo ?? true,
            ]),
        ),
        ...cambios,
    };
}

/** The voucher as it always printed. */
export function disenoPorDefecto(): DisenoVoucher {
    return {
        version: 1,
        bloques: [
            bloque('logo'),
            bloque('empresa'),
            bloque('turno', { linea: true }),
            bloque('remision', { alineacion: 'left', linea: true }),
            bloque('fecha_vendedor', { linea: true }),
            bloque('cliente', { alineacion: 'left' }),
            bloque('observaciones', { alineacion: 'left', linea: true }),
            bloque('entrega', { alineacion: 'left', linea: true }),
            bloque('productos', { alineacion: 'left', linea: true }),
            bloque('totales', { alineacion: 'left', linea: true }),
            bloque('texto', {
                id: 'pie',
                texto: PIE_ORIGINAL,
                tamano: 'pequeno',
            }),
        ],
    };
}

export function nuevoBloqueTexto(): BloqueVoucher {
    return bloque('texto', {
        id: `texto-${Date.now().toString(36)}`,
        texto: '',
    });
}

const ALINEACIONES: Alineacion[] = ['left', 'center', 'right'];
const TAMANOS: Tamano[] = ['pequeno', 'normal', 'grande'];

/**
 * A saved design made safe to use: unknown blocks dropped, missing settings
 * and fields filled in, and blocks added since it was saved appended hidden.
 */
export function normalizarDiseno(guardado: unknown): DisenoVoucher {
    const bloques = (guardado as Partial<DisenoVoucher> | null)?.bloques;

    if (!Array.isArray(bloques) || bloques.length === 0) {
        return disenoPorDefecto();
    }

    const idsVistos = new Set<string>();
    const tiposVistos = new Set<string>();
    const limpios = bloques.flatMap((crudo): BloqueVoucher[] => {
        if (
            !crudo ||
            !(crudo.tipo in BLOQUES) ||
            idsVistos.has(String(crudo.id)) ||
            // Only free text may repeat.
            (!BLOQUES[crudo.tipo as TipoBloque].repetible &&
                tiposVistos.has(crudo.tipo))
        ) {
            return [];
        }

        idsVistos.add(String(crudo.id));
        tiposVistos.add(crudo.tipo);
        const base = bloque(crudo.tipo as TipoBloque, { id: String(crudo.id) });

        return [
            {
                ...base,
                visible: crudo.visible !== false,
                alineacion: ALINEACIONES.includes(crudo.alineacion)
                    ? crudo.alineacion
                    : base.alineacion,
                tamano: TAMANOS.includes(crudo.tamano)
                    ? crudo.tamano
                    : base.tamano,
                linea: crudo.linea === true,
                texto:
                    typeof crudo.texto === 'string' ? crudo.texto : base.texto,
                campos: { ...base.campos, ...(crudo.campos ?? {}) },
            },
        ];
    });

    const faltantes = (Object.keys(BLOQUES) as TipoBloque[])
        .filter((tipo) => !BLOQUES[tipo].repetible)
        .filter((tipo) => !limpios.some((item) => item.tipo === tipo))
        .map((tipo) => bloque(tipo, { visible: false }));

    return { version: 1, bloques: [...limpios, ...faltantes] };
}

/** Whether a block prints a field (fields it doesn't have always print). */
export function muestra(bloqueVoucher: BloqueVoucher, campo: string): boolean {
    return bloqueVoucher.campos?.[campo] !== false;
}
