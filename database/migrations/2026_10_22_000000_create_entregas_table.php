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
        // Where and to whom a pedido is delivered, and how the delivery goes.
        // The address is copied from the cliente but kept here, so it stays as
        // it was sent even if the cliente moves later.
        Schema::create('entregas', function (Blueprint $table) {
            $table->id();
            $table->foreignId('pedido_id')->unique()->constrained('pedidos')->cascadeOnDelete();
            $table->string('direccion');
            $table->string('ciudad')->nullable();
            $table->string('telefono');
            $table->string('recibe')->nullable();
            $table->string('nota')->nullable();
            $table->date('fecha_programada')->nullable();
            $table->enum('estado', ['POR_DESPACHAR', 'EN_CAMINO', 'ENTREGADO', 'DEVUELTO', 'ANULADO'])->default('POR_DESPACHAR');
            // Why it was returned or rescheduled the last time.
            $table->string('motivo')->nullable();
            $table->unsignedTinyInteger('reagendamientos')->default(0);
            // Who takes it: a user, so the delivery's notifications go to them.
            $table->foreignId('mensajero_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('despachada_at')->nullable();
            $table->timestamp('entregada_at')->nullable();
            $table->timestamps();

            $table->index('estado');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('entregas');
    }
};
