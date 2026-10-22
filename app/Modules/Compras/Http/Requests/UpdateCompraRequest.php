<?php

namespace App\Modules\Compras\Http\Requests;

use App\Modules\Catalogo\Rules\ProductoInventariable;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Foundation\Http\FormRequest;

class UpdateCompraRequest extends FormRequest
{
    /**
     * Get the validation rules that apply to the request.
     *
     * @return array<string, ValidationRule|array<mixed>|string>
     */
    public function rules(): array
    {
        return [
            'factura' => ['required', 'string', 'max:255'],
            'proveedor_id' => ['required', 'integer', 'exists:proveedors,id'],
            'fecha' => ['required', 'date'],
            // Empty: the date of the compra plus the days of credit of the proveedor.
            'fecha_vencimiento' => ['nullable', 'date'],
            'observaciones' => ['nullable', 'string'],
            'descuento' => ['nullable', 'numeric', 'min:0'],
            'detalles' => ['required', 'array', 'min:1'],
            'detalles.*.producto_id' => ['required', 'integer', 'exists:productos,id', new ProductoInventariable],
            'detalles.*.bodega_id' => ['required', 'integer', 'exists:bodegas,id'],
            'detalles.*.cantidad' => ['required', 'numeric', 'min:0.01'],
            'detalles.*.precio_unitario' => ['required', 'numeric', 'min:0'],
            'detalles.*.recibido' => ['nullable', 'boolean'],
            // A partial receipt kept when editing (ignored when the line is received).
            'detalles.*.cantidad_recibida' => ['nullable', 'numeric', 'min:0'],
        ];
    }
}
