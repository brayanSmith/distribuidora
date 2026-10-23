import { Form, Head, usePage } from '@inertiajs/react';
import { useState } from 'react';
import Heading from '@/components/heading';
import ImageField from '@/components/image-field';
import type { FormatoRecorte } from '@/components/image-drop-cropper';
import InputError from '@/components/input-error';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { edit, update } from '@/routes/empresa';
import type { Empresa, EmpresaPermissions, FormatoLogo } from '@/types';

type Props = {
    empresa: Empresa | null;
    permissions: EmpresaPermissions;
};

export default function EmpresaEdit({ empresa, permissions }: Props) {
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

                <Form {...update.form()} className="space-y-6">
                    {({ errors, processing }) => (
                        <>
                            <div className="grid gap-4 sm:grid-cols-2">
                                <div className="grid gap-2">
                                    <Label required htmlFor="nombre_empresa">
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
                                    <InputError message={errors.nit_empresa} />
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
                                    <Label htmlFor="email_empresa">Email</Label>
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
                                            value={empresa?.icono_empresa_url}
                                            error={errors.icono_empresa}
                                            maxLado={512}
                                        />
                                        <p className="text-muted-foreground text-xs">
                                            Imagen cuadrada (ideal 512 × 512
                                            px). Se usa en la pestaña del
                                            navegador, el menú lateral y las
                                            notificaciones. Si no subes uno, se
                                            usa el logo.
                                        </p>
                                    </div>

                                    <LogoCampo
                                        empresa={empresa}
                                        error={errors.logo_empresa}
                                        errorFormato={errors.formato_logo}
                                    />
                                </div>
                            ) : null}

                            {permissions.canUpdate ? (
                                <div className="flex items-center gap-4">
                                    <Button
                                        type="submit"
                                        data-test="empresa-save-button"
                                        disabled={processing}
                                    >
                                        Guardar
                                    </Button>
                                </div>
                            ) : null}
                        </>
                    )}
                </Form>
            </div>
        </>
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
