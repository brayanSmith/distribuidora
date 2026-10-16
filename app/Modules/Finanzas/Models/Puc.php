<?php

namespace App\Modules\Finanzas\Models;

use App\Models\Concerns\LogsCambios;
use App\Modules\Ventas\Models\Abono;
use App\Modules\Ventas\Models\Pedido;
use Database\Factories\PucFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[UseFactory(PucFactory::class)]
class Puc extends Model
{
    /** @use HasFactory<PucFactory> */
    use HasFactory;

    use LogsCambios;

    protected $fillable = [
        'tipo',
        'cuenta',
        'subcuenta',
        'concepto',
        'descripcion',
        'concatenar_subcuenta_concepto',
    ];

    public function pedidos()
    {
        return $this->hasMany(Pedido::class, 'id_puc');
    }

    public function abonos()
    {
        return $this->hasMany(Abono::class, 'puc_id');
    }

    /**
     * @return list<string>
     */
    protected function logCampos(): array
    {
        return ['tipo', 'cuenta', 'subcuenta', 'concepto', 'descripcion'];
    }

    /**
     * @return array{0: string, 1: bool}
     */
    protected function logEtiqueta(): array
    {
        return ['Medio de pago', false];
    }
}
