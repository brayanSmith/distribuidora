<?php

namespace App\Modules\Catalogo\Models;

use Illuminate\Database\Eloquent\Attributes\UseFactory;
use App\Models\Concerns\LogsCambios;
use Database\Factories\MarcaFactory;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

#[UseFactory(MarcaFactory::class)]
class Marca extends Model
{
    /** @use HasFactory<MarcaFactory> */
    use HasFactory;

    use LogsCambios;

    protected $fillable = [
        'marca',
        'descripcion_marca',
    ];

    public function productos()
    {
        return $this->hasMany(Producto::class);
    }

    /**
     * @return list<string>
     */
    protected function logCampos(): array
    {
        return ['marca', 'descripcion_marca'];
    }

    /**
     * @return array{0: string, 1: bool}
     */
    protected function logEtiqueta(): array
    {
        return ['Marca', true];
    }
}
