<?php

namespace App\Modules\Catalogo\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreSubCategoriaRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'categoria_id' => ['required', 'integer', 'exists:categorias,id'],
            'nombre_sub_categoria' => [
                'required', 'string', 'max:255',
                Rule::unique('sub_categorias', 'nombre_sub_categoria')->where('categoria_id', $this->input('categoria_id')),
            ],
        ];
    }
}
