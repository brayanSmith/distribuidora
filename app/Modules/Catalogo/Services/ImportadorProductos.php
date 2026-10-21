<?php

namespace App\Modules\Catalogo\Services;

use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\Importacion;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Models\SubCategoria;
use App\Support\Importaciones\FilaInvalida;
use App\Support\Importaciones\Importador;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

/**
 * Imports productos. A producto is matched by its SKU; the categorias and
 * subcategorias that do not exist yet are created on the way.
 */
class ImportadorProductos extends Importador
{
    /** Columns of the file, in the order the template lists them. */
    public const COLUMNAS = [
        'sku', 'marca', 'referencia', 'descripcion', 'categoria', 'subcategoria',
        'costo', 'valor_detal', 'valor_mayorista', 'inventariable',
    ];

    /** Other names a header may have, by the column they stand for. */
    private const ALIAS = [
        'referencia_producto' => 'referencia',
        'descripcion_producto' => 'descripcion',
        'sub_categoria' => 'subcategoria',
        'categoria_producto' => 'categoria',
        'costo_producto' => 'costo',
        'detal' => 'valor_detal',
        'mayorista' => 'valor_mayorista',
    ];

    /** @var array<string, Categoria> */
    private array $categorias = [];

    /** @var array<string, SubCategoria> */
    private array $subCategorias = [];

    public function columnas(): array
    {
        return self::COLUMNAS;
    }

    public function filaDeEjemplo(): array
    {
        return ['SKU-001', 'Marca', 'Referencia', 'Descripción', 'Categoría', 'Subcategoría', '100000', '150000', '130000', 'si'];
    }

    protected function alias(): array
    {
        return self::ALIAS;
    }

    protected function procesarFila(Importacion $importacion, array $fila): void
    {
        $datos = $this->validar($fila);

        $categoria = $datos['categoria'] !== null ? $this->categoria($datos['categoria']) : null;
        $subCategoria = $categoria !== null && $datos['subcategoria'] !== null
            ? $this->subCategoria($categoria, $datos['subcategoria'])
            : null;

        $atributos = array_filter([
            'categoria_id' => $categoria?->id,
            'sub_categoria_id' => $subCategoria?->id,
            'marca' => $datos['marca'],
            'referencia_producto' => $datos['referencia'],
            'descripcion_producto' => $datos['descripcion'],
            'costo_producto' => $datos['costo'],
            'valor_detal' => $datos['valor_detal'],
            'valor_mayorista' => $datos['valor_mayorista'],
            'inventariable' => $datos['inventariable'],
        ], fn (mixed $valor): bool => $valor !== null);

        $producto = $datos['sku'] !== null
            ? Producto::withTrashed()->where('sku', $datos['sku'])->first()
            : null;

        if ($producto === null) {
            Producto::create($atributos + ['sku' => $datos['sku']]);
            $importacion->creados++;

            return;
        }

        if ($producto->trashed()) {
            $producto->restore();
        }

        $producto->update($atributos);
        $importacion->actualizados++;
    }

    /**
     * @param  array<string, mixed>  $fila
     * @return array{sku: ?string, marca: ?string, referencia: ?string, descripcion: ?string, categoria: ?string, subcategoria: ?string, costo: ?float, valor_detal: ?float, valor_mayorista: ?float, inventariable: ?bool}
     */
    private function validar(array $fila): array
    {
        $texto = fn (string $columna): ?string => $this->texto($fila, $columna);

        $datos = [];
        foreach (['sku', 'marca', 'referencia', 'descripcion', 'categoria', 'subcategoria'] as $columna) {
            $datos[$columna] = $texto($columna);
        }
        foreach (['costo', 'valor_detal', 'valor_mayorista'] as $columna) {
            $datos[$columna] = $this->numero($texto($columna));
        }
        $datos['inventariable'] = $this->booleano($texto('inventariable'));

        $validador = Validator::make($datos, [
            'sku' => ['nullable', 'string', 'max:255'],
            'marca' => ['nullable', 'string', 'max:255'],
            'referencia' => ['nullable', 'string', 'max:255', 'required_without:sku'],
            'descripcion' => ['nullable', 'string', 'max:255'],
            'categoria' => ['nullable', 'string', 'max:255'],
            'subcategoria' => ['nullable', 'string', 'max:255'],
            'costo' => ['nullable', 'numeric', 'min:0'],
            'valor_detal' => ['nullable', 'numeric', 'min:0'],
            'valor_mayorista' => ['nullable', 'numeric', 'min:0'],
        ], [
            'referencia.required_without' => 'La fila necesita un SKU o una referencia.',
        ]);

        if ($datos['subcategoria'] !== null && $datos['categoria'] === null) {
            throw new FilaInvalida('La subcategoría necesita una categoría.');
        }

        if ($validador->fails()) {
            throw new FilaInvalida($validador->errors()->first());
        }

        return $datos;
    }

    private function categoria(string $nombre): Categoria
    {
        return $this->categorias[Str::lower($nombre)] ??= Categoria::query()
            ->whereRaw('lower(nombre_categoria) = ?', [Str::lower($nombre)])
            ->first() ?? Categoria::create(['nombre_categoria' => $nombre]);
    }

    private function subCategoria(Categoria $categoria, string $nombre): SubCategoria
    {
        return $this->subCategorias[$categoria->id.'|'.Str::lower($nombre)] ??= SubCategoria::query()
            ->where('categoria_id', $categoria->id)
            ->whereRaw('lower(nombre_sub_categoria) = ?', [Str::lower($nombre)])
            ->first() ?? SubCategoria::create(['categoria_id' => $categoria->id, 'nombre_sub_categoria' => $nombre]);
    }
}
