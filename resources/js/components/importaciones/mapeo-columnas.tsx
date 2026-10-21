import { ArrowRight, CircleAlert } from 'lucide-react';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { PreviaImportacion } from '@/types';

const NINGUNA = '__ninguna__';

type Props = {
    previa: PreviaImportacion;
    /** Header picked for each column; null leaves the column empty. */
    mapeo: Record<string, string | null>;
    onChange: (columna: string, encabezado: string | null) => void;
};

/**
 * Relates the columns the import needs with the headers of the file, whatever
 * their names or order, showing the first value of each so it can be checked.
 */
export default function MapeoColumnas({ previa, mapeo, onChange }: Props) {
    const primeraFila = previa.muestra[0] ?? {};

    return (
        <div
            className="divide-y rounded-md border"
            data-test="importacion-mapeo"
        >
            <div className="text-muted-foreground grid grid-cols-[1fr_auto_1.4fr] items-center gap-2 px-3 py-2 text-xs font-medium">
                <span>Columna del sistema</span>
                <span />
                <span>Columna de tu archivo</span>
            </div>

            {previa.columnas.map((columna) => {
                const obligatoria = previa.obligatorias.includes(columna);
                const elegido = mapeo[columna] ?? null;
                const falta = obligatoria && elegido === null;
                const ejemplo =
                    elegido !== null ? primeraFila[elegido] : undefined;

                return (
                    <div
                        key={columna}
                        className={cn(
                            'grid grid-cols-[1fr_auto_1.4fr] items-center gap-2 px-3 py-2',
                            falta && 'bg-red-50 dark:bg-red-950/30',
                        )}
                    >
                        <span className="text-sm font-medium">
                            {columna}
                            {obligatoria ? (
                                <span className="text-destructive"> *</span>
                            ) : null}
                        </span>

                        <ArrowRight className="text-muted-foreground size-4" />

                        <div className="min-w-0 space-y-0.5">
                            <Select
                                value={elegido ?? NINGUNA}
                                onValueChange={(valor) =>
                                    onChange(
                                        columna,
                                        valor === NINGUNA ? null : valor,
                                    )
                                }
                            >
                                <SelectTrigger
                                    className="h-8 w-full"
                                    data-test={`importacion-mapeo-${columna}`}
                                >
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value={NINGUNA}>
                                        — No importar —
                                    </SelectItem>
                                    {previa.encabezados.map((encabezado) => (
                                        <SelectItem
                                            key={encabezado.clave}
                                            value={encabezado.clave}
                                        >
                                            {encabezado.nombre}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>

                            {falta ? (
                                <p className="text-destructive flex items-center gap-1 text-xs">
                                    <CircleAlert className="size-3" />
                                    Elige de qué columna sale.
                                </p>
                            ) : ejemplo !== undefined &&
                              ejemplo !== null &&
                              String(ejemplo) !== '' ? (
                                <p
                                    className="text-muted-foreground truncate text-xs"
                                    title={String(ejemplo)}
                                >
                                    Ej.: {String(ejemplo)}
                                </p>
                            ) : null}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}
