export type Empresa = {
    id: number;
    nombre_empresa: string;
    direccion_empresa: string | null;
    telefono_empresa: string | null;
    email_empresa: string | null;
    nit_empresa: string | null;
    logo_empresa: string | null;
    logo_empresa_url: string | null;
    /** How the logo is printed. */
    formato_logo: FormatoLogo;
    /** The square icon: browser tab, sidebar and notifications. */
    icono_empresa: string | null;
    icono_empresa_url: string | null;
};

export type FormatoLogo = 'CUADRADO' | 'RECTANGULAR';

export type EmpresaPermissions = {
    canUpdate: boolean;
};
