import PedidosIndexPage from '@/components/pedidos/pedidos-index-page';
import * as pedidosMayoristasAbonosRoutes from '@/routes/pedidos-mayoristas/abonos';
import * as pedidosMayoristasRoutes from '@/routes/pedidos-mayoristas';
import { index } from '@/routes/pedidos-mayoristas';
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

export default function PedidosMayoristasIndex({
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
            routes={{
                pedidos: pedidosMayoristasRoutes,
                abonos: pedidosMayoristasAbonosRoutes,
            }}
            title="Pedidos Mayorista"
            description="Administra los pedidos al por mayor de los clientes"
        />
    );
}

PedidosMayoristasIndex.layout = () => ({
    breadcrumbs: [
        {
            title: 'Pedidos Mayorista',
            href: index(),
        },
    ],
});
