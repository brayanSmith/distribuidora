import { Form, Head, Link, usePage } from '@inertiajs/react';
import {
    Building2,
    Hash,
    Mail,
    MapPin,
    Pencil,
    Phone,
    ReceiptText,
    Save,
} from 'lucide-react';
import { useState } from 'react';
import Heading from '@/components/heading';
import ImageField from '@/components/image-field';
import type { FormatoRecorte } from '@/components/image-drop-cropper';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';
import { edit, update } from '@/routes/empresa';
import { edit as voucherEdit } from '@/routes/empresa/voucher';
import type { Empresa, EmpresaPermissions, FormatoLogo } from '@/types';

type Props = {
    empresa: Empresa | null;
    permissions: EmpresaPermissions;
};

export default function EmpresaEdit({ empresa, permissions }: Props) {
    // Shown as a card so nothing is changed by mistake; the form opens on
    // purpose (or straight away while there is no company yet).
    const [editando, setEditando] = useState(
        permissions.canUpdate && empresa === null,
    );

    return (
        <>
            <Head title="Empresa" />

            <h1 className="sr-only">Perfil de la empresa</h1>

            <div className="space-y-6">
                <Heading
                    variant="small"
                    title="Perfil de la empresa"
                    description="Esta información aparece en tus documentos y facturas"
                />

                {!editando && empresa ? (
                    <EmpresaTarjeta
                        empresa={empresa}
                        onEditar={
                            permissions.canUpdate
                                ? () => setEditando(true)
                                : undefined
                        }
                    />
                ) : null}

                {!editando && !empresa ? (
                    <p className="text-muted-foreground rounded-lg border py-10 text-center text-sm">
                        Todavía no se han registrado los datos de la empresa.
                    </p>
                ) : null}

                {editando ? (
                    <Form
                        {...update.form()}
                        className="bg-card space-y-6 rounded-lg border p-5"
                        options={{ preserveScroll: true }}
                        onSuccess={() => setEditando(false)}
                    >
                        {({ errors, processing }) => (
                            <>
                                <div className="grid gap-4 sm:grid-cols-2">
                                    <div className="grid gap-2">
                                        <Label
                                            required
                                            htmlFor="nombre_empresa"
                                        >
                                            Nombre
                                        </Label>
                                        <Input
                                            id="nombre_empresa"
                                            name="nombre_empresa"
                                            data-test="empresa-nombre"
                                            defaultValue={
                                                empresa?.nombre_empresa ?? ''
                                            }
                                            disabled={!permissions.canUpdate}
                                            required
                                        />
                                        <InputError
                                            message={errors.nombre_empresa}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="nit_empresa">NIT</Label>
                                        <Input
                                            id="nit_empresa"
                                            name="nit_empresa"
                                            data-test="empresa-nit"
                                            defaultValue={
                                                empresa?.nit_empresa ?? ''
                                            }
                                            disabled={!permissions.canUpdate}
                                        />
                                        <InputError
                                            message={errors.nit_empresa}
                                        />
                                    </div>

                                    <div className="grid gap-2 sm:col-span-2">
                                        <Label htmlFor="direccion_empresa">
                                            Dirección
                                        </Label>
                                        <Input
                                            id="direccion_empresa"
                                            name="direccion_empresa"
                                            defaultValue={
                                                empresa?.direccion_empresa ?? ''
                                            }
                                            disabled={!permissions.canUpdate}
                                        />
                                        <InputError
                                            message={errors.direccion_empresa}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="telefono_empresa">
                                            Teléfono
                                        </Label>
                                        <Input
                                            id="telefono_empresa"
                                            name="telefono_empresa"
                                            defaultValue={
                                                empresa?.telefono_empresa ?? ''
                                            }
                                            disabled={!permissions.canUpdate}
                                        />
                                        <InputError
                                            message={errors.telefono_empresa}
                                        />
                                    </div>

                                    <div className="grid gap-2">
                                        <Label htmlFor="email_empresa">
                                            Email
                                        </Label>
                                        <Input
                                            id="email_empresa"
                                            name="email_empresa"
                                            type="email"
                                            defaultValue={
                                                empresa?.email_empresa ?? ''
                                            }
                                            disabled={!permissions.canUpdate}
                                        />
                                        <InputError
                                            message={errors.email_empresa}
                                        />
                                    </div>
                                </div>

                                {permissions.canUpdate ? (
                                    <div className="grid gap-6 sm:grid-cols-2">
                                        <div className="grid content-start gap-3">
                                            <ImageField
                                                name="icono_empresa"
                                                removeName="remove_icono_empresa"
                                                label="Ícono de la empresa"
                                                value={
                                                    empresa?.icono_empresa_url
                                                }
                                                error={errors.icono_empresa}
                                                maxLado={512}
                                            />
                                            <p className="text-muted-foreground text-xs">
                                                Imagen cuadrada (ideal 512 × 512
                                                px). Se usa en la pestaña del
                                                navegador, el menú lateral y las
                                                notificaciones. Si no subes uno,
                                                se usa el logo.
                                            </p>
                                        </div>

                                        <LogoCampo
                                            empresa={empresa}
                                            error={errors.logo_empresa}
                                            errorFormato={errors.formato_logo}
                                        />
                                    </div>
                                ) : null}

                                <div className="flex flex-wrap items-center justify-end gap-2 border-t pt-4">
                                    {empresa ? (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={() => setEditando(false)}
                                            disabled={processing}
                                            data-test="empresa-cancelar"
                                        >
                                            Cancelar
                                        </Button>
                                    ) : null}
                                    <Button
                                        type="submit"
                                        data-test="empresa-save-button"
                                        disabled={processing}
                                    >
                                        <Save />
                                        Guardar cambios
                                    </Button>
                                </div>
                            </>
                        )}
                    </Form>
                ) : null}
            </div>
        </>
    );
}

/**
 * The company's data, read only: what prints on the vouchers and brands the
 * app. Changing it takes a deliberate click.
 */
function EmpresaTarjeta({
    empresa,
    onEditar,
}: {
    empresa: Empresa;
    onEditar?: () => void;
}) {
    const datos: { icono: typeof Mail; label: string; valor: string | null }[] =
        [
            { icono: Hash, label: 'NIT', valor: empresa.nit_empresa },
            {
                icono: MapPin,
                label: 'Dirección',
                valor: empresa.direccion_empresa,
            },
            {
                icono: Phone,
                label: 'Teléfono',
                valor: empresa.telefono_empresa,
            },
            { icono: Mail, label: 'Email', valor: empresa.email_empresa },
        ];

    return (
        <div
            className="bg-card overflow-hidden rounded-lg border"
            data-test="empresa-tarjeta"
        >
            <div className="flex flex-wrap items-center gap-4 border-b p-5">
                {empresa.icono_empresa_url || empresa.logo_empresa_url ? (
                    <img
                        src={
                            empresa.icono_empresa_url ??
                            empresa.logo_empresa_url ??
                            ''
                        }
                        alt=""
                        className="bg-muted size-16 rounded-lg border object-contain"
                    />
                ) : (
                    <div className="bg-muted text-muted-foreground flex size-16 items-center justify-center rounded-lg border">
                        <Building2 className="size-7" />
                    </div>
                )}
                <div className="min-w-0 flex-1">
                    <div className="truncate text-xl font-semibold">
                        {empresa.nombre_empresa}
                    </div>
                    <div className="text-muted-foreground text-sm">
                        Así aparece en los vouchers y en la aplicación
                    </div>
                </div>
                <div className="flex flex-col gap-2 sm:items-stretch">
                    {onEditar ? (
                        <Button
                            type="button"
                            onClick={onEditar}
                            data-test="empresa-actualizar-datos"
                        >
                            <Pencil />
                            Actualizar datos
                        </Button>
                    ) : null}
                    <Button variant="outline" asChild>
                        <Link
                            href={voucherEdit()}
                            data-test="empresa-disenar-voucher"
                        >
                            <ReceiptText />
                            Diseñar voucher
                        </Link>
                    </Button>
                </div>
            </div>

            <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_auto]">
                <dl className="grid gap-4 sm:grid-cols-2">
                    {datos.map((dato) => (
                        <div key={dato.label} className="flex gap-3">
                            <dato.icono className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                            <div className="min-w-0">
                                <dt className="text-muted-foreground text-xs">
                                    {dato.label}
                                </dt>
                                <dd className="break-words">
                                    {dato.valor || (
                                        <span className="text-muted-foreground italic">
                                            Sin registrar
                                        </span>
                                    )}
                                </dd>
                            </div>
                        </div>
                    ))}
                </dl>

                <div className="flex flex-wrap gap-4">
                    <figure className="grid justify-items-center gap-1.5">
                        <div className="bg-muted flex size-20 items-center justify-center overflow-hidden rounded-md border">
                            {empresa.icono_empresa_url ? (
                                <img
                                    src={empresa.icono_empresa_url}
                                    alt="Ícono"
                                    className="size-full object-contain"
                                />
                            ) : (
                                <span className="text-muted-foreground px-1 text-center text-[10px]">
                                    Usa el logo
                                </span>
                            )}
                        </div>
                        <figcaption className="text-muted-foreground text-xs">
                            Ícono
                        </figcaption>
                    </figure>
                    <figure className="grid justify-items-center gap-1.5">
                        <div
                            className={cn(
                                'bg-muted flex h-20 items-center justify-center overflow-hidden rounded-md border',
                                empresa.formato_logo === 'CUADRADO'
                                    ? 'w-20'
                                    : 'w-48',
                            )}
                        >
                            {empresa.logo_empresa_url ? (
                                <img
                                    src={empresa.logo_empresa_url}
                                    alt="Logo"
                                    className="size-full object-contain"
                                />
                            ) : (
                                <span className="text-muted-foreground text-[10px]">
                                    Sin logo
                                </span>
                            )}
                        </div>
                        <figcaption className="text-muted-foreground text-xs">
                            Logo para impresiones (
                            {empresa.formato_logo === 'CUADRADO'
                                ? 'cuadrado'
                                : 'rectangular'}
                            )
                        </figcaption>
                    </figure>
                </div>
            </div>
        </div>
    );
}

/** The shapes the logo can be cropped to. */
const FORMATOS_LOGO: FormatoRecorte[] = [
    { value: 'CUADRADO', label: 'Cuadrado', aspecto: 1 },
    { value: 'RECTANGULAR', label: 'Rectangular', aspecto: 3 },
    { value: 'ORIGINAL', label: 'Sin recortar', aspecto: null },
];

/**
 * The logo, cropped to the shape it is printed with (vouchers): square
 * prints as a block, wide as the ticket's width.
 */
function LogoCampo({
    empresa,
    error,
    errorFormato,
}: {
    empresa: Empresa | null;
    error?: string;
    errorFormato?: string;
}) {
    const [formato, setFormato] = useState<FormatoLogo>(
        empresa?.formato_logo ?? 'RECTANGULAR',
    );

    return (
        <div className="grid content-start gap-3">
            <ImageField
                name="logo_empresa"
                removeName="remove_logo_empresa"
                label="Logo de la empresa"
                value={empresa?.logo_empresa_url}
                error={error}
                formatos={FORMATOS_LOGO}
                formatoInicial={formato}
                maxLado={1200}
                onFormatoChange={(_, aspecto) =>
                    // Uncut, the image's own shape decides.
                    setFormato(aspecto > 1.3 ? 'RECTANGULAR' : 'CUADRADO')
                }
            />
            <input type="hidden" name="formato_logo" value={formato} />
            <p className="text-muted-foreground text-xs">
                Se usa en las impresiones. Al subirlo eliges si queda cuadrado,
                rectangular o sin recortar.{' '}
                <span className="font-medium" data-test="empresa-formato-logo">
                    {formato === 'CUADRADO'
                        ? 'Se imprime como un bloque cuadrado.'
                        : 'Se imprime a lo ancho del ticket.'}
                </span>
            </p>
            <InputError message={errorFormato} />
        </div>
    );
}
EmpresaEdit.layout = () => ({
    breadcrumbs: [
        {
            title: 'Empresa',
            href: edit(),
        },
    ],
});
