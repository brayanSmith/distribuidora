<?php

namespace App\Modules\Catalogo\Http\Requests;

use App\Modules\Catalogo\Models\Producto;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateProductoRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $producto = $this->route('producto');

        abort_if(! $producto instanceof Producto, 404);

        return [
            'categoria_id' => ['nullable', 'integer', 'exists:categorias,id'],
            'sub_categoria_id' => ['nullable', 'integer', Rule::exists('sub_categorias', 'id')->where(fn ($query) => $query->where('categoria_id', $this->input('categoria_id')))],
            'inventariable' => ['boolean'],
            'marca_id' => ['nullable', 'integer', 'exists:marcas,id'],
            'referencia_producto' => ['nullable', 'string', 'max:255'],
            'descripcion_producto' => ['nullable', 'string', 'max:255'],
            'costo_producto' => ['nullable', 'numeric', 'min:0'],
            'valor_detal' => ['nullable', 'numeric', 'min:0'],
            'valor_mayorista' => ['nullable', 'numeric', 'min:0'],
            'imagenes' => ['nullable', 'array', 'max:10'],
            'imagenes.*' => ['image', 'max:4096'],
            'remove_imagen_ids' => ['nullable', 'array'],
            'remove_imagen_ids.*' => ['integer', Rule::exists('imagen_productos', 'id')->where('producto_id', $producto->id)],
            'sku' => ['nullable', 'string', 'max:255', Rule::unique('productos', 'sku')->ignore($producto->id)],
        ];
    }
}
