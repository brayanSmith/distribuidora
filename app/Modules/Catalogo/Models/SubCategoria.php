<?php

namespace App\Modules\Catalogo\Models;

use Database\Factories\SubCategoriaFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[UseFactory(SubCategoriaFactory::class)]
class SubCategoria extends Model
{
    /** @use HasFactory<SubCategoriaFactory> */
    use HasFactory;

    protected $fillable = ['nombre_sub_categoria', 'categoria_id'];

    public function categoria()
    {
        return $this->belongsTo(Categoria::class, 'categoria_id');
    }

    public function productos()
    {
        return $this->hasMany(Producto::class, 'sub_categoria_id');
    }
}
