<?php

use App\Models\User;
use App\Modules\Administracion\Models\Role;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Inventario\Models\AjusteInventario;
use App\Modules\Inventario\Models\Bodega;
use App\Modules\Inventario\Models\MovimientoStock;
use App\Modules\Inventario\Models\StockBodega;

beforeEach(function () {
    $this->owner = User::factory()->create();
    asignarRol($this->owner, 'Owner');
    $this->bodega = Bodega::factory()->create();
    $this->producto = Producto::factory()->create();
    StockBodega::create(['producto_id' => $this->producto->id, 'bodega_id' => $this->bodega->id, 'stock' => 20]);

    $this->ajustar = fn (array $datos, ?User $usuario = null) => $this->actingAs($usuario ?? $this->owner)
        ->post(route('ajustes-inventario.store'), $datos + [
            'producto_id' => $this->producto->id,
            'bodega_id' => $this->bodega->id,
            'motivo' => 'Mercancía dañada',
        ]);
});

function stockActual(): float
{
    return (float) StockBodega::sole()->stock;
}

test('a physical count sets the stock and leaves the difference in the kardex', function () {
    ($this->ajustar)(['tipo' => AjusteInventario::CONTEO, 'cantidad' => 17, 'motivo' => 'Conteo físico'])
        ->assertSessionHasNoErrors();

    expect(stockActual())->toBe(17.0);

    $ajuste = AjusteInventario::sole();
    expect($ajuste)
        ->stock_anterior->toEqual(20)
        ->diferencia->toEqual(-3)
        ->user_id->toBe($this->owner->id);

    $movimiento = MovimientoStock::sole();
    expect($movimiento)
        ->concepto->toBe(MovimientoStock::AJUSTE_SALIDA)
        ->cantidad->toEqual(-3)
        ->saldo->toEqual(17)
        ->documento_tipo->toBe('ajuste')
        ->documento_id->toBe($ajuste->id)
        ->nota->toBe('Conteo físico');

    expect(StockBodega::sole()->salidas)->toEqual(3);
});

test('units are added or taken out with their reason', function () {
    ($this->ajustar)(['tipo' => AjusteInventario::ENTRADA, 'cantidad' => 5, 'motivo' => 'Sobrante encontrado'])->assertSessionHasNoErrors();
    ($this->ajustar)(['tipo' => AjusteInventario::SALIDA, 'cantidad' => 2, 'nota' => 'Se mojaron'])->assertSessionHasNoErrors();

    expect(stockActual())->toBe(23.0)
        ->and(MovimientoStock::orderBy('id')->pluck('concepto')->all())->toBe([MovimientoStock::AJUSTE_ENTRADA, MovimientoStock::AJUSTE_SALIDA])
        ->and(MovimientoStock::latest('id')->first()->nota)->toBe('Mercancía dañada — Se mojaron');
});

test('an ajuste needs a reason and something to change', function () {
    ($this->ajustar)(['tipo' => AjusteInventario::SALIDA, 'cantidad' => 2, 'motivo' => ''])->assertSessionHasErrors('motivo');
    ($this->ajustar)(['tipo' => AjusteInventario::SALIDA, 'cantidad' => 0])->assertSessionHasErrors('cantidad');
    ($this->ajustar)(['tipo' => AjusteInventario::CONTEO, 'cantidad' => 20])
        ->assertSessionHasErrors(['cantidad' => 'El conteo coincide con el stock: no hay nada que ajustar.']);
    ($this->ajustar)(['tipo' => AjusteInventario::SALIDA, 'cantidad' => 1, 'producto_id' => Producto::factory()->create(['inventariable' => false])->id])
        ->assertSessionHasErrors('producto_id');

    expect(AjusteInventario::count())->toBe(0)
        ->and(stockActual())->toBe(20.0);
});

test('only who may adjust, and only in their bodegas', function () {
    $otra = Bodega::factory()->create();
    $miembro = User::factory()->create();
    asignarRol($miembro, 'Member');
    $rol = Role::create(['name' => 'Sur']);
    $rol->bodegas()->sync([$otra->id]);
    $miembro->assignRole($rol);
    $miembro->givePermissionTo(['ajustes-inventario.view', 'ajustes-inventario.create']);

    ($this->ajustar)(['tipo' => AjusteInventario::SALIDA, 'cantidad' => 1], $miembro)
        ->assertSessionHasErrors(['bodega_id' => 'No puedes ajustar el stock de esta bodega.']);

    $soloVer = User::factory()->create();
    asignarRol($soloVer, 'Member');
    $soloVer->givePermissionTo('ajustes-inventario.view');

    ($this->ajustar)(['tipo' => AjusteInventario::SALIDA, 'cantidad' => 1], $soloVer)->assertForbidden();

    $this->actingAs($soloVer)->get(route('ajustes-inventario.index'))
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->component('ajustes-inventario/index')
            ->where('canCreate', false)
            ->where('productos', [])
        );

    expect(AjusteInventario::count())->toBe(0);
});

test('the list shows the ajustes of the bodegas the user can see', function () {
    AjusteInventario::factory()->create(['bodega_id' => $this->bodega->id, 'producto_id' => $this->producto->id]);
    AjusteInventario::factory()->create();

    $this->actingAs($this->owner)->get(route('ajustes-inventario.index'))
        ->assertInertia(fn ($page) => $page
            ->has('ajustes', 2)
            ->where('canCreate', true)
            ->has('stocks', 1)
            ->where('motivos', AjusteInventario::MOTIVOS)
            ->where('canViewAjustesInventario', true)
        );
});
