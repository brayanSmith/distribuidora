<?php

namespace App\Modules\Catalogo\Http\Controllers;

use App\Http\Controllers\Controller;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Services\ImportadorProductos;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Gate;
use Spatie\SimpleExcel\SimpleExcelWriter;
use Symfony\Component\HttpFoundation\StreamedResponse;

class ExportacionProductosController extends Controller
{
    /**
     * Download every producto as CSV, TXT (tab separated) or Excel, streamed row
     * by row so a big catalog does not fill the memory. The file has the same
     * columns the import reads, so it can be edited and imported back.
     */
    public function __invoke(Request $request): StreamedResponse
    {
        Gate::authorize('productos.export');

        $formato = $request->validate(['formato' => ['required', 'in:csv,txt,xlsx']])['formato'];
        $usuario = $request->user();

        return response()->streamDownload(function () use ($formato, $usuario): void {
            $escritor = match ($formato) {
                'xlsx' => SimpleExcelWriter::create('php://output', 'xlsx'),
                'txt' => SimpleExcelWriter::create('php://output', 'csv', delimiter: "\t"),
                default => SimpleExcelWriter::create('php://output', 'csv'),
            };

            $escritor->addHeader(ImportadorProductos::COLUMNAS);

            $precio = fn (string $tipo, mixed $valor): mixed => $usuario->puedeVerPrecio($tipo) ? $valor : null;

            Producto::query()
                ->with(['categoria:id,nombre_categoria', 'subCategoria:id,nombre_sub_categoria'])
                ->orderBy('id')
                ->lazyById(1000)
                ->each(function (Producto $producto) use ($escritor, $precio): void {
                    $escritor->addRow([
                        'sku' => $producto->sku,
                        'marca' => $producto->marca,
                        'referencia' => $producto->referencia_producto,
                        'descripcion' => $producto->descripcion_producto,
                        'categoria' => $producto->categoria?->nombre_categoria,
                        'subcategoria' => $producto->subCategoria?->nombre_sub_categoria,
                        'costo' => $precio('costo', $producto->costo_producto),
                        'valor_detal' => $precio('valor_detal', $producto->valor_detal),
                        'valor_mayorista' => $precio('valor_mayorista', $producto->valor_mayorista),
                        'inventariable' => $producto->inventariable ? 'si' : 'no',
                        // Left empty: re-importing the file keeps the images the productos have.
                        'imagen_adjunta' => null,
                    ]);
                });

            $escritor->close();
        }, "productos.{$formato}");
    }
}
