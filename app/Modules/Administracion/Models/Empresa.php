<?php

namespace App\Modules\Administracion\Models;

use App\Models\Concerns\LogsCambios;
use App\Support\RedesSociales;
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
        'redes',
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
        'color_primario',
        'color_acento',
        'color_menu',
        'color_plataforma',
        'color_plataforma_oscuro',
        'eslogan_empresa',
        'descripcion_empresa',
        'redes_sociales',
        'colaboracion_empresa',
    ];

    /** The brand colors while the company has not chosen its own. */
    public const COLOR_PRIMARIO = '#3b0764';

    public const COLOR_ACENTO = '#a855f7';

    protected $casts = [
        'diseno_voucher' => 'array',
        'redes_sociales' => 'array',
    ];

    /**
     * The brand colors (its own, or the default ones), each with the text
     * color that reads on it.
     *
     * @return array{primario: string, acento: string, sobre_primario: string, sobre_acento: string}
     */
    public function paleta(): array
    {
        $primario = $this->color_primario ?: self::COLOR_PRIMARIO;
        $acento = $this->color_acento ?: self::COLOR_ACENTO;

        return [
            'primario' => $primario,
            'acento' => $acento,
            'sobre_primario' => self::textoSobre($primario),
            'sobre_acento' => self::textoSobre($acento),
        ];
    }

    /**
     * White or near black, whichever reads better on the color.
     */
    public static function textoSobre(string $color): string
    {
        [$rojo, $verde, $azul] = array_map(
            fn (string $canal): float => hexdec($canal) / 255,
            str_split(ltrim($color, '#'), 2),
        );

        $luminancia = 0.2126 * $rojo + 0.7152 * $verde + 0.0722 * $azul;

        return $luminancia > 0.6 ? '#0f172a' : '#ffffff';
    }

    /**
     * The company's networks as they are shown: each with its name and, for
     * a custom one, the URL of its uploaded icon.
     *
     * @return Attribute<list<array{red: string, nombre: string, valor: string, icono: ?string, icono_url: ?string}>, never>
     */
    protected function redes(): Attribute
    {
        return Attribute::make(
            get: fn (): array => array_map(fn (array $red): array => [
                'red' => $red['red'],
                'nombre' => $red['red'] === RedesSociales::PERSONALIZADA
                    ? ($red['nombre'] ?? 'Red')
                    : (RedesSociales::REDES[$red['red']]['nombre'] ?? $red['red']),
                'valor' => $red['valor'],
                'icono' => $red['icono'] ?? null,
                'icono_url' => isset($red['icono']) ? Storage::disk('public')->url($red['icono']) : null,
            ], $this->redes_sociales ?? []),
        );
    }

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
