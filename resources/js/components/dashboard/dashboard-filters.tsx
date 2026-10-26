import { router } from '@inertiajs/react';
import { BarChart3, X } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import MultiCombobox from '@/components/multi-combobox';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { fechaMasDias, formatoFecha } from '@/lib/vencimiento';
import { dashboard } from '@/routes';
import type {
    DashboardBodegaOption,
    DashboardFiltros,
    DashboardProductoOption,
} from '@/types';

type Props = {
    filtros: DashboardFiltros;
    bodegas: DashboardBodegaOption[];
    productos: DashboardProductoOption[];
};

const SIN_FILTROS: DashboardFiltros = {
    bodega_ids: [],
    desde: '',
    hasta: '',
    producto_ids: [],
};

const estaVacio = (valor: string | string[]) =>
    Array.isArray(valor) ? valor.length === 0 : valor === '';

type Periodo = 'todo' | 'semana' | 'mes' | 'anio' | 'personalizado';

/** The quick periods: up to today, going back these many days. */
const PERIODOS: { value: Periodo; label: string; dias?: number }[] = [
    { value: 'todo', label: 'Todo' },
    { value: 'semana', label: 'Última semana', dias: 7 },
    { value: 'mes', label: 'Último mes', dias: 30 },
    { value: 'anio', label: 'Último año', dias: 365 },
    { value: 'personalizado', label: 'Personalizado' },
];

/** The dates of a quick period (today included). */
function rangoDe(dias: number): { desde: string; hasta: string } {
    return { desde: fechaMasDias(-(dias - 1)), hasta: fechaMasDias(0) };
}

/** Which period some dates are: a quick one when they match it exactly. */
function periodoDe(desde: string, hasta: string): Periodo {
    if (!desde && !hasta) {
        return 'todo';
    }

    const rapido = PERIODOS.find((periodo) => {
        if (!periodo.dias) {
            return false;
        }

        const rango = rangoDe(periodo.dias);

        return rango.desde === desde && rango.hasta === hasta;
    });

    return rapido?.value ?? 'personalizado';
}

/**
 * Filters shared by the dashboard widgets and table. Changes stay in a draft
 * until "Analizar" is pressed, which sends them to the server through the
 * query string (so the view can be bookmarked).
 */
export default function DashboardFilters({
    filtros,
    bodegas,
    productos,
}: Props) {
    const [borrador, setBorrador] = useState<DashboardFiltros>(filtros);
    const [analizando, setAnalizando] = useState(false);

    // Follow the server (e.g. after clearing or navigating back).
    const filtrosKey = JSON.stringify(filtros);
    useEffect(() => {
        setBorrador(JSON.parse(filtrosKey) as DashboardFiltros);
    }, [filtrosKey]);

    const hayFiltros = Object.values(filtros).some(
        (valor) => !estaVacio(valor),
    );
    const hayCambios = JSON.stringify(borrador) !== filtrosKey;

    // "Personalizado" can be chosen before any date is typed.
    const [personalizado, setPersonalizado] = useState(
        () => periodoDe(filtros.desde, filtros.hasta) === 'personalizado',
    );
    const periodo: Periodo = personalizado
        ? 'personalizado'
        : periodoDe(borrador.desde, borrador.hasta);

    const elegirPeriodo = (valor: Periodo) => {
        const elegido = PERIODOS.find((opcion) => opcion.value === valor);
        setPersonalizado(valor === 'personalizado');

        if (valor === 'todo') {
            cambiar({ desde: '', hasta: '' });
        } else if (elegido?.dias) {
            cambiar(rangoDe(elegido.dias));
        }
    };

    const bodegaOptions = useMemo(
        () =>
            bodegas.map((bodega) => ({
                value: String(bodega.id),
                label: bodega.nombre_bodega,
            })),
        [bodegas],
    );

    const productoOptions = useMemo(
        () =>
            productos.map((producto) => ({
                value: String(producto.id),
                label:
                    producto.concatenar_codigo_nombre ??
                    `Producto ${producto.id}`,
            })),
        [productos],
    );

    const cambiar = (cambios: Partial<DashboardFiltros>) =>
        setBorrador((prev) => ({ ...prev, ...cambios }));

    const analizar = (aplicados: DashboardFiltros) => {
        const query = Object.fromEntries(
            Object.entries(aplicados).filter(([, valor]) => !estaVacio(valor)),
        );

        router.get(dashboard.url(), query, {
            preserveState: true,
            preserveScroll: true,
            replace: true,
            only: ['cantidadPorBodega', 'resumen', 'graficos', 'filtros'],
            onStart: () => setAnalizando(true),
            onFinish: () => setAnalizando(false),
        });
    };

    const limpiar = () => {
        setPersonalizado(false);
        setBorrador(SIN_FILTROS);
        analizar(SIN_FILTROS);
    };

    return (
        <form
            className="bg-card space-y-3 rounded-xl border p-4"
            data-test="dashboard-filters"
            onSubmit={(event) => {
                event.preventDefault();
                analizar(borrador);
            }}
        >
            <div className="space-y-1.5">
                <Label>Periodo</Label>
                <div
                    className="flex flex-wrap gap-2"
                    role="radiogroup"
                    aria-label="Periodo"
                    data-test="dashboard-filter-periodo"
                >
                    {PERIODOS.map((opcion) => (
                        <button
                            key={opcion.value}
                            type="button"
                            role="radio"
                            aria-checked={periodo === opcion.value}
                            onClick={() => elegirPeriodo(opcion.value)}
                            className={cn(
                                'rounded-full border px-3 py-1 text-sm transition-colors',
                                periodo === opcion.value
                                    ? 'bg-primary text-primary-foreground border-primary'
                                    : 'bg-card hover:bg-accent',
                            )}
                            data-test={`dashboard-periodo-${opcion.value}`}
                        >
                            {opcion.label}
                        </button>
                    ))}
                </div>
                {periodo !== 'todo' && periodo !== 'personalizado' ? (
                    <p className="text-muted-foreground text-xs">
                        Del {formatoFecha(borrador.desde)} al{' '}
                        {formatoFecha(borrador.hasta)}
                    </p>
                ) : null}
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                <div className="space-y-1.5">
                    <Label>Bodegas</Label>
                    <MultiCombobox
                        options={bodegaOptions}
                        value={borrador.bodega_ids}
                        onValueChange={(value) =>
                            cambiar({ bodega_ids: value })
                        }
                        placeholder="Todas"
                        searchPlaceholder="Buscar bodega..."
                        dataTest="dashboard-filter-bodega"
                    />
                </div>

                {periodo === 'personalizado' ? (
                    <>
                        <div className="space-y-1.5">
                            <Label htmlFor="dashboard-desde">Desde</Label>
                            <Input
                                id="dashboard-desde"
                                type="date"
                                value={borrador.desde}
                                max={borrador.hasta || undefined}
                                onChange={(event) =>
                                    cambiar({ desde: event.target.value })
                                }
                                data-test="dashboard-filter-desde"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <Label htmlFor="dashboard-hasta">Hasta</Label>
                            <Input
                                id="dashboard-hasta"
                                type="date"
                                value={borrador.hasta}
                                min={borrador.desde || undefined}
                                onChange={(event) =>
                                    cambiar({ hasta: event.target.value })
                                }
                                data-test="dashboard-filter-hasta"
                            />
                        </div>
                    </>
                ) : null}

                <div className="space-y-1.5 xl:col-span-2">
                    <Label>Productos</Label>
                    <MultiCombobox
                        options={productoOptions}
                        value={borrador.producto_ids}
                        onValueChange={(value) =>
                            cambiar({ producto_ids: value })
                        }
                        placeholder="Todos"
                        searchPlaceholder="Buscar producto..."
                        dataTest="dashboard-filter-producto"
                    />
                </div>
            </div>

            <div className="flex items-center justify-end gap-2">
                {hayCambios ? (
                    <span className="text-muted-foreground text-xs">
                        Hay cambios sin aplicar
                    </span>
                ) : null}
                {hayFiltros || hayCambios ? (
                    <Button
                        type="button"
                        variant="outline"
                        onClick={limpiar}
                        loading={analizando}
                        data-test="dashboard-filter-clear"
                    >
                        <X />
                        Limpiar
                    </Button>
                ) : null}
                <Button
                    type="submit"
                    disabled={analizando}
                    data-test="dashboard-filter-analizar"
                >
                    <BarChart3 />
                    {analizando ? 'Analizando...' : 'Analizar'}
                </Button>
            </div>
        </form>
    );
}
