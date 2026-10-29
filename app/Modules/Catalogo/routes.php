<?php

use App\Modules\Catalogo\Http\Controllers\CatalogoPdfController;
use App\Modules\Catalogo\Http\Controllers\CatalogoPlantillaController;
use App\Modules\Catalogo\Http\Controllers\CategoriaController;
use App\Modules\Catalogo\Http\Controllers\ExportacionProductosController;
use App\Modules\Catalogo\Http\Controllers\ImportacionController;
use App\Modules\Catalogo\Http\Controllers\ProductoController;
use App\Modules\Catalogo\Http\Controllers\ProductoPreciosController;
use App\Modules\Catalogo\Http\Controllers\SubCategoriaController;
use Illuminate\Support\Facades\Route;

Route::get('categorias', [CategoriaController::class, 'index'])->name('categorias.index');
Route::post('categorias', [CategoriaController::class, 'store'])->name('categorias.store');
Route::patch('categorias/{categoria}', [CategoriaController::class, 'update'])->name('categorias.update');
Route::delete('categorias/{categoria}', [CategoriaController::class, 'destroy'])->name('categorias.destroy');

Route::get('sub-categorias', [SubCategoriaController::class, 'index'])->name('sub-categorias.index');
Route::post('sub-categorias', [SubCategoriaController::class, 'store'])->name('sub-categorias.store');
Route::patch('sub-categorias/{sub_categoria}', [SubCategoriaController::class, 'update'])->name('sub-categorias.update');
Route::delete('sub-categorias/{sub_categoria}', [SubCategoriaController::class, 'destroy'])->name('sub-categorias.destroy');

Route::post('importaciones/previa', [ImportacionController::class, 'previa'])->name('importaciones.previa');
Route::post('importaciones/imagenes', [ImportacionController::class, 'imagen'])->name('importaciones.imagenes');
Route::post('importaciones', [ImportacionController::class, 'store'])->name('importaciones.store');
Route::get('importaciones/plantilla', [ImportacionController::class, 'plantilla'])->name('importaciones.plantilla');
Route::patch('importaciones/leidas', [ImportacionController::class, 'marcarTodasLeidas'])->name('importaciones.leidas');
Route::patch('importaciones/{importacion}/leida', [ImportacionController::class, 'marcarLeida'])->name('importaciones.leida');
Route::get('productos/exportar', ExportacionProductosController::class)->name('productos.exportar');

// The product catalog as PDF, generated in the background.
Route::get('catalogo-pdf', [CatalogoPdfController::class, 'index'])->name('catalogo-pdf.index');
Route::post('catalogo-pdf', [CatalogoPdfController::class, 'store'])->name('catalogo-pdf.store');
Route::get('catalogo-pdf/vista-previa', [CatalogoPdfController::class, 'vistaPrevia'])->name('catalogo-pdf.vista-previa');
Route::get('catalogo-pdf/{catalogo}', [CatalogoPdfController::class, 'show'])->name('catalogo-pdf.show');
Route::get('catalogo-pdf/{catalogo}/descargar', [CatalogoPdfController::class, 'descargar'])->name('catalogo-pdf.descargar');

// Designs of the catalog, made of blocks.
Route::get('catalogo-plantillas/crear', [CatalogoPlantillaController::class, 'create'])->name('catalogo-plantillas.create');
Route::post('catalogo-plantillas', [CatalogoPlantillaController::class, 'store'])->name('catalogo-plantillas.store');
Route::post('catalogo-plantillas/vista-previa', [CatalogoPlantillaController::class, 'vistaPrevia'])->name('catalogo-plantillas.vista-previa');
Route::get('catalogo-plantillas/{plantilla}/editar', [CatalogoPlantillaController::class, 'edit'])->name('catalogo-plantillas.edit');
Route::put('catalogo-plantillas/{plantilla}', [CatalogoPlantillaController::class, 'update'])->name('catalogo-plantillas.update');
Route::delete('catalogo-plantillas/{plantilla}', [CatalogoPlantillaController::class, 'destroy'])->name('catalogo-plantillas.destroy');

Route::get('productos', [ProductoController::class, 'index'])->name('productos.index');
Route::get('productos/crear', [ProductoController::class, 'create'])->name('productos.create');
Route::post('productos', [ProductoController::class, 'store'])->name('productos.store');
Route::get('productos/{producto}', [ProductoController::class, 'show'])->name('productos.show');
Route::get('productos/{producto}/detalles', [ProductoController::class, 'detalles'])->withTrashed()->name('productos.detalles');
Route::get('productos/{producto}/editar', [ProductoController::class, 'edit'])->name('productos.edit');
Route::patch('productos/{producto}', [ProductoController::class, 'update'])->name('productos.update');
Route::patch('productos/{producto}/precios', ProductoPreciosController::class)->name('productos.precios');
Route::delete('productos/{producto}', [ProductoController::class, 'destroy'])->name('productos.destroy');
Route::patch('productos/{producto}/restaurar', [ProductoController::class, 'restore'])->withTrashed()->name('productos.restore');
