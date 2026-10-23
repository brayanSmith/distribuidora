import PosPage from '@/components/pos/pos-page';
import { index } from '@/routes/pos';
import type {
    BodegaOption,
    ClienteOption,
    CategoriaOption,
    PosCatalogoProducto,
    PucOption,
    VendedorOption,
} from '@/types';

type Props = {
    clientes: ClienteOption[];
    productos: PosCatalogoProducto[];
    bodegas: BodegaOption[];
    vendedores: VendedorOption[];
    mensajeros: VendedorOption[];
    pucs: PucOption[];
    categorias: CategoriaOption[];
    canCreateProducto: boolean;
    canCreateCliente: boolean;
    canViewAllPedidos: boolean;
};

export default function PosIndex(props: Props) {
    return <PosPage {...props} />;
}

PosIndex.layout = () => ({
    breadcrumbs: [
        {
            title: 'POS',
            href: index(),
        },
    ],
});
