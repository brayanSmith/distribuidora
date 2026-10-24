<?php

namespace App\Modules\Administracion\Models;

use App\Models\Concerns\LogsCambios;
use Database\Factories\EmpresaFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Storage;

#[UseFactory(EmpresaFactory::class)]
class Empresa extends Model
{
    /** @use HasFactory<EmpresaFactory> */
    use HasFactory;

    use LogsCambios;

    protected $appends = [
        'logo_empresa_url',
        'icono_empresa_url',
    ];

    protected $fillable = [
        'nombre_empresa',
        'direccion_empresa',
        'telefono_empresa',
        'email_empresa',
        'nit_empresa',
        'logo_empresa',
        'formato_logo',
        'icono_empresa',
        'diseno_voucher',
    ];

    protected $casts = [
        'diseno_voucher' => 'array',
    ];

    /**
     * The square icon (browser tab, sidebar, notifications).
     *
     * @return Attribute<string|null, never>
     */
    protected function iconoEmpresaUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->icono_empresa ? Storage::disk('public')->url($this->icono_empresa) : null,
        );
    }

    /**
     * @return Attribute<string|null, never>
     */
    protected function logoEmpresaUrl(): Attribute
    {
        return Attribute::make(
            get: fn () => $this->logo_empresa ? Storage::disk('public')->url($this->logo_empresa) : null,
        );
    }

    /**
     * @return list<string>
     */
    protected function logCampos(): array
    {
        return ['nombre_empresa', 'direccion_empresa', 'telefono_empresa', 'email_empresa', 'nit_empresa'];
    }

    /**
     * @return array{0: string, 1: bool}
     */
    protected function logEtiqueta(): array
    {
        return ['Empresa', true];
    }
}
