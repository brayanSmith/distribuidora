<?php

namespace App\Modules\Catalogo\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreProductoRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
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
            'sku' => ['nullable', 'string', 'max:255', 'unique:productos,sku'],
        ];
    }
}
