import { Plus, Search } from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import type { Ref } from 'react';
import CompraProductoCard from '@/components/compras-pos/compra-producto-card';
import Pagination from '@/components/pagination';
import CreateProductoModal from '@/components/productos/create-producto-modal';
import CategoriaFiltro, {
    contarCategorias,
    pasaFiltroCategoria,
    TODAS_LAS_CATEGORIAS,
} from '@/components/productos/categoria-filtro';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { CategoriaOption, CompraPosProducto } from '@/types';

type Props = {
    productos: CompraPosProducto[];
    categorias: CategoriaOption[];
    canCreateProducto: boolean;
    /** Units of each producto (by id) already in the compra. */
    enCompra: Map<number, number>;
    onSeleccionar: (producto: CompraPosProducto) => void;
    /** Lets the screen focus the search box (F2). */
    busquedaRef?: Ref<HTMLInputElement>;
    /** Lets the screen open the new-product form (F4). */
    nuevoProductoRef?: Ref<HTMLButtonElement>;
};

const PAGE_SIZE = 48;

/**
 * The productos to buy, as the Compras POS shows them: search, categories,
 * a new-product button and a page of cards to tap.
 */
export default function CompraCatalogo({
    productos,
    categorias,
    canCreateProducto,
    enCompra,
    onSeleccionar,
    busquedaRef,
    nuevoProductoRef,
}: Props) {
    const [busqueda, setBusqueda] = useState('');
    const [categoria, setCategoria] = useState(TODAS_LAS_CATEGORIAS);
    const [subCategoria, setSubCategoria] = useState('');
    const [pagina, setPagina] = useState(1);

    const conteos = useMemo(
        () =>
            contarCategorias(
                productos,
                (producto) => producto.categoria_id,
                (producto) => producto.sub_categoria,
            ),
        [productos],
    );

    const filtrados = useMemo(() => {
        const termino = busqueda.trim().toLowerCase();

        return productos.filter(
            (producto) =>
                pasaFiltroCategoria(
                    categoria,
                    subCategoria,
                    producto.categoria_id,
                    producto.sub_categoria,
                ) &&
                (!termino ||
                    `${producto.nombre} ${producto.sku ?? ''}`
                        .toLowerCase()
                        .includes(termino)),
        );
    }, [productos, busqueda, categoria, subCategoria]);

    useEffect(() => setPagina(1), [busqueda, categoria, subCategoria]);

    const totalPaginas = Math.max(Math.ceil(filtrados.length / PAGE_SIZE), 1);
    const paginaActual = Math.min(pagina, totalPaginas);
    const visibles = filtrados.slice(
        (paginaActual - 1) * PAGE_SIZE,
        paginaActual * PAGE_SIZE,
    );

    return (
        <div className="min-w-0 space-y-3">
            <div className="flex flex-wrap items-center gap-2">
                <div className="relative min-w-48 flex-1">
                    <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
                    <Input
                        ref={busquedaRef}
                        value={busqueda}
                        onChange={(event) => setBusqueda(event.target.value)}
                        placeholder="Buscar por nombre o SKU… (F2)"
                        className="pl-9"
                        data-test="compras-pos-buscar"
                    />
                </div>
                <CategoriaFiltro
                    categorias={categorias}
                    categoria={categoria}
                    subCategoria={subCategoria}
                    onChange={(nuevaCategoria, nuevaSub) => {
                        setCategoria(nuevaCategoria);
                        setSubCategoria(nuevaSub);
                    }}
                    conteos={conteos}
                    dataTest="compras-pos-categoria"
                />
                {canCreateProducto ? (
                    <CreateProductoModal categorias={categorias} stayOnPage>
                        <Button
                            ref={nuevoProductoRef}
                            type="button"
                            data-test="compras-pos-nuevo-producto"
                        >
                            <Plus /> Nuevo producto
                            <kbd className="text-xs opacity-70">F4</kbd>
                        </Button>
                    </CreateProductoModal>
                ) : null}
            </div>

            {visibles.length > 0 ? (
                <div className="grid grid-cols-[repeat(auto-fill,minmax(10rem,1fr))] items-stretch gap-2">
                    {visibles.map((producto) => (
                        <CompraProductoCard
                            key={producto.id}
                            producto={producto}
                            enCompra={enCompra.get(producto.id) ?? 0}
                            onAdd={onSeleccionar}
                        />
                    ))}
                </div>
            ) : (
                <p className="text-muted-foreground py-8 text-center text-sm">
                    No se encontraron productos.
                </p>
            )}

            {filtrados.length > 0 ? (
                <div className="flex flex-col items-center gap-2 text-sm">
                    <Pagination
                        page={paginaActual}
                        totalPages={totalPaginas}
                        onPageChange={setPagina}
                        dataTest="compras-pos-pagina"
                    />
                    <span className="text-muted-foreground">
                        {filtrados.length} productos
                    </span>
                </div>
            ) : null}
        </div>
    );
}
