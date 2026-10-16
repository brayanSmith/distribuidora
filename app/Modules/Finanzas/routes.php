<?php

use App\Modules\Finanzas\Http\Controllers\GastoController;
use App\Modules\Finanzas\Http\Controllers\PucController;
use Illuminate\Support\Facades\Route;

Route::get('pucs', [PucController::class, 'index'])->name('pucs.index');
Route::post('pucs', [PucController::class, 'store'])->name('pucs.store');
Route::patch('pucs/{puc}', [PucController::class, 'update'])->name('pucs.update');
Route::delete('pucs/{puc}', [PucController::class, 'destroy'])->name('pucs.destroy');

Route::get('gastos', [GastoController::class, 'index'])->name('gastos.index');
Route::post('gastos', [GastoController::class, 'store'])->name('gastos.store');
Route::patch('gastos/{gasto}', [GastoController::class, 'update'])->name('gastos.update');
Route::delete('gastos/{gasto}', [GastoController::class, 'destroy'])->name('gastos.destroy');
Route::patch('gastos/{gasto}/restaurar', [GastoController::class, 'restore'])->withTrashed()->name('gastos.restore');
