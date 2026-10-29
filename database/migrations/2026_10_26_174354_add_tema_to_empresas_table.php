<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The colors of the app for everyone (menu and platform color); empty
     * keeps the app's own. The same for every user.
     */
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->string('color_menu', 7)->nullable()->after('color_acento');
            $table->string('color_plataforma', 7)->nullable()->after('color_menu');
            $table->string('color_plataforma_oscuro', 7)->nullable()->after('color_plataforma');
        });
    }

    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn(['color_menu', 'color_plataforma', 'color_plataforma_oscuro']);
        });
    }
};
