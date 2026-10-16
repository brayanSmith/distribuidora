<?php

use App\Modules\Catalogo\Http\Controllers\CotizadorController;
use App\Modules\Catalogo\Http\Controllers\MarcaController;
use App\Modules\Catalogo\Http\Controllers\ProductoController;
use Illuminate\Support\Facades\Route;

Route::get('marcas', [MarcaController::class, 'index'])->name('marcas.index');
Route::post('marcas', [MarcaController::class, 'store'])->name('marcas.store');
Route::patch('marcas/{marca}', [MarcaController::class, 'update'])->name('marcas.update');
Route::delete('marcas/{marca}', [MarcaController::class, 'destroy'])->name('marcas.destroy');

Route::get('cotizador', [CotizadorController::class, 'index'])->name('cotizador.index');

Route::get('productos', [ProductoController::class, 'index'])->name('productos.index');
Route::get('productos/crear', [ProductoController::class, 'create'])->name('productos.create');
Route::post('productos', [ProductoController::class, 'store'])->name('productos.store');
Route::get('productos/{producto}', [ProductoController::class, 'show'])->name('productos.show');
Route::get('productos/{producto}/detalles', [ProductoController::class, 'detalles'])->withTrashed()->name('productos.detalles');
Route::get('productos/{producto}/editar', [ProductoController::class, 'edit'])->name('productos.edit');
Route::patch('productos/{producto}', [ProductoController::class, 'update'])->name('productos.update');
Route::delete('productos/{producto}', [ProductoController::class, 'destroy'])->name('productos.destroy');
Route::patch('productos/{producto}/restaurar', [ProductoController::class, 'restore'])->withTrashed()->name('productos.restore');
