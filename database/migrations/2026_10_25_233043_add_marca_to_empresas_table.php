<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The company's brand: its colors and what it says of itself (slogan,
     * social networks), used by the catalog and the printed documents.
     */
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->string('color_primario', 7)->nullable()->after('icono_empresa');
            $table->string('color_acento', 7)->nullable()->after('color_primario');
            $table->string('eslogan_empresa')->nullable()->after('color_acento');
            $table->text('descripcion_empresa')->nullable()->after('eslogan_empresa');
            $table->string('whatsapp_empresa')->nullable()->after('descripcion_empresa');
            $table->string('instagram_empresa')->nullable()->after('whatsapp_empresa');
            $table->string('colaboracion_empresa')->nullable()->after('instagram_empresa');
        });
    }

    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn([
                'color_primario',
                'color_acento',
                'eslogan_empresa',
                'descripcion_empresa',
                'whatsapp_empresa',
                'instagram_empresa',
                'colaboracion_empresa',
            ]);
        });
    }
};
