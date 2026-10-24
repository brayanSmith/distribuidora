<?php

use App\Modules\Administracion\Http\Controllers\DashboardController;
use App\Modules\Administracion\Http\Controllers\EmpresaController;
use App\Modules\Administracion\Http\Controllers\HistorialController;
use App\Modules\Administracion\Http\Controllers\InicioSesionController;
use App\Modules\Administracion\Http\Controllers\RoleController;
use App\Modules\Administracion\Http\Controllers\UsuarioController;
use App\Modules\Administracion\Http\Controllers\VoucherDisenoController;
use Illuminate\Support\Facades\Route;

Route::get('dashboard', DashboardController::class)->name('dashboard');

Route::get('roles', [RoleController::class, 'index'])->name('roles.index');
Route::post('roles', [RoleController::class, 'store'])->name('roles.store');
Route::patch('roles/miembros/{user}', [RoleController::class, 'updateMember'])->name('roles.members.update');
Route::patch('roles/{role}', [RoleController::class, 'update'])->name('roles.update');
Route::delete('roles/{role}', [RoleController::class, 'destroy'])->name('roles.destroy');

Route::get('usuarios', [UsuarioController::class, 'index'])->name('usuarios.index');
Route::post('usuarios', [UsuarioController::class, 'store'])->name('usuarios.store');
Route::patch('usuarios/{usuario}/precios', [UsuarioController::class, 'updatePrecios'])->name('usuarios.precios.update');
Route::patch('usuarios/{usuario}', [UsuarioController::class, 'update'])->name('usuarios.update');
Route::delete('usuarios/{usuario}', [UsuarioController::class, 'destroy'])->name('usuarios.destroy');

Route::get('historial', [HistorialController::class, 'index'])->name('historial.index');

Route::get('inicios-sesion', [InicioSesionController::class, 'index'])->name('inicios-sesion.index');

Route::get('empresa', [EmpresaController::class, 'edit'])->name('empresa.edit');
Route::patch('empresa', [EmpresaController::class, 'update'])->name('empresa.update');
Route::get('empresa/voucher', [VoucherDisenoController::class, 'edit'])->name('empresa.voucher.edit');
Route::put('empresa/voucher', [VoucherDisenoController::class, 'update'])->name('empresa.voucher.update');
