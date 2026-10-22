<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::create('abono_compras', function (Blueprint $table) {
            $table->id();
            $table->foreignId('compra_id')->constrained('compras')->onDelete('cascade');
            // A payment made to the proveedor of the compra, with its medio de pago.
            $table->dateTime('fecha')->default(DB::raw('CURRENT_TIMESTAMP'));
            $table->decimal('monto', 12, 2)->default(0);
            $table->foreignId('puc_id')->constrained('pucs')->onDelete('cascade');
            $table->string('descripcion')->nullable();
            $table->string('imagen')->nullable();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('abono_compras');
    }
};
