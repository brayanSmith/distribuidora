<?php

namespace App\Modules\Administracion\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateEmpresaRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'nombre_empresa' => ['required', 'string', 'max:255'],
            'direccion_empresa' => ['nullable', 'string', 'max:255'],
            'telefono_empresa' => ['nullable', 'string', 'max:255'],
            'email_empresa' => ['nullable', 'string', 'email', 'max:255'],
            'nit_empresa' => ['nullable', 'string', 'max:255'],
            'logo_empresa' => ['nullable', 'image', 'max:4096'],
            'remove_logo_empresa' => ['boolean'],
            'formato_logo' => ['sometimes', 'in:CUADRADO,RECTANGULAR'],
            // Square, and big enough for phones (they show it at 192 px).
            'icono_empresa' => ['nullable', 'image', 'max:2048', 'dimensions:min_width=64,min_height=64'],
            'remove_icono_empresa' => ['boolean'],
        ];
    }
}
