import { ChevronDown, ImageUp, Link2, Plus, Trash2 } from 'lucide-react';
import { useEffect, useState } from 'react';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import type { RedDisponible, RedSocialEmpresa } from '@/types';

export const PERSONALIZADA = 'personalizada';

/**
 * A network's icon: the listed one (in its brand color, or the one given),
 * or the image uploaded for a custom network.
 */
export function IconoRed({
    red,
    disponibles,
    imagen,
    color,
    className,
}: {
    red: string;
    disponibles: RedDisponible[];
    imagen?: string | null;
    color?: string;
    className?: string;
}) {
    if (red === PERSONALIZADA) {
        return imagen ? (
            <img
                src={imagen}
                alt=""
                className={cn('size-4 object-contain', className)}
            />
        ) : (
            <Link2 className={cn('text-muted-foreground size-4', className)} />
        );
    }

    const icono =
        disponibles.find((item) => item.clave === red) ??
        disponibles.find((item) => item.clave === 'enlace');

    if (!icono) {
        return null;
    }

    const pintura = color ?? icono.color;

    return (
        <svg
            viewBox="0 0 24 24"
            className={cn('size-4 shrink-0', className)}
            aria-hidden
            fill={icono.modo === 'relleno' ? pintura : 'none'}
            stroke={icono.modo === 'trazo' ? pintura : undefined}
            strokeWidth={icono.modo === 'trazo' ? 2 : undefined}
            strokeLinecap="round"
            strokeLinejoin="round"
            // The markup comes from the app's own registry, not from users.
            dangerouslySetInnerHTML={{ __html: icono.svg }}
        />
    );
}

type Fila = {
    clave: string;
    red: string;
    valor: string;
    nombre: string;
    /** The custom icon already stored. */
    icono: string | null;
    iconoUrl: string | null;
    /** A new icon picked, previewed before saving. */
    vistaPrevia: string | null;
};

let siguiente = 0;
const nuevaClave = () => `red-${++siguiente}`;

/**
 * The company's networks, inside the company form: each one picked from the
 * listed ones (with its icon) or custom, with its own uploaded icon. Sent as
 * redes_sociales[i][...], in the order shown.
 */
export default function RedesSocialesCampo({
    redes,
    disponibles,
    errors,
}: {
    redes: RedSocialEmpresa[];
    disponibles: RedDisponible[];
    errors: Partial<Record<string, string>>;
}) {
    const [filas, setFilas] = useState<Fila[]>(() =>
        redes.map((red) => ({
            clave: nuevaClave(),
            red: red.red,
            valor: red.valor,
            nombre: red.red === PERSONALIZADA ? red.nombre : '',
            icono: red.icono,
            iconoUrl: red.icono_url,
            vistaPrevia: null,
        })),
    );

    useEffect(
        () => () =>
            filas.forEach(
                (fila) =>
                    fila.vistaPrevia && URL.revokeObjectURL(fila.vistaPrevia),
            ),
        // Only on leaving: the previews of the moment.
        // eslint-disable-next-line react-hooks/exhaustive-deps
        [],
    );

    const cambiar = (clave: string, cambios: Partial<Fila>) =>
        setFilas((actuales) =>
            actuales.map((fila) =>
                fila.clave === clave ? { ...fila, ...cambios } : fila,
            ),
        );

    const agregar = () => {
        const usadas = new Set(filas.map((fila) => fila.red));
        const red =
            disponibles.find((item) => !usadas.has(item.clave))?.clave ??
            'enlace';

        setFilas((actuales) => [
            ...actuales,
            {
                clave: nuevaClave(),
                red,
                valor: '',
                nombre: '',
                icono: null,
                iconoUrl: null,
                vistaPrevia: null,
            },
        ]);
    };

    const marcas = disponibles.filter((item) => item.modo === 'relleno');
    const generales = disponibles.filter((item) => item.modo === 'trazo');

    return (
        <div className="grid gap-2" data-test="empresa-redes">
            <input type="hidden" name="redes_sociales_enviadas" value="1" />

            {filas.map((fila, indice) => {
                const nombreCampo = (campo: string) =>
                    `redes_sociales[${indice}][${campo}]`;
                const error = (campo: string) =>
                    errors[`redes_sociales.${indice}.${campo}`];
                const disponible = disponibles.find(
                    (item) => item.clave === fila.red,
                );
                const personalizada = fila.red === PERSONALIZADA;

                return (
                    <div
                        key={fila.clave}
                        className="bg-background grid gap-2 rounded-md border p-2"
                        data-test="empresa-red"
                    >
                        <input
                            type="hidden"
                            name={nombreCampo('red')}
                            value={fila.red}
                        />
                        {fila.icono ? (
                            <input
                                type="hidden"
                                name={nombreCampo('icono')}
                                value={fila.icono}
                            />
                        ) : null}

                        <div className="flex items-start gap-2">
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        className="w-40 shrink-0 justify-between px-2.5"
                                        data-test="empresa-red-tipo"
                                    >
                                        <span className="flex min-w-0 items-center gap-2">
                                            <IconoRed
                                                red={fila.red}
                                                disponibles={disponibles}
                                                imagen={
                                                    fila.vistaPrevia ??
                                                    fila.iconoUrl
                                                }
                                            />
                                            <span className="truncate">
                                                {personalizada
                                                    ? fila.nombre || 'Otra red'
                                                    : disponible?.nombre}
                                            </span>
                                        </span>
                                        <ChevronDown className="text-muted-foreground size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent
                                    align="start"
                                    className="max-h-80 w-64 overflow-y-auto"
                                >
                                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                                        Redes
                                    </DropdownMenuLabel>
                                    <div className="grid grid-cols-2">
                                        {marcas.map((item) => (
                                            <DropdownMenuItem
                                                key={item.clave}
                                                onSelect={() =>
                                                    cambiar(fila.clave, {
                                                        red: item.clave,
                                                    })
                                                }
                                            >
                                                <IconoRed
                                                    red={item.clave}
                                                    disponibles={disponibles}
                                                />
                                                <span className="truncate">
                                                    {item.nombre}
                                                </span>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuLabel className="text-muted-foreground text-xs">
                                        Contacto
                                    </DropdownMenuLabel>
                                    <div className="grid grid-cols-2">
                                        {generales.map((item) => (
                                            <DropdownMenuItem
                                                key={item.clave}
                                                onSelect={() =>
                                                    cambiar(fila.clave, {
                                                        red: item.clave,
                                                    })
                                                }
                                            >
                                                <IconoRed
                                                    red={item.clave}
                                                    disponibles={disponibles}
                                                />
                                                <span className="truncate">
                                                    {item.nombre}
                                                </span>
                                            </DropdownMenuItem>
                                        ))}
                                    </div>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onSelect={() =>
                                            cambiar(fila.clave, {
                                                red: PERSONALIZADA,
                                            })
                                        }
                                        data-test="empresa-red-personalizada"
                                    >
                                        <ImageUp />
                                        Otra red, con mi ícono
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>

                            <div className="grid min-w-0 flex-1 gap-1">
                                <Input
                                    name={nombreCampo('valor')}
                                    value={fila.valor}
                                    onChange={(event) =>
                                        cambiar(fila.clave, {
                                            valor: event.target.value,
                                        })
                                    }
                                    placeholder={
                                        personalizada
                                            ? 'Usuario o enlace'
                                            : disponible?.ejemplo
                                    }
                                    maxLength={120}
                                    aria-label="Usuario, número o enlace"
                                    data-test="empresa-red-valor"
                                />
                                <InputError message={error('valor')} />
                            </div>

                            <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="text-muted-foreground shrink-0 hover:text-red-600"
                                onClick={() =>
                                    setFilas((actuales) =>
                                        actuales.filter(
                                            (item) => item.clave !== fila.clave,
                                        ),
                                    )
                                }
                                aria-label="Quitar red"
                            >
                                <Trash2 />
                            </Button>
                        </div>

                        {personalizada ? (
                            <div className="flex flex-wrap items-start gap-2 sm:pl-42">
                                <div className="grid min-w-40 flex-1 gap-1">
                                    <Input
                                        name={nombreCampo('nombre')}
                                        value={fila.nombre}
                                        onChange={(event) =>
                                            cambiar(fila.clave, {
                                                nombre: event.target.value,
                                            })
                                        }
                                        placeholder="Nombre de la red. Ej.: Linktree"
                                        maxLength={40}
                                        aria-label="Nombre de la red"
                                    />
                                    <InputError message={error('nombre')} />
                                </div>
                                <div className="grid gap-1">
                                    <label className="hover:bg-accent inline-flex h-9 cursor-pointer items-center gap-2 rounded-md border px-3 text-sm">
                                        <ImageUp className="size-4" />
                                        {fila.vistaPrevia || fila.iconoUrl
                                            ? 'Cambiar ícono'
                                            : 'Subir ícono'}
                                        <input
                                            type="file"
                                            name={nombreCampo('icono_archivo')}
                                            accept="image/png,image/jpeg,image/webp,image/svg+xml"
                                            className="sr-only"
                                            onChange={(event) => {
                                                const archivo =
                                                    event.target.files?.[0];

                                                if (fila.vistaPrevia) {
                                                    URL.revokeObjectURL(
                                                        fila.vistaPrevia,
                                                    );
                                                }

                                                cambiar(fila.clave, {
                                                    vistaPrevia: archivo
                                                        ? URL.createObjectURL(
                                                              archivo,
                                                          )
                                                        : null,
                                                });
                                            }}
                                            data-test="empresa-red-icono"
                                        />
                                    </label>
                                    <InputError
                                        message={error('icono_archivo')}
                                    />
                                </div>
                            </div>
                        ) : null}
                    </div>
                );
            })}

            {filas.length === 0 ? (
                <p className="text-muted-foreground rounded-md border border-dashed py-4 text-center text-sm">
                    Sin redes sociales.
                </p>
            ) : null}

            <Button
                type="button"
                variant="outline"
                size="sm"
                className="justify-self-start"
                onClick={agregar}
                disabled={filas.length >= 12}
                data-test="empresa-agregar-red"
            >
                <Plus />
                Agregar red social
            </Button>
        </div>
    );
}
