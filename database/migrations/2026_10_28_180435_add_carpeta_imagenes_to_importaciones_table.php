<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Where the images attached to an import wait (local disk) until its rows
     * name them; null when none were attached.
     */
    public function up(): void
    {
        Schema::table('importaciones', function (Blueprint $table) {
            $table->string('carpeta_imagenes')->nullable()->after('mapeo');
        });
    }

    public function down(): void
    {
        Schema::table('importaciones', function (Blueprint $table) {
            $table->dropColumn('carpeta_imagenes');
        });
    }
};
