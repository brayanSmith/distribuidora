<?php

namespace App\Modules\Compras\Models;

use App\Models\Concerns\LogsDetalles;
use App\Modules\Catalogo\Models\Producto;
use Database\Factories\CompraFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Carbon;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

#[UseFactory(CompraFactory::class)]
class Compra extends Model
{
    /** @use HasFactory<CompraFactory> */
    use HasFactory;

    use LogsActivity;
    use LogsDetalles;
    use SoftDeletes;

    protected $casts = [
        'fecha' => 'datetime',
        'subtotal' => 'decimal:2',
        'descuento' => 'decimal:2',
        'total_a_pagar' => 'decimal:2',
        'abono' => 'decimal:2',
        'saldo_pendiente' => 'decimal:2',
        'fecha_vencimiento' => 'date:Y-m-d',
    ];

    protected $appends = ['vencida'];

    protected $fillable = [
        'factura',
        'proveedor_id',
        'fecha',
        'estado',
        'observaciones',
        'subtotal',
        'descuento',
        'total_a_pagar',
        'tipo_pago',
        'abono',
        'saldo_pendiente',
        'estado_pago',
        'fecha_vencimiento',
    ];

    /**
     * What gets written to the history. The totals and the estado are left
     * out: they come from the lines, which are logged on their own.
     */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName('compras')
            ->logOnly(['factura', 'proveedor_id', 'fecha', 'descuento', 'observaciones'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event): string => match ($event) {
                'created' => 'Compra creada',
                'updated' => 'Compra editada',
                'deleted' => 'Compra eliminada',
                'restored' => 'Compra restaurada',
                default => "Compra {$event}",
            });
    }

    /**
     * The lines of the compra as plain data, to compare before and after an
     * edit and to write them to the history.
     *
     * @return list<array{producto: string, bodega: string, cantidad: float, precio_unitario: float, estado: string}>
     */
    public function resumenDetalles(): array
    {
        return $this->detallesCompra()
            ->with(['producto:id,referencia_producto,descripcion_producto,marca', 'bodega:id,nombre_bodega'])
            ->orderBy('id')
            ->get()
            ->map(fn (DetalleCompra $detalle): array => [
                'producto' => $detalle->producto?->concatenar_codigo_nombre ?? $detalle->producto?->referencia_producto ?? 'Producto '.$detalle->producto_id,
                'bodega' => $detalle->bodega?->nombre_bodega ?? '—',
                'cantidad' => (float) $detalle->cantidad,
                'precio_unitario' => (float) $detalle->precio_unitario,
                'estado' => $detalle->estado_entrega === 'PENDIENTE' && (float) $detalle->cantidad_recibida > 0
                    ? 'RECIBIDA '.(float) $detalle->cantidad_recibida.' DE '.(float) $detalle->cantidad
                    : $detalle->estado_entrega,
            ])
            ->all();
    }

    private function etiquetaDetalles(): string
    {
        return 'Productos de la compra';
    }

    /**
     * @return BelongsTo<Proveedor, $this>
     */
    public function proveedor(): BelongsTo
    {
        return $this->belongsTo(Proveedor::class, 'proveedor_id');
    }

    /**
     * @return HasMany<DetalleCompra, $this>
     */
    public function detallesCompra(): HasMany
    {
        return $this->hasMany(DetalleCompra::class);
    }

    /**
     * @return Attribute<string, never>
     */
    protected function titulo(): Attribute
    {
        return Attribute::make(
            get: fn () => "{$this->id} - {$this->factura}",
        );
    }

    /**
     * Whether it still owes something and its due date already passed.
     * Worked out on the fly, so it never goes stale with the days.
     *
     * @return Attribute<bool, never>
     */
    protected function vencida(): Attribute
    {
        return Attribute::make(
            get: fn (): bool => (float) ($this->attributes['saldo_pendiente'] ?? 0) > 0
                && $this->fecha_vencimiento !== null
                && $this->fecha_vencimiento->lt(today()),
        );
    }

    /**
     * When a compra is due unless told otherwise: its date plus the days of
     * credit the proveedor gives (none: the same day).
     */
    public static function vencimientoPorDefecto(?Proveedor $proveedor, mixed $fecha): string
    {
        return Carbon::parse($fecha ?? now())
            ->addDays((int) ($proveedor?->dias_credito ?? 0))
            ->toDateString();
    }

    /**
     * The compras that still owe something and whose due date passed.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeVencidas(Builder $query): Builder
    {
        return $query->where('saldo_pendiente', '>', 0)->whereDate('fecha_vencimiento', '<', today());
    }

    /**
     * The payments made to the proveedor.
     *
     * @return HasMany<AbonoCompra, $this>
     */
    public function abonos(): HasMany
    {
        return $this->hasMany(AbonoCompra::class);
    }

    /**
     * Recompute what was paid, what is still owed and whether the compra is
     * paid, from its abonos and its current total.
     */
    public function recalcularPagos(): void
    {
        $abono = (float) $this->abonos()->sum('monto');
        $total = (float) $this->total_a_pagar;
        $saldo = max($total - $abono, 0);

        $this->update([
            'abono' => $abono,
            'saldo_pendiente' => $saldo,
            'estado_pago' => $saldo <= 0 ? 'PAGADA' : 'POR_PAGAR',
        ]);
    }
}
