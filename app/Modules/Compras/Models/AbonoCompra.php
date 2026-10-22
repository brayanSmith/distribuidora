<?php

namespace App\Modules\Compras\Models;

use App\Models\User;
use App\Modules\Finanzas\Models\Puc;
use Database\Factories\AbonoCompraFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A payment made to the proveedor of a compra.
 */
#[UseFactory(AbonoCompraFactory::class)]
class AbonoCompra extends Model
{
    /** @use HasFactory<AbonoCompraFactory> */
    use HasFactory;

    protected $table = 'abono_compras';

    protected $fillable = [
        'compra_id',
        'fecha',
        'monto',
        'puc_id',
        'descripcion',
        'imagen',
        'user_id',
    ];

    protected $casts = [
        'fecha' => 'datetime',
        'monto' => 'decimal:2',
    ];

    /**
     * @return BelongsTo<Compra, $this>
     */
    public function compra(): BelongsTo
    {
        return $this->belongsTo(Compra::class);
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The medio de pago the money came out of.
     *
     * @return BelongsTo<Puc, $this>
     */
    public function puc(): BelongsTo
    {
        return $this->belongsTo(Puc::class);
    }
}
