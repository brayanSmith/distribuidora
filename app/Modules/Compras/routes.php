<?php

use App\Modules\Compras\Http\Controllers\CompraController;
use App\Modules\Compras\Http\Controllers\ProveedorController;
use Illuminate\Support\Facades\Route;

Route::get('proveedores', [ProveedorController::class, 'index'])->name('proveedores.index');
Route::post('proveedores', [ProveedorController::class, 'store'])->name('proveedores.store');
Route::patch('proveedores/{proveedor}', [ProveedorController::class, 'update'])->name('proveedores.update');
Route::delete('proveedores/{proveedor}', [ProveedorController::class, 'destroy'])->name('proveedores.destroy');
Route::patch('proveedores/{proveedor}/restaurar', [ProveedorController::class, 'restore'])->withTrashed()->name('proveedores.restore');

Route::get('compras', [CompraController::class, 'index'])->name('compras.index');
Route::get('compras/crear', [CompraController::class, 'create'])->name('compras.create');
Route::post('compras', [CompraController::class, 'store'])->name('compras.store');
Route::get('compras/{compra}/editar', [CompraController::class, 'edit'])->name('compras.edit');
Route::get('compras/{compra}/ver', [CompraController::class, 'show'])->withTrashed()->name('compras.show');
Route::patch('compras/{compra}', [CompraController::class, 'update'])->name('compras.update');
Route::delete('compras/{compra}', [CompraController::class, 'destroy'])->name('compras.destroy');
Route::patch('compras/{compra}/restaurar', [CompraController::class, 'restore'])->withTrashed()->name('compras.restore');
