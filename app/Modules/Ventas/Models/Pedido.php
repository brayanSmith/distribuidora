<?php

namespace App\Modules\Ventas\Models;

use App\Models\Concerns\LogsDetalles;
use App\Models\User;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Finanzas\Models\Puc;
use App\Modules\Inventario\Models\Bodega;
use Carbon\Carbon;
use Database\Factories\PedidoFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Database\Eloquent\Casts\Attribute;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasOne;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

#[UseFactory(PedidoFactory::class)]
class Pedido extends Model
{
    //
    use HasFactory;
    use LogsActivity;
    use LogsDetalles;
    use SoftDeletes;

    protected $fillable = [
        'codigo',
        'cliente_id',
        'fecha',
        'estado',
        'estado_pago',
        // 'tipo_pedido',
        'tipo_pago',
        'tipo_precio',
        'id_puc',
        'bodega_id',
        'observacion',
        'observacion_pago',
        'subtotal',
        'descuento',
        'flete',
        'total_a_pagar',
        'abono',
        'saldo_pendiente',
        'fecha_vencimiento',
        'user_id',
        'aplica_turno',
        'turno',
        'reteica',
        'retefuente',
        'facturacion_electronica',
    ];

    /**
     * Read in America/Bogota. A fecha that carries its own zone (the POS
     * sends it in UTC, e.g. "2026-03-10T15:00:00Z") is stored as the app's
     * local time (10:00 in Bogotá); otherwise it would be saved 5 hours ahead.
     *
     * @return Attribute<Carbon|null, string|null>
     */
    protected function fecha(): Attribute
    {
        return Attribute::make(
            get: fn (?string $value): ?Carbon => $value === null
                ? null
                : Carbon::parse($value)->setTimezone('America/Bogota'),
            set: fn (mixed $value): ?string => $value === null || $value === ''
                ? null
                : Carbon::parse($value)->setTimezone(config('app.timezone'))->format('Y-m-d H:i:s'),
        );
    }

    protected $appends = ['vencido'];

    protected $casts = [
        'fecha' => 'datetime',
        'fecha_vencimiento' => 'date:Y-m-d',
        'fecha_ultimo_abono' => 'datetime',
        'reteica' => 'decimal:2',
        'retefuente' => 'decimal:2',
        'facturacion_electronica' => 'boolean',
    ];

    /**
     * What gets written to the history. Totals, balance and states are left
     * out on purpose: they are derived from the products and the abonos,
     * which are logged on their own.
     */
    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->useLogName('pedidos')
            ->logOnly([
                'cliente_id', 'fecha', 'user_id', 'bodega_id', 'tipo_precio', 'tipo_pago', 'turno',
                'facturacion_electronica', 'observacion', 'observacion_pago',
                'flete', 'descuento', 'reteica', 'retefuente',
            ])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->setDescriptionForEvent(fn (string $event): string => match ($event) {
                'created' => 'Pedido creado',
                'updated' => 'Pedido editado',
                'deleted' => 'Pedido eliminado',
                'restored' => 'Pedido restaurado',
                default => "Pedido {$event}",
            });
    }

    /**
     * The lines of the pedido as plain data, to compare before and after an
     * edit and to write them to the history.
     *
     * @return list<array{producto: string, cantidad: float, precio_unitario: float}>
     */
    public function resumenDetalles(): array
    {
        return $this->detalles()
            ->with('producto:id,referencia_producto,descripcion_producto,marca')
            ->orderBy('id')
            ->get()
            ->map(fn (DetallePedido $detalle): array => [
                'producto' => $detalle->producto?->concatenar_codigo_nombre ?? $detalle->producto?->referencia_producto ?? 'Producto '.$detalle->producto_id,
                'cantidad' => (float) $detalle->cantidad,
                'precio_unitario' => (float) $detalle->precio_unitario,
            ])
            ->all();
    }

    private function etiquetaDetalles(): string
    {
        return 'Productos del pedido';
    }

    public function cliente()
    {
        return $this->belongsTo(Cliente::class, 'cliente_id');
    }

    public function detalles()
    {
        return $this->hasMany(DetallePedido::class);
    }

    public function abonoPedido()
    {
        return $this->hasMany(Abono::class);
    }

    // Alias para compatibilidad - obtener todos los abonos
    /**
     * Where it is delivered, when it is (contra entrega).
     *
     * @return HasOne<Entrega, $this>
     */
    public function entrega(): HasOne
    {
        return $this->hasOne(Entrega::class);
    }

    public function abonos()
    {
        return $this->hasMany(Abono::class);
    }

    public function bodega()
    {
        return $this->belongsTo(Bodega::class, 'bodega_id');
    }

    public function user()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function updatedBy()
    {
        return $this->belongsTo(User::class, 'updated_by');
    }

    public function alistador()
    {
        return $this->belongsTo(User::class, 'user_id');
    }

    public function puc()
    {
        return $this->belongsTo(Puc::class, 'id_puc');
    }

    /**
     * Whether it still owes something and its due date already passed.
     * Worked out on the fly, so it never goes stale with the days.
     *
     * @return Attribute<bool, never>
     */
    protected function vencido(): Attribute
    {
        return Attribute::make(
            get: fn (): bool => (float) ($this->attributes['saldo_pendiente'] ?? 0) > 0
                && $this->fecha_vencimiento !== null
                && $this->fecha_vencimiento->lt(today()),
        );
    }

    /**
     * The pedidos that still owe something and whose due date passed.
     *
     * @param  Builder<self>  $query
     * @return Builder<self>
     */
    public function scopeVencidos(Builder $query): Builder
    {
        return $query->where('saldo_pendiente', '>', 0)->whereDate('fecha_vencimiento', '<', today());
    }

    /**
     * When a pedido on credit is due unless told otherwise: its date plus
     * the days of credit of the cliente. Other tipos de pago are not due.
     */
    public static function vencimientoPorDefecto(?string $tipoPago, ?Cliente $cliente, mixed $fecha): ?string
    {
        if ($tipoPago !== 'CREDITO') {
            return null;
        }

        return Carbon::parse($fecha ?? now())
            ->addDays((int) ($cliente?->dias_credito ?? 0))
            ->toDateString();
    }

    /**
     * Recompute abono, saldo_pendiente, estado_pago and estado from the
     * pedido's persisted abonos and current total_a_pagar.
     */
    public function recalcularTotales(): void
    {
        $abono = (float) $this->abonos()->sum('monto');
        $totalAPagar = (float) $this->total_a_pagar;
        $saldoPendiente = max($totalAPagar - $abono, 0);

        $this->update([
            'abono' => $abono,
            'saldo_pendiente' => $saldoPendiente,
            'estado_pago' => $saldoPendiente <= 0 && $totalAPagar > 0 ? 'SALDADO' : 'EN_CARTERA',
            'estado' => $saldoPendiente <= 0 ? 'COMPLETADO' : 'PENDIENTE',
        ]);
    }
}
