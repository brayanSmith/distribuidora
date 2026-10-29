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
    /** Brand colors (#rrggbb); the catalog uses defaults while empty. */
    color_primario: string | null;
    color_acento: string | null;
    /** The app's colors for everyone; empty keeps the app's own. */
    color_menu: string | null;
    color_plataforma: string | null;
    color_plataforma_oscuro: string | null;
    eslogan_empresa: string | null;
    descripcion_empresa: string | null;
    /** The networks the company lists, in its order. */
    redes: RedSocialEmpresa[];
    /** "En colaboración de…": the catalog's footer. */
    colaboracion_empresa: string | null;
};

export type FormatoLogo = 'CUADRADO' | 'RECTANGULAR';

export type RedSocialEmpresa = {
    /** A key of the networks offered, or "personalizada". */
    red: string;
    nombre: string;
    /** User, number or link, as typed. */
    valor: string;
    /** Custom ones: the stored path and URL of the uploaded icon. */
    icono: string | null;
    icono_url: string | null;
};

/** A network the company can pick (App\Support\RedesSociales). */
export type RedDisponible = {
    clave: string;
    nombre: string;
    color: string;
    ejemplo: string;
    /** Brand icons are filled; generic ones stroked. */
    modo: 'relleno' | 'trazo';
    /** SVG markup on a 24 × 24 box. */
    svg: string;
};

export type EmpresaPermissions = {
    canUpdate: boolean;
};
