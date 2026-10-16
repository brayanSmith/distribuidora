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
        Schema::create('marcas', function (Blueprint $table) {
            $table->id();
            $table->string('marca')->unique();
            $table->string('descripcion_marca')->nullable();
            $table->timestamps();
        });

        Schema::create('productos', function (Blueprint $table) {
            $table->id();
            $table->foreignId('categoria_id')->nullable()->constrained('categorias')->onDelete('cascade');
            $table->foreignId('sub_categoria_id')->nullable()->constrained('sub_categorias')->onDelete('cascade');
            $table->boolean('inventariable')->default(true)->nullable();
            $table->string('sku')->unique()->nullable();
            $table->foreignId('marca_id')->nullable()->constrained('marcas')->onDelete('cascade');
            $table->string('referencia_producto')->nullable();
            $table->string('descripcion_producto')->nullable();
            $table->decimal('costo_producto', 10, 2)->default(0)->nullable(); // Ira cambiando de acuerdo a las entradas
            $table->decimal('valor_detal', 10, 2)->default(0)->nullable();
            $table->decimal('valor_mayorista', 10, 2)->default(0)->nullable();
            $table->string('concatenar_codigo_nombre')->nullable();
            $table->string('codigo_appsheet')->nullable();
            $table->timestamps();
            $table->softDeletes();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('productos');
        Schema::dropIfExists('marcas');
    }
};
