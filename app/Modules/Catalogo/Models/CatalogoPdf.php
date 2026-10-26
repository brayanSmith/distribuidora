<?php

namespace App\Modules\Catalogo\Models;

use App\Models\User;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A product catalog generated as PDF in the background: the options it was
 * asked with, how it went and where its file is.
 */
class CatalogoPdf extends Model
{
    public const PENDIENTE = 'pendiente';

    public const PROCESANDO = 'procesando';

    public const COMPLETADO = 'completado';

    public const FALLIDO = 'fallido';

    protected $table = 'catalogos_pdf';

    protected $fillable = [
        'user_id',
        'opciones',
        'estado',
        'total_productos',
        'archivo',
        'error',
        'terminado_at',
    ];

    protected $casts = [
        'opciones' => 'array',
        'terminado_at' => 'datetime',
    ];

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
