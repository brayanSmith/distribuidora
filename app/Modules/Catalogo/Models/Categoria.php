<?php

namespace App\Modules\Catalogo\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class Categoria extends Model
{
    //
    use HasFactory;

    protected $fillable = ['nombre_categoria', 'aplica_inventario'];

    public function productos()
    {
        return $this->hasMany(Producto::class, 'categoria_id');
    }

}
