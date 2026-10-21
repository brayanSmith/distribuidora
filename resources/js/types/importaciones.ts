export type ImportacionEstado =
    | 'pendiente'
    | 'procesando'
    | 'completada'
    | 'fallida';

export type Importacion = {
    id: number;
    tipo: string;
    nombre_original: string;
    estado: ImportacionEstado;
    total_filas: number;
    procesadas: number;
    creados: number;
    actualizados: number;
    con_error: number;
    errores: { fila: number; mensaje: string }[] | null;
    iniciada_at: string | null;
    terminada_at: string | null;
    leida_at: string | null;
    created_at: string;
    user: { id: number; name: string } | null;
};

/** A kind of file the user may import (productos, medios de pago...). */
export type TipoImportacion = {
    value: string;
    label: string;
    columnas: string[];
};

/** What the server read from an uploaded file, before importing it. */
export type PreviaImportacion = {
    /** The file kept aside, to import once the columns are related. */
    archivo_temporal: string;
    nombre_original: string;
    columnas: string[];
    obligatorias: string[];
    /** The headers of the file: the key the rows use and the name as written. */
    encabezados: { clave: string; nombre: string }[];
    /** First rows, by header key. */
    muestra: Record<string, string | number | null>[];
    /** Header suggested for each column (null: none matched). */
    sugerido: Record<string, string | null>;
};
