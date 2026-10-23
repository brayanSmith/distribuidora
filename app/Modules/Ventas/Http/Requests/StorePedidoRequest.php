<?php

namespace App\Modules\Ventas\Http\Requests;

use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StorePedidoRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'cliente_id' => ['required', 'integer', 'exists:clientes,id'],
            'fecha' => ['required', 'date'],
            // A POS sale sent in the background: its code makes resending it harmless.
            'codigo_sincronizacion' => ['nullable', 'uuid'],
            'user_id' => ['required', 'integer', 'exists:users,id'],
            'bodega_id' => ['required', 'integer', 'exists:bodegas,id'],
            'tipo_precio' => ['required', 'string', 'in:DETAL,MAYORISTA,OTRO'],
            'facturacion_electronica' => ['nullable', 'boolean'],
            'aplica_turno' => ['nullable', 'boolean'],
            'tipo_pago' => ['nullable', 'string', Rule::in(['CONTADO', 'SEPARADO', 'CREDITO', 'CONTRA_ENTREGA'])],
            // Contra entrega: where it is delivered (paid on delivery).
            'entrega' => ['nullable', 'array'],
            'entrega.direccion' => ['required_if:tipo_pago,CONTRA_ENTREGA', 'nullable', 'string', 'max:255'],
            'entrega.telefono' => ['required_if:tipo_pago,CONTRA_ENTREGA', 'nullable', 'string', 'max:50'],
            'entrega.ciudad' => ['nullable', 'string', 'max:255'],
            'entrega.recibe' => ['nullable', 'string', 'max:255'],
            'entrega.nota' => ['nullable', 'string', 'max:255'],
            'entrega.fecha_programada' => ['nullable', 'date', 'after_or_equal:today'],
            // Who takes it (optional): then only they get the notification.
            'entrega.mensajero_id' => ['nullable', 'integer', Rule::exists('users', 'id')],
            // Only for CREDITO; empty: the date plus the days of credit of the cliente.
            'fecha_vencimiento' => ['nullable', 'date'],
            // Separado: the day the cliente comes for it.
            'fecha_recogida' => ['nullable', 'date', 'after_or_equal:today'],
            'observacion' => ['nullable', 'string'],
            'observacion_pago' => ['nullable', 'string'],
            'flete' => ['nullable', 'numeric', 'min:0'],
            'descuento' => ['nullable', 'numeric', 'min:0'],
            'reteica' => ['nullable', 'numeric', 'min:0'],
            'retefuente' => ['nullable', 'numeric', 'min:0'],
            'abonos' => ['nullable', 'array'],
            'abonos.*.puc_id' => ['required', 'integer', 'exists:pucs,id'],
            'abonos.*.monto' => ['required', 'numeric', 'min:0.01'],
            'abonos.*.con_cuanto_pago' => ['nullable', 'numeric', 'min:0'],
            'abonos.*.descripcion' => ['nullable', 'string'],
            'detalles' => ['required', 'array', 'min:1'],
            'detalles.*.producto_id' => ['required', 'integer', 'exists:productos,id'],
            'detalles.*.bodega_id' => ['nullable', 'integer', 'exists:bodegas,id'],
            'detalles.*.cantidad' => ['required', 'numeric', 'min:0.01'],
            'detalles.*.tipo_precio' => ['nullable', 'in:DETAL,MAYORISTA,PERSONALIZADO'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
        ];
    }

    /**
     * @return array<string, string>
     */
    public function messages(): array
    {
        return [
            'fecha_recogida.after_or_equal' => 'La fecha de recogida no puede ser anterior a hoy.',
            'entrega.direccion.required_if' => 'La dirección de entrega es obligatoria para contra entrega.',
            'entrega.telefono.required_if' => 'El teléfono de entrega es obligatorio para contra entrega.',
        ];
    }
}
