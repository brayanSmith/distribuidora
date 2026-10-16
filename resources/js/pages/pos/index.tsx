import PosPage from '@/components/pos/pos-page';
import { index } from '@/routes/pos';
import type {
    BodegaOption,
    ClienteOption,
    CategoriaOption,
    MarcaOption,
    PosCatalogoProducto,
    PucOption,
    VendedorOption,
} from '@/types';

type Props = {
    clientes: ClienteOption[];
    productos: PosCatalogoProducto[];
    bodegas: BodegaOption[];
    vendedores: VendedorOption[];
    pucs: PucOption[];
    marcas: MarcaOption[];
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
