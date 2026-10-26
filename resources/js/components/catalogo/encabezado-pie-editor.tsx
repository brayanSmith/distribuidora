import { PanelBottom, PanelTop } from 'lucide-react';
import type { ReactNode } from 'react';
import { IconoRed } from '@/components/empresa/redes-sociales-campo';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import type { AjustesCatalogo, EmpresaCatalogo } from '@/lib/catalogo-diseno';
import type { RedDisponible } from '@/types';

type Props = {
    encabezado: boolean;
    pie: boolean;
    ajustes: AjustesCatalogo;
    empresa: EmpresaCatalogo;
    redesDisponibles: RedDisponible[];
    onEncabezado: (valor: boolean) => void;
    onPie: (valor: boolean) => void;
    onAjustes: (ajustes: AjustesCatalogo) => void;
};

/**
 * What the page header and footer of a design say: each turned on or off,
 * and its texts, logo, networks and page number. Texts left empty show the
 * company's own (as the placeholders tell).
 */
export default function EncabezadoPieEditor({
    encabezado,
    pie,
    ajustes,
    empresa,
    redesDisponibles,
    onEncabezado,
    onPie,
    onAjustes,
}: Props) {
    const cambiar = (cambios: Partial<AjustesCatalogo>) =>
        onAjustes({ ...ajustes, ...cambios });

    const ocultas = new Set(ajustes.pie_ocultar_redes);

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            <Seccion
                icono={<PanelTop className="size-4" />}
                titulo="Encabezado"
                activo={encabezado}
                onActivo={onEncabezado}
                dataTest="catalogo-encabezado"
            >
                <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={ajustes.encabezado_logo}
                        onCheckedChange={(marcado) =>
                            cambiar({ encabezado_logo: marcado === true })
                        }
                        disabled={!empresa.logo_url}
                    />
                    Mostrar el logo
                    {empresa.logo_url ? (
                        <img
                            src={empresa.logo_url}
                            alt=""
                            className="ml-auto h-6 max-w-20 object-contain"
                        />
                    ) : (
                        <span className="text-muted-foreground ml-auto text-xs">
                            Sin logo en Empresa
                        </span>
                    )}
                </label>
                <div className="grid gap-1.5">
                    <Label htmlFor="encabezado-titulo">Título</Label>
                    <Input
                        id="encabezado-titulo"
                        value={ajustes.encabezado_titulo ?? ''}
                        onChange={(event) =>
                            cambiar({ encabezado_titulo: event.target.value })
                        }
                        placeholder={
                            empresa.eslogan ?? 'El nombre de la plantilla'
                        }
                        maxLength={80}
                        data-test="catalogo-encabezado-titulo"
                    />
                </div>
                <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="encabezado-subtitulo">Subtítulo</Label>
                        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Checkbox
                                checked={ajustes.encabezado_mostrar_subtitulo}
                                onCheckedChange={(marcado) =>
                                    cambiar({
                                        encabezado_mostrar_subtitulo:
                                            marcado === true,
                                    })
                                }
                            />
                            Mostrar
                        </label>
                    </div>
                    <Textarea
                        id="encabezado-subtitulo"
                        value={ajustes.encabezado_subtitulo ?? ''}
                        onChange={(event) =>
                            cambiar({
                                encabezado_subtitulo: event.target.value,
                            })
                        }
                        placeholder={
                            empresa.descripcion ?? 'Una línea bajo el título'
                        }
                        rows={2}
                        maxLength={200}
                        disabled={!ajustes.encabezado_mostrar_subtitulo}
                    />
                </div>
            </Seccion>

            <Seccion
                icono={<PanelBottom className="size-4" />}
                titulo="Pie de página"
                activo={pie}
                onActivo={onPie}
                dataTest="catalogo-pie"
            >
                <div className="grid gap-1.5">
                    <Label>Redes que se muestran</Label>
                    {empresa.redes.length > 0 ? (
                        <div className="grid gap-1.5">
                            {empresa.redes.map((red) => (
                                <label
                                    key={red.id}
                                    className="flex min-w-0 items-center gap-2 text-sm"
                                >
                                    <Checkbox
                                        checked={!ocultas.has(red.id)}
                                        onCheckedChange={(marcado) =>
                                            cambiar({
                                                pie_ocultar_redes:
                                                    marcado === true
                                                        ? ajustes.pie_ocultar_redes.filter(
                                                              (id) =>
                                                                  id !== red.id,
                                                          )
                                                        : [
                                                              ...ajustes.pie_ocultar_redes,
                                                              red.id,
                                                          ],
                                            })
                                        }
                                    />
                                    <IconoRed
                                        red={red.red}
                                        disponibles={redesDisponibles}
                                        imagen={red.icono_url}
                                    />
                                    <span className="truncate">
                                        {red.valor}
                                    </span>
                                </label>
                            ))}
                        </div>
                    ) : (
                        <p className="text-muted-foreground text-xs">
                            La empresa no tiene redes sociales: se muestran su
                            teléfono y correo.
                        </p>
                    )}
                </div>
                <div className="grid gap-1.5">
                    <div className="flex items-center justify-between gap-2">
                        <Label htmlFor="pie-texto">Texto central</Label>
                        <label className="text-muted-foreground flex items-center gap-1.5 text-xs">
                            <Checkbox
                                checked={ajustes.pie_mostrar_texto}
                                onCheckedChange={(marcado) =>
                                    cambiar({
                                        pie_mostrar_texto: marcado === true,
                                    })
                                }
                            />
                            Mostrar
                        </label>
                    </div>
                    <Input
                        id="pie-texto"
                        value={ajustes.pie_texto ?? ''}
                        onChange={(event) =>
                            cambiar({ pie_texto: event.target.value })
                        }
                        placeholder={
                            empresa.colaboracion
                                ? `En colaboración de ${empresa.colaboracion}`
                                : 'Ej.: Precios válidos hasta agotar existencias'
                        }
                        maxLength={120}
                        disabled={!ajustes.pie_mostrar_texto}
                        data-test="catalogo-pie-texto"
                    />
                </div>
                <label className="flex items-center gap-2 text-sm">
                    <Checkbox
                        checked={ajustes.pie_paginas}
                        onCheckedChange={(marcado) =>
                            cambiar({ pie_paginas: marcado === true })
                        }
                    />
                    Número de página
                </label>
            </Seccion>
        </div>
    );
}

function Seccion({
    icono,
    titulo,
    activo,
    onActivo,
    dataTest,
    children,
}: {
    icono: ReactNode;
    titulo: string;
    activo: boolean;
    onActivo: (valor: boolean) => void;
    dataTest: string;
    children: ReactNode;
}) {
    return (
        <div className="bg-card rounded-md border" data-test={dataTest}>
            <label className="flex items-center gap-2 border-b p-3 text-sm font-medium">
                {icono}
                <span className="flex-1">{titulo}</span>
                <Switch checked={activo} onCheckedChange={onActivo} />
            </label>
            {activo ? (
                <div className="grid gap-3 p-3">{children}</div>
            ) : (
                <p className="text-muted-foreground p-3 text-xs">
                    Sin {titulo.toLowerCase()}: el contenido usa más espacio de
                    la hoja.
                </p>
            )}
        </div>
    );
}
