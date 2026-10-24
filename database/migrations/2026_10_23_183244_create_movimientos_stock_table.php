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
        // The kardex: every unit that went in or out of a bodega, why (the
        // concepto and the document that moved it), who did it and what was
        // left. stock_bodegas keeps the balance; this keeps its history.
        Schema::create('movimientos_stock', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('bodega_id')->constrained('bodegas')->cascadeOnDelete();
            $table->string('concepto', 30);
            // Undoes an earlier movement (a pedido edited or deleted, a compra returned...).
            $table->boolean('reverso')->default(false);
            // Positive goes in, negative goes out.
            $table->decimal('cantidad', 14, 2);
            // What the bodega had of the producto right after.
            $table->decimal('saldo', 14, 2);
            $table->decimal('costo_unitario', 14, 2)->nullable();
            // The document that moved it: pedido, compra, traslado, stock_inicial.
            $table->string('documento_tipo', 30)->nullable();
            $table->unsignedBigInteger('documento_id')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('nota')->nullable();
            $table->timestamps();

            $table->index(['producto_id', 'bodega_id', 'id']);
            $table->index(['documento_tipo', 'documento_id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('movimientos_stock');
    }
};
