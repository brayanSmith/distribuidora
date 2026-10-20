<?php

namespace App\Modules\Catalogo\Models;

use Database\Factories\ImagenProductoFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Support\Facades\Storage;

#[UseFactory(ImagenProductoFactory::class)]
class ImagenProducto extends Model
{
    /** @use HasFactory<ImagenProductoFactory> */
    use HasFactory;

    protected $fillable = ['producto_id', 'imagen_producto', 'orden'];

    protected $appends = ['url'];

    /**
     * @return BelongsTo<Producto, $this>
     */
    public function producto(): BelongsTo
    {
        return $this->belongsTo(Producto::class);
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function url(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->imagen_producto ? Storage::disk('public')->url($this->imagen_producto) : null,
        );
    }
}
