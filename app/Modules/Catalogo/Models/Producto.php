<?php

namespace App\Modules\Catalogo\Models;

use App\Modules\Compras\Models\DetalleCompra;
use App\Modules\Inventario\Models\StockBodega;
use App\Modules\Inventario\Models\StockInicial;
use App\Modules\Inventario\Models\Traslado;
use App\Modules\Ventas\Models\DetallePedido;
use Database\Factories\ProductoFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

#[UseFactory(ProductoFactory::class)]
class Producto extends Model
{
    /** @use HasFactory<ProductoFactory> */
    use HasFactory;

    use LogsActivity;
    use SoftDeletes;

    protected $appends = [
        'concatenar_codigo_nombre',
    ];

    protected $casts = [
        'inventariable' => 'boolean',
        'costo_producto' => 'decimal:2',
        'valor_detal' => 'decimal:2',
        'valor_mayorista' => 'decimal:2',
    ];

    protected $fillable = [
        'categoria_id',
        'sub_categoria_id',
        'inventariable',
        'marca',
        'referencia_producto',
        'descripcion_producto',
        'costo_producto',
        'valor_detal',
        'valor_mayorista',
        'codigo_appsheet',
        'sku',
    ];

    /**
     * What gets written to the history. The composed name is left out: it
     * follows from the fields below.
     */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName('productos')
            ->logOnly([
                'categoria_id', 'sub_categoria_id', 'inventariable', 'sku', 'referencia_producto', 'descripcion_producto', 'marca',
                'costo_producto', 'valor_detal', 'valor_mayorista',
            ])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event): string => match ($event) {
                'created' => 'Producto creado',
                'updated' => 'Producto editado',
                'deleted' => 'Producto eliminado',
                'restored' => 'Producto restaurado',
                default => "Producto {$event}",
            });
    }

    /**
     * The display name: reference, brand and description joined by dashes.
     * Queries that select columns must include `referencia_producto`,
     * `descripcion_producto` and `marca`.
     *
     * @return Attribute<string, never>
     */
    protected function concatenarCodigoNombre(): Attribute
    {
        return Attribute::make(
            get: fn (): string => self::nombreDe(
                $this->referencia_producto,
                $this->marca,
                $this->descripcion_producto,
            ),
        );
    }

    public static function nombreDe(?string $referencia, ?string $marca, ?string $descripcion): string
    {
        return implode('-', array_filter([$referencia, $marca, $descripcion]));
    }

    /**
     * @return BelongsTo<Categoria, $this>
     */
    public function categoria(): BelongsTo
    {
        return $this->belongsTo(Categoria::class, 'categoria_id');
    }

    /**
     * @return BelongsTo<SubCategoria, $this>
     */
    public function subCategoria(): BelongsTo
    {
        return $this->belongsTo(SubCategoria::class, 'sub_categoria_id');
    }

    /**
     * @return HasMany<ImagenProducto, $this>
     */
    public function imagenes(): HasMany
    {
        return $this->hasMany(ImagenProducto::class)->orderBy('orden')->orderBy('id');
    }

    public function detalleCompras()
    {
        return $this->hasMany(DetalleCompra::class);
    }

    public function detallePedidos()
    {
        return $this->hasMany(DetallePedido::class);
    }

    public function traslados()
    {
        return $this->hasMany(Traslado::class);
    }

    public function stockBodegas()
    {
        return $this->hasMany(StockBodega::class);
    }

    public function stockIniciales()
    {
        return $this->hasMany(StockInicial::class);
    }

    public function enStock(float|int $cantidad): bool
    {
        // cantidad inválida
        if ($cantidad <= 0) {
            return false;
        }

        $stock = (float) ($this->stock ?? 0);

        return $stock >= (float) $cantidad;
    }
}
