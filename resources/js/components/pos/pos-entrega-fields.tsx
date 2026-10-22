import { RotateCcw, Truck } from 'lucide-react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { PosEntrega } from '@/hooks/use-pos-header';
import { fechaMasDias } from '@/lib/vencimiento';

type Props = {
    entrega: PosEntrega;
    onChange: (entrega: PosEntrega) => void;
    errors: Partial<Record<string, string>>;
    /** Puts the cliente's data back, after it was changed by hand. */
    onUsarDatosCliente?: () => void;
};

/**
 * Where a contra entrega pedido is delivered. It starts with the cliente's
 * data and can be changed just for this pedido.
 */
export default function PosEntregaFields({
    entrega,
    onChange,
    errors,
    onUsarDatosCliente,
}: Props) {
    const campo = <K extends keyof PosEntrega>(
        clave: K,
        valor: PosEntrega[K],
    ) => onChange({ ...entrega, [clave]: valor });

    return (
        <div
            className="grid gap-3 rounded-md border border-sky-200 bg-sky-50 p-3 dark:border-sky-900 dark:bg-sky-950/30"
            data-test="pos-entrega"
        >
            <div className="flex items-center gap-2 text-sm font-semibold">
                <Truck className="size-4" />
                Datos de entrega
                {onUsarDatosCliente ? (
                    <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="ml-auto h-7 text-xs"
                        onClick={onUsarDatosCliente}
                        data-test="pos-entrega-datos-cliente"
                    >
                        <RotateCcw />
                        Usar datos del cliente
                    </Button>
                ) : null}
            </div>
            <p className="text-muted-foreground -mt-2 text-xs">
                Se cobra al entregar. Se llenan con los datos del cliente;
                cámbialos si va a otro lugar.
            </p>

            <div className="grid gap-2">
                <Label required htmlFor="pos-entrega-direccion">
                    Dirección
                </Label>
                <Input
                    id="pos-entrega-direccion"
                    value={entrega.direccion}
                    onChange={(event) => campo('direccion', event.target.value)}
                    data-test="pos-entrega-direccion"
                />
                <InputError message={errors['entrega.direccion']} />
            </div>

            <div className="grid gap-2">
                <Label htmlFor="pos-entrega-fecha">Entregar el</Label>
                <Input
                    id="pos-entrega-fecha"
                    type="date"
                    min={fechaMasDias(0)}
                    value={entrega.fecha_programada}
                    onChange={(event) =>
                        campo('fecha_programada', event.target.value)
                    }
                    data-test="pos-entrega-fecha"
                />
                <p className="text-muted-foreground text-xs">
                    Déjalo vacío si se despacha lo antes posible.
                </p>
                <InputError message={errors['entrega.fecha_programada']} />
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                    <Label required htmlFor="pos-entrega-telefono">
                        Teléfono
                    </Label>
                    <Input
                        id="pos-entrega-telefono"
                        value={entrega.telefono}
                        onChange={(event) =>
                            campo('telefono', event.target.value)
                        }
                        data-test="pos-entrega-telefono"
                    />
                    <InputError message={errors['entrega.telefono']} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="pos-entrega-ciudad">Ciudad</Label>
                    <Input
                        id="pos-entrega-ciudad"
                        value={entrega.ciudad}
                        onChange={(event) =>
                            campo('ciudad', event.target.value)
                        }
                    />
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-2">
                    <Label htmlFor="pos-entrega-recibe">Quién recibe</Label>
                    <Input
                        id="pos-entrega-recibe"
                        value={entrega.recibe}
                        onChange={(event) =>
                            campo('recibe', event.target.value)
                        }
                    />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="pos-entrega-nota">Nota</Label>
                    <Input
                        id="pos-entrega-nota"
                        value={entrega.nota}
                        onChange={(event) => campo('nota', event.target.value)}
                        placeholder="Ej.: tocar timbre, barrio..."
                    />
                </div>
            </div>
        </div>
    );
}
