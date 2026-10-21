<?php

namespace App\Modules\Finanzas\Services;

use App\Modules\Catalogo\Models\Importacion;
use App\Modules\Finanzas\Models\Puc;
use App\Support\Importaciones\FilaInvalida;
use App\Support\Importaciones\Importador;
use Illuminate\Support\Facades\Validator;
use Illuminate\Validation\Rule;

/**
 * Imports medios de pago (PUC accounts). An account is matched by its
 * subcuenta: an existing one is updated, a new one created.
 */
class ImportadorPucs extends Importador
{
    public function columnas(): array
    {
        return ['tipo', 'cuenta', 'subcuenta', 'concepto', 'descripcion'];
    }

    public function columnasObligatorias(): array
    {
        return ['tipo', 'cuenta', 'subcuenta', 'concepto'];
    }

    public function filaDeEjemplo(): array
    {
        return ['1', '1105', '110505', 'Caja general', 'Efectivo en caja'];
    }

    protected function alias(): array
    {
        return [
            'sub_cuenta' => 'subcuenta',
            'descripcion_puc' => 'descripcion',
        ];
    }

    protected function procesarFila(Importacion $importacion, array $fila): void
    {
        $datos = [];
        foreach ($this->columnas() as $columna) {
            $datos[$columna] = $this->texto($fila, $columna);
        }

        $validador = Validator::make($datos, [
            'tipo' => ['required', Rule::in(['1', '2', '3', '4', '5', '6', '7', '8', '9'])],
            'cuenta' => ['required', 'string', 'max:255'],
            'subcuenta' => ['required', 'string', 'max:255'],
            'concepto' => ['required', 'string', 'max:255'],
            'descripcion' => ['nullable', 'string', 'max:255'],
        ], [
            'tipo.in' => 'El tipo debe ser un número del 1 al 9.',
        ]);

        if ($validador->fails()) {
            throw new FilaInvalida($validador->errors()->first());
        }

        $atributos = $datos + ['concatenar_subcuenta_concepto' => "{$datos['subcuenta']} - {$datos['concepto']}"];
        $puc = Puc::where('subcuenta', $datos['subcuenta'])->first();

        if ($puc === null) {
            Puc::create($atributos);
            $importacion->creados++;

            return;
        }

        $puc->update($atributos);
        $importacion->actualizados++;
    }
}
