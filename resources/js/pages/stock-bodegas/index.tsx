import { Head } from '@inertiajs/react';
import { useState } from 'react';
import CreateTrasladoModal from '@/components/traslados/create-traslado-modal';
import Heading from '@/components/heading';
import StockBodegasTable from '@/components/stock-bodegas/stock-bodegas-table';
import { index } from '@/routes/stock-bodegas';
import type { Bodega, StockBodega } from '@/types';

type Props = {
    stockBodegas: StockBodega[];
    productos: NonNullable<StockBodega['producto']>[];
    bodegas: Bodega[];
    canViewInversion: boolean;
    canCreateTraslado: boolean;
    /** Every bodega, as a traslado may go to one without stock yet. */
    bodegasTraslado: Bodega[];
};

export default function StockBodegasIndex({
    stockBodegas,
    productos,
    bodegas,
    canViewInversion,
    canCreateTraslado,
    bodegasTraslado,
}: Props) {
    const [trasladoProductoId, setTrasladoProductoId] = useState<number | null>(
        null,
    );

    return (
        <>
            <Head title="Stock por bodega" />

            <div className="flex flex-col space-y-6">
                <Heading
                    variant="small"
                    title="Stock por bodega"
                    description="Consulta el stock actual de los productos por bodega"
                />

                <StockBodegasTable
                    stockBodegas={stockBodegas}
                    productos={productos}
                    bodegas={bodegas}
                    canViewInversion={canViewInversion}
                    onTraslado={
                        canCreateTraslado ? setTrasladoProductoId : undefined
                    }
                />
            </div>

            {canCreateTraslado ? (
                <CreateTrasladoModal
                    productos={productos}
                    bodegas={bodegasTraslado}
                    productoInicialId={trasladoProductoId ?? undefined}
                    open={trasladoProductoId !== null}
                    onOpenChange={(open) => {
                        if (!open) {
                            setTrasladoProductoId(null);
                        }
                    }}
                />
            ) : null}
        </>
    );
}

StockBodegasIndex.layout = () => ({
    breadcrumbs: [
        {
            title: 'Stock por bodega',
            href: index(),
        },
    ],
});
