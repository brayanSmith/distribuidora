import type { ComponentProps } from 'react';
import PosEdicionPage from '@/components/pos/pos-edicion-page';
import { index } from '@/routes/pedidos';

/** Editing a pedido: the POS, in edit mode. */
export default function PedidoEditar(
    props: ComponentProps<typeof PosEdicionPage>,
) {
    return <PosEdicionPage {...props} />;
}

PedidoEditar.layout = () => ({
    breadcrumbs: [
        { title: 'Pedidos', href: index() },
        { title: 'Editar', href: '#' },
    ],
});
