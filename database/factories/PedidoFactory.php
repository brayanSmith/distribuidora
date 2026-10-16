<?php

namespace Database\Factories;

use App\Models\User;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Ventas\Models\Cliente;
use App\Modules\Ventas\Models\Pedido;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Pedido>
 */
class PedidoFactory extends Factory
{
    protected $model = Pedido::class;

    /**
     * Define the model's default state.
     *
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        return [
            'cliente_id' => Cliente::factory(),
            'fecha' => fake()->dateTimeThisYear(),
            'estado' => 'PENDIENTE',
            'estado_pago' => 'EN_CARTERA',
            'tipo_pago' => 'CONTADO',
            'tipo_precio' => 'DETAL',
            'bodega_id' => Bodega::factory(),
            'user_id' => User::factory(),
            'subtotal' => 0,
            'descuento' => 0,
            'flete' => 0,
            'reteica' => 0,
            'retefuente' => 0,
            'total_a_pagar' => 0,
            'abono' => 0,
            'saldo_pendiente' => 0,
            'facturacion_electronica' => false,
        ];
    }
}
