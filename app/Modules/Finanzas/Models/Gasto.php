<?php

namespace App\Modules\Finanzas\Models;

use App\Models\Concerns\LogsCambios;
use App\Models\User;
use App\Modules\Inventario\Models\Bodega;
use Database\Factories\GastoFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\SoftDeletes;

#[UseFactory(GastoFactory::class)]
class Gasto extends Model
{
    /** @use HasFactory<GastoFactory> */
    use HasFactory;

    use LogsCambios;
    use SoftDeletes;

    protected $casts = [
        'monto' => 'decimal:2',
        'fecha_gasto' => 'date',
    ];

    protected $fillable = [
        'bodega_id',
        'user_id',
        'descripcion',
        'monto',
        'fecha_gasto',
    ];

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

    /**
     * @return list<string>
     */
    protected function logCampos(): array
    {
        return ['bodega_id', 'descripcion', 'monto', 'fecha_gasto'];
    }

    /**
     * @return array{0: string, 1: bool}
     */
    protected function logEtiqueta(): array
    {
        return ['Gasto', false];
    }
}
