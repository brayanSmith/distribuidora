<?php

use App\Modules\Ventas\Http\Controllers\AbonoController;
use App\Modules\Ventas\Http\Controllers\ClienteController;
use App\Modules\Ventas\Http\Controllers\PedidoController;
use App\Modules\Ventas\Http\Controllers\PosController;
use Illuminate\Support\Facades\Route;

Route::get('clientes', [ClienteController::class, 'index'])->name('clientes.index');
Route::post('clientes', [ClienteController::class, 'store'])->name('clientes.store');
Route::patch('clientes/{cliente}', [ClienteController::class, 'update'])->name('clientes.update');
Route::delete('clientes/{cliente}', [ClienteController::class, 'destroy'])->name('clientes.destroy');
Route::patch('clientes/{cliente}/restaurar', [ClienteController::class, 'restore'])->withTrashed()->name('clientes.restore');

Route::get('pos', [PosController::class, 'index'])->name('pos.index');
Route::post('pos', [PosController::class, 'store'])->name('pos.store');
Route::get('pos/pedidos', [PosController::class, 'pedidos'])->name('pos.pedidos');
Route::get('pos/pedidos/{pedido}/voucher', [PosController::class, 'voucher'])->name('pos.pedidos.voucher');
Route::get('pos/clientes/{cliente}/pedidos', [PosController::class, 'clientePedidos'])->name('pos.clientes.pedidos');

Route::get('pedidos', [PedidoController::class, 'index'])->name('pedidos.index');
Route::get('pedidos/crear', [PedidoController::class, 'create'])->name('pedidos.create');
Route::post('pedidos', [PedidoController::class, 'store'])->name('pedidos.store');
Route::get('pedidos/{pedido}/editar', [PedidoController::class, 'edit'])->name('pedidos.edit');
Route::get('pedidos/{pedido}/ver', [PedidoController::class, 'show'])->withTrashed()->name('pedidos.show');
Route::get('pedidos/{pedido}/voucher', [PedidoController::class, 'voucher'])->name('pedidos.voucher');
Route::patch('pedidos/{pedido}', [PedidoController::class, 'update'])->name('pedidos.update');
Route::delete('pedidos/{pedido}', [PedidoController::class, 'destroy'])->name('pedidos.destroy');
Route::patch('pedidos/{pedido}/restaurar', [PedidoController::class, 'restore'])->withTrashed()->name('pedidos.restore');
Route::post('pedidos/{pedido}/abonos', [AbonoController::class, 'store'])->name('pedidos.abonos.store');
Route::patch('pedidos/{pedido}/abonos/{abono}', [AbonoController::class, 'update'])->name('pedidos.abonos.update');
Route::delete('pedidos/{pedido}/abonos/{abono}', [AbonoController::class, 'destroy'])->name('pedidos.abonos.destroy');

// Same controllers as "pedidos" above; PedidoController/AbonoController scope

// themselves to DETAL vs MAYORISTA by reading the matched route's name.

Route::get('pedidos-mayoristas', [PedidoController::class, 'index'])->name('pedidos-mayoristas.index');
Route::get('pedidos-mayoristas/crear', [PedidoController::class, 'create'])->name('pedidos-mayoristas.create');
Route::post('pedidos-mayoristas', [PedidoController::class, 'store'])->name('pedidos-mayoristas.store');
Route::get('pedidos-mayoristas/{pedido}/editar', [PedidoController::class, 'edit'])->name('pedidos-mayoristas.edit');
Route::get('pedidos-mayoristas/{pedido}/ver', [PedidoController::class, 'show'])->withTrashed()->name('pedidos-mayoristas.show');
Route::get('pedidos-mayoristas/{pedido}/voucher', [PedidoController::class, 'voucher'])->name('pedidos-mayoristas.voucher');
Route::patch('pedidos-mayoristas/{pedido}', [PedidoController::class, 'update'])->name('pedidos-mayoristas.update');
Route::delete('pedidos-mayoristas/{pedido}', [PedidoController::class, 'destroy'])->name('pedidos-mayoristas.destroy');
Route::patch('pedidos-mayoristas/{pedido}/restaurar', [PedidoController::class, 'restore'])->withTrashed()->name('pedidos-mayoristas.restore');
Route::post('pedidos-mayoristas/{pedido}/abonos', [AbonoController::class, 'store'])->name('pedidos-mayoristas.abonos.store');
Route::patch('pedidos-mayoristas/{pedido}/abonos/{abono}', [AbonoController::class, 'update'])->name('pedidos-mayoristas.abonos.update');
Route::delete('pedidos-mayoristas/{pedido}/abonos/{abono}', [AbonoController::class, 'destroy'])->name('pedidos-mayoristas.abonos.destroy');
