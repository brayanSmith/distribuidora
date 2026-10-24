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
        // Manual corrections of the stock (a physical count, damaged or lost
        // goods...), always with a reason. Never edited nor deleted: a mistake
        // is fixed with another ajuste, so the kardex keeps the whole story.
        Schema::create('ajustes_inventario', function (Blueprint $table) {
            $table->id();
            $table->foreignId('producto_id')->constrained('productos')->cascadeOnDelete();
            $table->foreignId('bodega_id')->constrained('bodegas')->cascadeOnDelete();
            // ENTRADA / SALIDA: units added or taken; CONTEO: what was counted.
            $table->enum('tipo', ['ENTRADA', 'SALIDA', 'CONTEO']);
            $table->decimal('cantidad', 14, 2);
            $table->decimal('stock_anterior', 14, 2);
            // What it changed the stock by (positive in, negative out).
            $table->decimal('diferencia', 14, 2);
            $table->string('motivo', 100);
            $table->string('nota')->nullable();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();

            $table->index(['bodega_id', 'created_at']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('ajustes_inventario');
    }
};
