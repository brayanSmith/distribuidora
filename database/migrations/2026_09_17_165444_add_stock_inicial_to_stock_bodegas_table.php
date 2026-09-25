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
        Schema::table('stock_bodegas', function (Blueprint $table) {
            $table->decimal('stock_inicial')->default(0)->after('producto_id');
        });

        if (DB::table('migrations')->where('migration', '2025_11_28_152404_create_permission_tables')->exists()) {
            $this->splitLegacyStock();

            return;
        }

        $stockIniciales = DB::table('stock_inicials')
            ->select('producto_id', 'bodega_id', DB::raw('SUM(cantidad) as total'))
            ->groupBy('producto_id', 'bodega_id')
            ->get();

        foreach ($stockIniciales as $stockInicial) {
            $stockBodega = DB::table('stock_bodegas')
                ->where('producto_id', $stockInicial->producto_id)
                ->where('bodega_id', $stockInicial->bodega_id)
                ->first();

            if ($stockBodega) {
                DB::table('stock_bodegas')
                    ->where('id', $stockBodega->id)
                    ->update([
                        'stock_inicial' => $stockInicial->total,
                        'stock' => $stockInicial->total + $stockBodega->entradas - $stockBodega->salidas,
                        'updated_at' => now(),
                    ]);
            } else {
                DB::table('stock_bodegas')->insert([
                    'producto_id' => $stockInicial->producto_id,
                    'bodega_id' => $stockInicial->bodega_id,
                    'stock_inicial' => $stockInicial->total,
                    'entradas' => 0,
                    'salidas' => 0,
                    'stock' => $stockInicial->total,
                    'created_at' => now(),
                    'updated_at' => now(),
                ]);
            }
        }
    }

    /**
     * The previous (Filament) system folds the stock inicial into `entradas`
     * and takes outgoing traslados off `entradas`, while this app keeps the
     * stock inicial apart and counts outgoing traslados as `salidas`. The
     * columns are split into this app's meaning; `stock` stays the same.
     */
    private function splitLegacyStock(): void
    {
        $inicial = '(select coalesce(sum(cantidad), 0) from stock_inicials where stock_inicials.producto_id = stock_bodegas.producto_id and stock_inicials.bodega_id = stock_bodegas.bodega_id)';
        $trasladosSalida = '(select coalesce(sum(cantidad), 0) from traslados where traslados.producto_id = stock_bodegas.producto_id and traslados.bodega_donante_id = stock_bodegas.bodega_id)';

        DB::table('stock_bodegas')->update([
            'stock_inicial' => DB::raw($inicial),
            'entradas' => DB::raw("entradas - {$inicial} + {$trasladosSalida}"),
            'salidas' => DB::raw("salidas + {$trasladosSalida}"),
        ]);
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('stock_bodegas', function (Blueprint $table) {
            $table->dropColumn('stock_inicial');
        });
    }
};
