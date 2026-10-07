import PedidosIndexPage from '@/components/pedidos/pedidos-index-page';
import * as pedidosAbonosRoutes from '@/routes/pedidos/abonos';
import * as pedidosRoutes from '@/routes/pedidos';
import { index } from '@/routes/pedidos';
import type {
    Pedido,
    PedidoPermissions,
    PucOption,
    VendedorOption,
} from '@/types';

type Props = {
    pedidos: Pedido[];
    permissions: PedidoPermissions;
    eliminados: boolean;
    pucs: PucOption[];
    vendedores: VendedorOption[];
};

export default function PedidosIndex({
    pedidos,
    permissions,
    eliminados,
    pucs,
    vendedores,
}: Props) {
    return (
        <PedidosIndexPage
            pedidos={pedidos}
            permissions={permissions}
            eliminados={eliminados}
            pucs={pucs}
            vendedores={vendedores}
            routes={{ pedidos: pedidosRoutes, abonos: pedidosAbonosRoutes }}
            title="Pedidos"
            description="Administra los pedidos al detal de los clientes"
        />
    );
}

PedidosIndex.layout = () => ({
    breadcrumbs: [
        {
            title: 'Pedidos',
            href: index(),
        },
    ],
});
