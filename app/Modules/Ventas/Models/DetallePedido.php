<?php

namespace App\Modules\Ventas\Models;

use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\Bodega;
use Database\Factories\DetallePedidoFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

#[UseFactory(DetallePedidoFactory::class)]
class DetallePedido extends Model
{
    //
    use HasFactory;
    use SoftDeletes;

    protected $table = 'detalle_pedidos';

    protected $fillable = [
        'pedido_id',
        'producto_id',
        'bodega_id',
        'cantidad',
        'tipo_precio',
        'precio_unitario',
        'costo_unitario',
        'costo_total',
        'ganancia_total',
        'subtotal',
    ];

    public function pedido()
    {
        return $this->belongsTo(Pedido::class, 'pedido_id');
    }

    public function bodega()
    {
        return $this->belongsTo(Bodega::class, 'bodega_id');
    }

    public function producto()
    {
        return $this->belongsTo(Producto::class, 'producto_id');
    }
}
