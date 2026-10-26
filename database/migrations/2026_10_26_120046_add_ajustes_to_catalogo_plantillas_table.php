<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * What the page header and footer of a design say (see
     * DisenoCatalogo::normalizarAjustes); empty, the company's own data.
     */
    public function up(): void
    {
        Schema::table('catalogo_plantillas', function (Blueprint $table) {
            $table->json('ajustes')->nullable()->after('pie');
        });
    }

    public function down(): void
    {
        Schema::table('catalogo_plantillas', function (Blueprint $table) {
            $table->dropColumn('ajustes');
        });
    }
};
