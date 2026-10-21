<?php

namespace App\Modules\Catalogo\Http\Requests;

use App\Support\Importaciones\TiposImportacion;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreImportacionRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'tipo' => ['required', Rule::in(TiposImportacion::claves())],
            // The file itself, or the one a preview kept aside (with how its
            // headers relate to the columns).
            'archivo' => ['required_without:archivo_temporal', 'file', 'extensions:csv,txt,xlsx', 'max:51200'],
            'archivo_temporal' => ['required_without:archivo', 'string', 'regex:/^[A-Za-z0-9]{40}\.(csv|txt|xlsx)$/'],
            'nombre_original' => ['nullable', 'string', 'max:255'],
            'mapeo' => ['nullable', 'array'],
            'mapeo.*' => ['nullable', 'string', 'max:255'],
        ];
    }
}
