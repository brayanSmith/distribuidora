<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('compras', function (Blueprint $table) {
            $table->id();
            $table->string('factura');
            $table->foreignId('proveedor_id')->constrained('proveedors');
            $table->dateTime('fecha')->nullable();
            $table->enum('estado', ['PENDIENTE', 'RECIBIDA'])->default(value: 'PENDIENTE');
            $table->text('observaciones')->nullable();
            $table->decimal('subtotal', 12, 2)->default(0);
            $table->decimal('descuento', 12, 2)->default(0)->nullable();
            $table->decimal('total_a_pagar', 12, 2)->default(0);
            // What was already paid to the proveedor (sum of its abonos) and what is still owed.
            // CONTADO: paid in full when registered; CREDITO: paid later, by its due date.
            $table->enum('tipo_pago', ['CONTADO', 'CREDITO'])->default('CREDITO');
            $table->decimal('abono', 12, 2)->default(0);
            $table->decimal('saldo_pendiente', 12, 2)->default(0);
            $table->enum('estado_pago', ['POR_PAGAR', 'PAGADA'])->default('POR_PAGAR');
            // When what is owed must be paid; past it with a balance the compra is overdue.
            $table->date('fecha_vencimiento')->nullable();
            $table->timestamps();
            $table->softDeletes();

            $table->index('estado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('compras');
        // Eliminar registros relacionados en detalle_compras
    }
};
