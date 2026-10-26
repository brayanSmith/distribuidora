<?php

namespace App\Modules\Administracion\Http\Requests;

use App\Support\RedesSociales;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

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
            'color_primario' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'color_acento' => ['nullable', 'regex:/^#[0-9a-fA-F]{6}$/'],
            'eslogan_empresa' => ['nullable', 'string', 'max:120'],
            'descripcion_empresa' => ['nullable', 'string', 'max:400'],
            // The form says it sent them, so an empty list clears them.
            'redes_sociales_enviadas' => ['sometimes', 'boolean'],
            'redes_sociales' => ['nullable', 'array', 'max:12'],
            'redes_sociales.*.red' => ['required', Rule::in(RedesSociales::claves())],
            'redes_sociales.*.valor' => ['required', 'string', 'max:120'],
            'redes_sociales.*.nombre' => ['nullable', 'required_if:redes_sociales.*.red,'.RedesSociales::PERSONALIZADA, 'string', 'max:40'],
            'redes_sociales.*.icono' => ['nullable', 'string', 'max:255'],
            'redes_sociales.*.icono_archivo' => ['nullable', 'image', 'max:1024'],
            'colaboracion_empresa' => ['nullable', 'string', 'max:120'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'color_primario.regex' => 'Elige un color válido.',
            'color_acento.regex' => 'Elige un color válido.',
            'redes_sociales.*.valor.required' => 'Escribe el usuario, número o enlace.',
            'redes_sociales.*.nombre.required_if' => 'Escribe el nombre de la red.',
            'redes_sociales.*.icono_archivo.image' => 'El ícono debe ser una imagen.',
        ];
    }
}
