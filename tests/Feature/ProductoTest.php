<?php

use App\Models\User;
use App\Modules\Catalogo\Models\Categoria;
use App\Modules\Catalogo\Models\ImagenProducto;
use App\Modules\Catalogo\Models\Producto;
use App\Modules\Catalogo\Models\SubCategoria;
use App\Modules\Compras\Models\Compra;
use App\Modules\Compras\Models\DetalleCompra;
use App\Modules\Compras\Models\Proveedor;
use App\Modules\Ventas\Models\Cliente;
use App\Modules\Ventas\Models\DetallePedido;
use App\Modules\Ventas\Models\Pedido;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    Permission::findOrCreate('productos.view');
    Permission::findOrCreate('productos.create');
    Permission::findOrCreate('productos.update');
    Permission::findOrCreate('productos.delete');
});

test('owners can view, create, update and delete productos without a custom role', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->get(route('productos.index'))->assertOk();
    $this->actingAs($owner)->get(route('productos.create'))->assertOk();

    $response = $this->actingAs($owner)->post(route('productos.store'), [
        'inventariable' => true,
        'marca' => 'WANDA',
        'referencia_producto' => '155R13',
        'descripcion_producto' => '8PR/WR082/90/88N',
        'costo_producto' => 115000,
        'valor_detal' => 150000,
        'valor_mayorista' => 130000,
    ]);

    $response->assertRedirect(route('productos.index'));

    $producto = Producto::firstOrFail();
    expect($producto->concatenar_codigo_nombre)->toBe('155R13-WANDA-8PR/WR082/90/88N');

    $this->actingAs($owner)->get(route('productos.show', [$producto]))->assertOk();
    $this->actingAs($owner)->get(route('productos.edit', [$producto]))->assertOk();

    $this->actingAs($owner)->patch(route('productos.update', [$producto]), [
        'marca' => 'WANDA',
        'referencia_producto' => '155R13',
        'descripcion_producto' => 'Actualizada',
    ])->assertRedirect(route('productos.index'));

    expect($producto->fresh()->descripcion_producto)->toBe('Actualizada');
    expect($producto->fresh()->concatenar_codigo_nombre)->toBe('155R13-WANDA-Actualizada');

    $this->actingAs($owner)->delete(route('productos.destroy', [$producto]))
        ->assertRedirect(route('productos.index'));

    expect(Producto::withTrashed()->find($producto->id)->trashed())->toBeTrue();
});

test('members without permission cannot view productos', function () {
    $member = User::factory()->create();
    asignarRol($member, 'Member');

    $this->actingAs($member)->get(route('productos.index'))->assertForbidden();
});

test('sku must be unique when provided', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    Producto::factory()->create(['sku' => '12345678']);

    $this->actingAs($owner)->post(route('productos.store'), [
        'sku' => '12345678',
    ])->assertSessionHasErrors('sku');
});

test('the detalles endpoint returns paginated pedido and compra history for a producto', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $producto = Producto::factory()->create();
    $otroProducto = Producto::factory()->create();

    $cliente = Cliente::factory()->create(['razon_social' => 'Cliente Uno']);
    $pedido = Pedido::factory()->create(['cliente_id' => $cliente->id]);
    DetallePedido::factory()->create(['producto_id' => $producto->id, 'pedido_id' => $pedido->id]);
    DetallePedido::factory()->create(['producto_id' => $otroProducto->id]);

    $proveedor = Proveedor::factory()->create(['nombre_proveedor' => 'Proveedor Uno']);
    $compra = Compra::factory()->create(['proveedor_id' => $proveedor->id]);
    DetalleCompra::factory()->create(['producto_id' => $producto->id, 'compra_id' => $compra->id]);
    DetalleCompra::factory()->create(['producto_id' => $otroProducto->id]);

    $response = $this->actingAs($owner)->getJson(route('productos.detalles', [$producto]));

    $response->assertOk();
    $response->assertJsonCount(1, 'detallePedidos.data');
    $response->assertJsonCount(1, 'detalleCompras.data');
    $response->assertJsonPath('detallePedidos.data.0.pedido.cliente.razon_social', 'Cliente Uno');
    $response->assertJsonPath('detalleCompras.data.0.compra.proveedor.nombre_proveedor', 'Proveedor Uno');
});

test('members without permission cannot view producto detalles', function () {
    $member = User::factory()->create();
    asignarRol($member, 'Member');
    $producto = Producto::factory()->create();

    $this->actingAs($member)->getJson(route('productos.detalles', [$producto]))->assertForbidden();
});

test('creating a producto from another screen can keep the user there', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $payload = ['referencia_producto' => 'X-1'];

    $this->actingAs($owner)->from(route('pos.index'))
        ->post(route('productos.store'), $payload + ['stay_on_page' => '1'])
        ->assertRedirect(route('pos.index'));

    $this->actingAs($owner)
        ->post(route('productos.store'), ['referencia_producto' => 'X-2'] + $payload)
        ->assertRedirect(route('productos.index'));
});

test('a producto belongs to a categoria and one of its subcategorias', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $llantas = Categoria::factory()->hasSubCategorias(2)->create();
    $otraSubCategoria = SubCategoria::factory()->create();

    $this->actingAs($owner)->post(route('productos.store'), [
        'referencia_producto' => 'CAT-1',
        'categoria_id' => $llantas->id,
        'sub_categoria_id' => $llantas->subCategorias->first()->id,
    ])->assertSessionHasNoErrors();

    $producto = Producto::where('referencia_producto', 'CAT-1')->firstOrFail();
    expect($producto->categoria->is($llantas))->toBeTrue()
        ->and($producto->subCategoria->is($llantas->subCategorias->first()))->toBeTrue();

    $this->actingAs($owner)->post(route('productos.store'), [
        'referencia_producto' => 'CAT-2',
        'categoria_id' => $llantas->id,
        'sub_categoria_id' => $otraSubCategoria->id,
    ])->assertSessionHasErrors('sub_categoria_id');
});

test('a producto can have several imagenes, added and removed on update', function () {
    Storage::fake('public');
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->post(route('productos.store'), [
        'referencia_producto' => 'IMG-1',
        'imagenes' => [UploadedFile::fake()->image('a.jpg'), UploadedFile::fake()->image('b.jpg')],
    ])->assertSessionHasNoErrors();

    $producto = Producto::where('referencia_producto', 'IMG-1')->firstOrFail();
    expect($producto->imagenes)->toHaveCount(2);
    $producto->imagenes->each(fn (ImagenProducto $imagen) => Storage::disk('public')->assertExists($imagen->imagen_producto));

    $quitada = $producto->imagenes->first();

    $this->actingAs($owner)->patch(route('productos.update', [$producto]), [
        'referencia_producto' => 'IMG-1',
        'remove_imagen_ids' => [$quitada->id],
        'imagenes' => [UploadedFile::fake()->image('c.jpg')],
    ])->assertSessionHasNoErrors();

    expect($producto->fresh()->imagenes)->toHaveCount(2)
        ->and(ImagenProducto::find($quitada->id))->toBeNull();
    Storage::disk('public')->assertMissing($quitada->imagen_producto);
});

test('imagenes of another producto cannot be removed', function () {
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $producto = Producto::factory()->create();
    $ajena = ImagenProducto::factory()->create();

    $this->actingAs($owner)->patch(route('productos.update', [$producto]), [
        'remove_imagen_ids' => [$ajena->id],
    ])->assertSessionHasErrors('remove_imagen_ids.0');

    expect(ImagenProducto::find($ajena->id))->not->toBeNull();
});

test('the imagenes follow the order the user chose and the first one is the cover', function () {
    Storage::fake('public');
    $owner = User::factory()->create();
    asignarRol($owner, 'Owner');

    $this->actingAs($owner)->post(route('productos.store'), [
        'referencia_producto' => 'ORD-1',
        'imagenes' => [UploadedFile::fake()->image('a.jpg', 10, 10), UploadedFile::fake()->image('b.jpg', 200, 200)],
        'orden_imagenes' => ['n1', 'n0'],
    ])->assertSessionHasNoErrors();

    $producto = Producto::where('referencia_producto', 'ORD-1')->firstOrFail();
    [$primera, $segunda] = $producto->imagenes->all();

    // b.jpg (the bigger one) was uploaded second but chosen first.
    expect(Storage::disk('public')->size($primera->imagen_producto))->toBeGreaterThan(Storage::disk('public')->size($segunda->imagen_producto));

    $this->actingAs($owner)->patch(route('productos.update', [$producto]), [
        'referencia_producto' => 'ORD-1',
        'imagenes' => [UploadedFile::fake()->image('c.jpg')],
        'orden_imagenes' => ['n0', 'e'.$primera->id, 'e'.$segunda->id],
    ])->assertSessionHasNoErrors();

    $ids = $producto->fresh()->imagenes->pluck('id')->all();
    expect($ids)->toHaveCount(3)
        ->and(array_slice($ids, 1))->toBe([$primera->id, $segunda->id]);
});
