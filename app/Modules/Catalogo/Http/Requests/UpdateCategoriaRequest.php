<?php

namespace App\Modules\Catalogo\Http\Requests;

use App\Modules\Catalogo\Models\Categoria;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class UpdateCategoriaRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        $categoria = $this->route('categoria');

        abort_if(! $categoria instanceof Categoria, 404);

        return [
            'nombre_categoria' => ['required', 'string', 'max:255', Rule::unique('categorias', 'nombre_categoria')->ignore($categoria->id)],
        ];
    }
}
