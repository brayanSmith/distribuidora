<?php

namespace App\Modules\Catalogo\Http\Requests;

use App\Modules\Catalogo\Models\SubCategoria;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateSubCategoriaRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $subCategoria = $this->route('sub_categoria');

        abort_if(! $subCategoria instanceof SubCategoria, 404);

        return [
            'categoria_id' => ['required', 'integer', 'exists:categorias,id'],
            'nombre_sub_categoria' => [
                'required', 'string', 'max:255',
                Rule::unique('sub_categorias', 'nombre_sub_categoria')
                    ->where('categoria_id', $this->input('categoria_id'))
                    ->ignore($subCategoria->id),
            ],
        ];
    }
}
