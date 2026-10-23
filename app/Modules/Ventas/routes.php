<?php

use App\Modules\Ventas\Http\Controllers\AbonoController;
use App\Modules\Ventas\Http\Controllers\ClienteController;
use App\Modules\Ventas\Http\Controllers\CuentasPorCobrarController;
use App\Modules\Ventas\Http\Controllers\EntregaController;
use App\Modules\Ventas\Http\Controllers\PedidoController;
use App\Modules\Ventas\Http\Controllers\PosController;
use App\Modules\Ventas\Http\Controllers\SeparadoController;
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

Route::get('pedidos/cuentas-por-cobrar', [CuentasPorCobrarController::class, 'index'])->name('pedidos.cuentas-por-cobrar');
Route::get('separados', [SeparadoController::class, 'index'])->name('separados.index');
Route::patch('separados/{pedido}', [SeparadoController::class, 'update'])->name('separados.update');
Route::post('separados/{pedido}/entregar', [SeparadoController::class, 'entregar'])->name('separados.entregar');
Route::post('separados/{pedido}/anular', [SeparadoController::class, 'anular'])->name('separados.anular');
Route::get('separados/{pedido}/voucher', [SeparadoController::class, 'voucher'])->name('separados.voucher');
Route::get('entregas', [EntregaController::class, 'index'])->name('entregas.index');
Route::patch('entregas/{entrega}', [EntregaController::class, 'update'])->name('entregas.update');
Route::get('entregas/{entrega}/voucher', [EntregaController::class, 'voucher'])->name('entregas.voucher');
Route::post('entregas/{entrega}/anular', [EntregaController::class, 'anular'])->name('entregas.anular');
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
