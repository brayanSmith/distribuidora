<?php

use App\Modules\Inventario\Http\Controllers\BodegaController;
use App\Modules\Inventario\Http\Controllers\StockBodegaController;
use App\Modules\Inventario\Http\Controllers\StockInicialController;
use App\Modules\Inventario\Http\Controllers\TrasladoController;
use Illuminate\Support\Facades\Route;

Route::get('bodegas', [BodegaController::class, 'index'])->name('bodegas.index');
Route::post('bodegas', [BodegaController::class, 'store'])->name('bodegas.store');
Route::patch('bodegas/{bodega}', [BodegaController::class, 'update'])->name('bodegas.update');
Route::delete('bodegas/{bodega}', [BodegaController::class, 'destroy'])->name('bodegas.destroy');

Route::get('stock-iniciales', [StockInicialController::class, 'index'])->name('stock-iniciales.index');
Route::post('stock-iniciales', [StockInicialController::class, 'store'])->name('stock-iniciales.store');
Route::patch('stock-iniciales/{stock_inicial}', [StockInicialController::class, 'update'])->name('stock-iniciales.update');
Route::delete('stock-iniciales/{stock_inicial}', [StockInicialController::class, 'destroy'])->name('stock-iniciales.destroy');

Route::get('stock-bodegas', [StockBodegaController::class, 'index'])->name('stock-bodegas.index');

Route::get('traslados', [TrasladoController::class, 'index'])->name('traslados.index');
Route::post('traslados', [TrasladoController::class, 'store'])->name('traslados.store');
Route::patch('traslados/{traslado}', [TrasladoController::class, 'update'])->name('traslados.update');
Route::delete('traslados/{traslado}', [TrasladoController::class, 'destroy'])->name('traslados.destroy');
