/**
 * The app's colors are the company's (Empresas › Colores de la plataforma),
 * the same for everyone. The server writes them in the page; this keeps them
 * up to date while the app is open.
 */

/** The company's colors (Empresas), as the server writes them. */
export type TemaEmpresa = {
    menu: string | null;
    plataforma: string | null;
    plataforma_oscuro: string | null;
    css: string;
};

const EMPRESA_STYLE_ID = 'empresa-tema';

/** Where each user kept their own colors, before Empresas set them for everyone. */
const COLORES_PERSONALES = ['primary-color', 'primary-color-dark', 'nav-color'];

/**
 * Forgets the colors a user had picked in Apariencia (and the style they
 * wrote), so the company's apply for everyone.
 */
export function initializeThemeColor(): void {
    if (typeof document === 'undefined') {
        return;
    }

    document.getElementById('theme-colors-style')?.remove();

    try {
        COLORES_PERSONALES.forEach((clave) => localStorage.removeItem(clave));
    } catch {
        // Storage not available (private window): nothing was kept there.
    }
}

/**
 * Keeps the company's colors (Empresas) in place after they change, without
 * a reload.
 */
export function applyEmpresaTheme(tema: TemaEmpresa | undefined): void {
    if (typeof document === 'undefined' || !tema) {
        return;
    }

    let style = document.getElementById(EMPRESA_STYLE_ID);

    if (!style) {
        style = document.createElement('style');
        style.id = EMPRESA_STYLE_ID;
        document.head.prepend(style);
    }

    if (style.textContent !== tema.css) {
        style.textContent = tema.css;
    }
}
