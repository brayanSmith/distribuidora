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
        // Designs of the product catalog, made of blocks (cover, categorías,
        // texts, page breaks) in the order they are printed.
        Schema::create('catalogo_plantillas', function (Blueprint $table) {
            $table->id();
            $table->string('nombre');
            $table->json('bloques');
            // Productos per row a categoría starts from (2, 3 or 4).
            $table->unsignedTinyInteger('columnas')->default(4);
            $table->boolean('encabezado')->default(true);
            $table->boolean('pie')->default(true);
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('catalogo_plantillas');
    }
};
