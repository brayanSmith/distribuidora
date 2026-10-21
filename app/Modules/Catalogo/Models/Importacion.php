<?php

namespace App\Modules\Catalogo\Models;

use App\Models\User;
use Database\Factories\ImportacionFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

#[UseFactory(ImportacionFactory::class)]
class Importacion extends Model
{
    /** @use HasFactory<ImportacionFactory> */
    use HasFactory;

    public const PENDIENTE = 'pendiente';

    public const PROCESANDO = 'procesando';

    public const COMPLETADA = 'completada';

    public const FALLIDA = 'fallida';

    protected $table = 'importaciones';

    protected $fillable = [
        'user_id',
        'tipo',
        'archivo',
        'nombre_original',
        'mapeo',
        'estado',
        'total_filas',
        'procesadas',
        'creados',
        'actualizados',
        'con_error',
        'errores',
        'iniciada_at',
        'terminada_at',
        'leida_at',
    ];

    protected $casts = [
        'errores' => 'array',
        'mapeo' => 'array',
        'iniciada_at' => 'datetime',
        'terminada_at' => 'datetime',
        'leida_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    /**
     * The imports of a user: their notifications.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeDe(Builder $query, User $user): Builder
    {
        return $query->where('user_id', $user->id);
    }

    /**
     * Finished imports nobody marked as read yet.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeSinLeer(Builder $query): Builder
    {
        return $query->whereIn('estado', [self::COMPLETADA, self::FALLIDA])->whereNull('leida_at');
    }

    /**
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeEnCurso(Builder $query): Builder
    {
        return $query->whereIn('estado', [self::PENDIENTE, self::PROCESANDO]);
    }

    public function estaEnCurso(): bool
    {
        return in_array($this->estado, [self::PENDIENTE, self::PROCESANDO], true);
    }
}
