<?php

namespace App\Modules\Catalogo\Models;

use App\Models\User;
use Database\Factories\CatalogoPlantillaFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/**
 * A design of the product catalog: its blocks (see DisenoCatalogo) and the
 * general settings, shared by everyone who makes catalogs.
 */
#[UseFactory(CatalogoPlantillaFactory::class)]
class CatalogoPlantilla extends Model
{
    /** @use HasFactory<CatalogoPlantillaFactory> */
    use HasFactory;

    protected $table = 'catalogo_plantillas';

    protected $fillable = [
        'nombre',
        'bloques',
        'columnas',
        'encabezado',
        'pie',
        'ajustes',
        'user_id',
    ];

    protected $casts = [
        'bloques' => 'array',
        'columnas' => 'integer',
        'encabezado' => 'boolean',
        'pie' => 'boolean',
        'ajustes' => 'array',
    ];

    /**
     * What a catalog made with this design takes from it.
     *
     * @return array{plantilla: string, bloques: list<array<string, mixed>>, columnas: int, encabezado: bool, pie: bool, ajustes: ?array<string, mixed>}
     */
    public function opciones(): array
    {
        return [
            'plantilla' => $this->nombre,
            'bloques' => $this->bloques,
            'columnas' => $this->columnas,
            'encabezado' => $this->encabezado,
            'pie' => $this->pie,
            'ajustes' => $this->ajustes,
        ];
    }

    /**
     * @return BelongsTo<User, $this>
     */
    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }
}
