<?php

namespace App\Modules\Ventas\Models;

use App\Models\User;
use Database\Factories\EntregaFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Collection;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * The delivery of a pedido: where it goes, who receives it and how it goes
 * (por despachar, en camino, entregado, devuelto or anulado).
 */
#[UseFactory(EntregaFactory::class)]
class Entrega extends Model
{
    /** @use HasFactory<EntregaFactory> */
    use HasFactory;

    public const POR_DESPACHAR = 'POR_DESPACHAR';

    public const EN_CAMINO = 'EN_CAMINO';

    public const ENTREGADO = 'ENTREGADO';

    public const DEVUELTO = 'DEVUELTO';

    /** Returned and given up on: the pedido was cancelled. */
    public const ANULADO = 'ANULADO';

    /** The deliveries still to finish. */
    public const ACTIVAS = [self::POR_DESPACHAR, self::EN_CAMINO];

    /** Still waiting for something: the active ones and the returned ones (reschedule or cancel). */
    public const PENDIENTES = [self::POR_DESPACHAR, self::EN_CAMINO, self::DEVUELTO];

    /**
     * The estados each one can be reached from, so the steps go in order:
     * despachar, cobrar (while on its way) and then entregar. Returned can be
     * rescheduled (back to por despachar); anulado is the end.
     *
     * @var array<string, list<string>>
     */
    public const DESDE = [
        self::EN_CAMINO => [self::POR_DESPACHAR],
        self::ENTREGADO => [self::EN_CAMINO],
        self::DEVUELTO => [self::POR_DESPACHAR, self::EN_CAMINO],
        self::POR_DESPACHAR => [self::POR_DESPACHAR, self::EN_CAMINO, self::DEVUELTO],
    ];

    public const ESTADOS = [self::POR_DESPACHAR, self::EN_CAMINO, self::DEVUELTO, self::ENTREGADO, self::ANULADO];

    protected $fillable = [
        'pedido_id',
        'direccion',
        'ciudad',
        'telefono',
        'recibe',
        'nota',
        'fecha_programada',
        'estado',
        'motivo',
        'reagendamientos',
        'mensajero_id',
        'despachada_at',
        'entregada_at',
    ];

    protected $casts = [
        'fecha_programada' => 'date:Y-m-d',
        'despachada_at' => 'datetime',
        'entregada_at' => 'datetime',
    ];

    /**
     * The deliveries of the pedidos of the bodegas the user can see (an
     * anulado one too, though its pedido is soft deleted).
     *
     * @param  Builder<Entrega>  $query
     * @return Builder<Entrega>
     */
    public function scopeVisiblesPara(Builder $query, User $usuario): Builder
    {
        return $query->whereHas('pedido', fn ($query) => $query->withTrashed()->when(
            $usuario->idsBodegasPermitidas(),
            fn ($query, array $bodegaIds) => $query->whereIn('bodega_id', $bodegaIds),
        ));
    }

    /**
     * The users who can take a delivery: the ones who see the deliveries (so
     * they get its notifications and can move it along).
     *
     * @return Collection<int, User>
     */
    public static function mensajerosDisponibles(): Collection
    {
        return User::permission('entregas.view')->orderBy('name')->get(['id', 'name']);
    }

    /**
     * Who takes it.
     *
     * @return BelongsTo<User, $this>
     */
    public function mensajero(): BelongsTo
    {
        return $this->belongsTo(User::class, 'mensajero_id');
    }

    /**
     * @return BelongsTo<Pedido, $this>
     */
    public function pedido(): BelongsTo
    {
        return $this->belongsTo(Pedido::class);
    }
}
