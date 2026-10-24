import type { ComponentProps } from 'react';
import CompraEdicionPage from '@/components/compras-pos/compra-edicion-page';
import { index } from '@/routes/compras';

/** Editing a compra: the Compras POS, in edit mode. */
export default function CompraEditar(
    props: ComponentProps<typeof CompraEdicionPage>,
) {
    return <CompraEdicionPage {...props} />;
}

CompraEditar.layout = () => ({
    breadcrumbs: [
        { title: 'Compras', href: index() },
        { title: 'Editar', href: '#' },
    ],
});
