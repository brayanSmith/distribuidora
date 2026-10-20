export type ImportacionEstado =
    | 'pendiente'
    | 'procesando'
    | 'completada'
    | 'fallida';

export type Importacion = {
    id: number;
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
    created_at: string;
    user: { id: number; name: string } | null;
};
