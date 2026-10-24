<?php

namespace App\Modules\Inventario\Models;

use App\Models\User;
use App\Modules\Catalogo\Models\Producto;
use Database\Factories\AjusteInventarioFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A manual correction of a producto's stock in a bodega, with its reason:
 * units added, units taken, or a physical count that sets the stock.
 */
#[UseFactory(AjusteInventarioFactory::class)]
class AjusteInventario extends Model
{
    /** @use HasFactory<AjusteInventarioFactory> */
    use HasFactory;

    public const ENTRADA = 'ENTRADA';

    public const SALIDA = 'SALIDA';

    public const CONTEO = 'CONTEO';

    /** The usual reasons, offered as quick choices (any other may be written). */
    public const MOTIVOS = [
        'Conteo físico',
        'Mercancía dañada',
        'Pérdida o robo',
        'Producto vencido',
        'Muestra u obsequio',
        'Sobrante encontrado',
        'Corrección de un error',
    ];

    protected $table = 'ajustes_inventario';

    protected $fillable = [
        'producto_id',
        'bodega_id',
        'tipo',
        'cantidad',
        'stock_anterior',
        'diferencia',
        'motivo',
        'nota',
        'user_id',
    ];

    protected $casts = [
        'cantidad' => 'decimal:2',
        'stock_anterior' => 'decimal:2',
        'diferencia' => 'decimal:2',
    ];

    /**
     * @return BelongsTo<Producto, $this>
     */
    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class)->withTrashed();
    }

    /**
     * @return BelongsTo<Bodega, $this>
     */
    public function bodega(): BelongsTo
    {
        return $this->belongsTo(Bodega::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
