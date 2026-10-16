<?php

use App\Models\User;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Models\SubCategoria;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    foreach (['categorias', 'sub-categorias'] as $recurso) {
        foreach (['view', 'create', 'update', 'delete'] as $accion) {
            Permission::findOrCreate("{$recurso}.{$accion}");
        }
    }
});

test('owners can view, create, update and delete categorias', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->get(route('categorias.index'))->assertOk();

    $this->actingAs($owner)->post(route('categorias.store'), ['nombre_categoria' => 'Llantas'])->assertRedirect();

    $categoria = Categoria::firstOrFail();

    $this->actingAs($owner)->patch(route('categorias.update', [$categoria]), ['nombre_categoria' => 'Rines'])->assertRedirect();
    expect($categoria->fresh()->nombre_categoria)->toBe('Rines');

    $this->actingAs($owner)->delete(route('categorias.destroy', [$categoria]))->assertRedirect();
    expect(Categoria::find($categoria->id))->toBeNull();
});

test('members without permission cannot view categorias or subcategorias', function () {
    $member = User::factory()->create();
    asignarRol($member, 'Member');

    $this->actingAs($member)->get(route('categorias.index'))->assertForbidden();
    $this->actingAs($member)->get(route('sub-categorias.index'))->assertForbidden();
});

test('categoria name must be unique', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    Categoria::factory()->create(['nombre_categoria' => 'Llantas']);

    $this->actingAs($owner)->post(route('categorias.store'), ['nombre_categoria' => 'Llantas'])
        ->assertSessionHasErrors('nombre_categoria');
});

test('a categoria with productos or subcategorias cannot be deleted', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $conProducto = Categoria::factory()->create();
    Producto::factory()->create(['categoria_id' => $conProducto->id]);
    $conSubCategoria = SubCategoria::factory()->create()->categoria;

    $this->actingAs($owner)->delete(route('categorias.destroy', [$conProducto]))->assertRedirect();
    $this->actingAs($owner)->delete(route('categorias.destroy', [$conSubCategoria]))->assertRedirect();

    expect(Categoria::find($conProducto->id))->not->toBeNull()
        ->and(Categoria::find($conSubCategoria->id))->not->toBeNull();
});

test('owners can manage subcategorias, whose name is unique within its categoria', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');
    $categoria = Categoria::factory()->create();
    $otra = Categoria::factory()->create();

    $this->actingAs($owner)->get(route('sub-categorias.index'))->assertOk();

    $this->actingAs($owner)->post(route('sub-categorias.store'), [
        'categoria_id' => $categoria->id,
        'nombre_sub_categoria' => 'Carro',
    ])->assertRedirect();

    $this->actingAs($owner)->post(route('sub-categorias.store'), [
        'categoria_id' => $categoria->id,
        'nombre_sub_categoria' => 'Carro',
    ])->assertSessionHasErrors('nombre_sub_categoria');

    $this->actingAs($owner)->post(route('sub-categorias.store'), [
        'categoria_id' => $otra->id,
        'nombre_sub_categoria' => 'Carro',
    ])->assertSessionHasNoErrors();

    $subCategoria = SubCategoria::where('categoria_id', $categoria->id)->firstOrFail();

    $this->actingAs($owner)->patch(route('sub-categorias.update', [$subCategoria]), [
        'categoria_id' => $categoria->id,
        'nombre_sub_categoria' => 'Moto',
    ])->assertRedirect();
    expect($subCategoria->fresh()->nombre_sub_categoria)->toBe('Moto');

    $this->actingAs($owner)->delete(route('sub-categorias.destroy', [$subCategoria]))->assertRedirect();
    expect(SubCategoria::find($subCategoria->id))->toBeNull();
});

test('a subcategoria with productos cannot be deleted', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $subCategoria = SubCategoria::factory()->create();
    Producto::factory()->create(['categoria_id' => $subCategoria->categoria_id, 'sub_categoria_id' => $subCategoria->id]);

    $this->actingAs($owner)->delete(route('sub-categorias.destroy', [$subCategoria]))->assertRedirect();

    expect(SubCategoria::find($subCategoria->id))->not->toBeNull();
});
