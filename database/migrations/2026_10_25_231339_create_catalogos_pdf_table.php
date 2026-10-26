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
        // The product catalogs generated as PDF: what was asked for, how it
        // went and the file to download.
        Schema::create('catalogos_pdf', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            // Categorías, stock, price shown, columns and cover chosen.
            $table->json('opciones');
            $table->enum('estado', ['pendiente', 'procesando', 'completado', 'fallido'])->default('pendiente');
            $table->unsignedInteger('total_productos')->default(0);
            $table->string('archivo')->nullable();
            $table->string('error')->nullable();
            $table->timestamp('terminado_at')->nullable();
            $table->timestamps();

            $table->index(['user_id', 'id']);
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('catalogos_pdf');
    }
};
