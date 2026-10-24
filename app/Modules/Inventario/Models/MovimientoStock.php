<?php

namespace App\Modules\Inventario\Models;

use App\Models\User;
use App\Modules\Catalogo\Models\Producto;
use Database\Factories\MovimientoStockFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * One line of the kardex: units of a producto that went in (positive) or out
 * (negative) of a bodega, why, and what was left.
 */
#[UseFactory(MovimientoStockFactory::class)]
class MovimientoStock extends Model
{
    /** @use HasFactory<MovimientoStockFactory> */
    use HasFactory;

    /** The stock each producto had when the kardex started. */
    public const SALDO_INICIAL = 'SALDO_INICIAL';

    public const STOCK_INICIAL = 'STOCK_INICIAL';

    public const COMPRA = 'COMPRA';

    public const VENTA = 'VENTA';

    public const TRASLADO_ENTRADA = 'TRASLADO_ENTRADA';

    public const TRASLADO_SALIDA = 'TRASLADO_SALIDA';

    /** A manual correction (ajuste de inventario) that added or took units. */
    public const AJUSTE_ENTRADA = 'AJUSTE_ENTRADA';

    public const AJUSTE_SALIDA = 'AJUSTE_SALIDA';

    /**
     * The stock_bodegas counter each concepto adds to. Salidas count what
     * left (so a movement out adds to them, and its reverse takes it back).
     * The kardex's starting balance only sets the stock.
     *
     * @var array<string, string|null>
     */
    public const COLUMNAS = [
        self::SALDO_INICIAL => null,
        self::STOCK_INICIAL => 'stock_inicial',
        self::COMPRA => 'entradas',
        self::TRASLADO_ENTRADA => 'entradas',
        self::VENTA => 'salidas',
        self::TRASLADO_SALIDA => 'salidas',
        self::AJUSTE_ENTRADA => 'entradas',
        self::AJUSTE_SALIDA => 'salidas',
    ];

    protected $table = 'movimientos_stock';

    protected $fillable = [
        'producto_id',
        'bodega_id',
        'concepto',
        'reverso',
        'cantidad',
        'saldo',
        'costo_unitario',
        'documento_tipo',
        'documento_id',
        'user_id',
        'nota',
    ];

    protected $casts = [
        'reverso' => 'boolean',
        'cantidad' => 'decimal:2',
        'saldo' => 'decimal:2',
        'costo_unitario' => 'decimal:2',
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
