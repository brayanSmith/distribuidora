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
        Schema::create('importaciones', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('tipo')->default('productos');
            $table->string('archivo');
            $table->string('nombre_original');
            $table->string('estado')->default('pendiente');
            $table->unsignedInteger('total_filas')->default(0);
            $table->unsignedInteger('procesadas')->default(0);
            $table->unsignedInteger('creados')->default(0);
            $table->unsignedInteger('actualizados')->default(0);
            $table->unsignedInteger('con_error')->default(0);
            // First failed rows: [{fila: int, mensaje: string}].
            $table->json('errores')->nullable();
            $table->timestamp('iniciada_at')->nullable();
            $table->timestamp('terminada_at')->nullable();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('importaciones');
    }
};
