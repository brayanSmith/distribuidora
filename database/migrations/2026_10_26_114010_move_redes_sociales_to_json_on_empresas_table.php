<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * The company's networks become a list it chooses (each with its icon)
     * instead of a fixed WhatsApp and Instagram; those already typed are
     * kept as the first ones.
     */
    public function up(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->json('redes_sociales')->nullable()->after('descripcion_empresa');
        });

        DB::table('empresas')->get(['id', 'whatsapp_empresa', 'instagram_empresa'])->each(function (object $empresa): void {
            $redes = array_values(array_filter([
                $empresa->whatsapp_empresa ? ['red' => 'whatsapp', 'valor' => $empresa->whatsapp_empresa] : null,
                $empresa->instagram_empresa ? ['red' => 'instagram', 'valor' => '@'.ltrim($empresa->instagram_empresa, '@')] : null,
            ]));

            DB::table('empresas')->where('id', $empresa->id)->update([
                'redes_sociales' => $redes === [] ? null : json_encode($redes),
            ]);
        });

        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn(['whatsapp_empresa', 'instagram_empresa']);
        });
    }

    public function down(): void
    {
        Schema::table('empresas', function (Blueprint $table) {
            $table->string('whatsapp_empresa')->nullable()->after('descripcion_empresa');
            $table->string('instagram_empresa')->nullable()->after('whatsapp_empresa');
        });

        DB::table('empresas')->whereNotNull('redes_sociales')->get(['id', 'redes_sociales'])->each(function (object $empresa): void {
            $redes = collect(json_decode($empresa->redes_sociales, true));

            DB::table('empresas')->where('id', $empresa->id)->update([
                'whatsapp_empresa' => $redes->firstWhere('red', 'whatsapp')['valor'] ?? null,
                'instagram_empresa' => isset($redes->firstWhere('red', 'instagram')['valor']) ? ltrim($redes->firstWhere('red', 'instagram')['valor'], '@') : null,
            ]);
        });

        Schema::table('empresas', function (Blueprint $table) {
            $table->dropColumn('redes_sociales');
        });
    }
};
