<?php

use App\Modules\Tenancy\Actions\ProvisionTenant;
use App\Modules\Tenancy\Models\Tenant;
use App\Modules\Ventas\Models\Cliente;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Spatie\Multitenancy\TenantFinder\DomainTenantFinder;
use Spatie\Permission\Models\Permission;

beforeEach(function () {
    $this->tenancyDir = sys_get_temp_dir().'/tenancy-'.uniqid();
    mkdir($this->tenancyDir);

    config([
        'database.connections.landlord' => ['driver' => 'sqlite', 'database' => $this->tenancyDir.'/landlord.sqlite', 'prefix' => '', 'foreign_key_constraints' => true],
        'database.connections.tenant' => ['driver' => 'sqlite', 'database' => null, 'prefix' => '', 'foreign_key_constraints' => true],
        'multitenancy.tenant_finder' => DomainTenantFinder::class,
    ]);

    // In production the default connection is "tenant"; mirror that here.
    $this->originalConnection = DB::getDefaultConnection();
    DB::setDefaultConnection('tenant');

    touch($this->tenancyDir.'/landlord.sqlite');
    $this->artisan('migrate', [
        '--database' => 'landlord',
        '--path' => 'app/Modules/Tenancy/database/migrations',
        '--force' => true,
    ])->assertSuccessful();
});

afterEach(function () {
    DB::setDefaultConnection($this->originalConnection);
    Tenant::forgetCurrent();
    DB::purge('tenant');
    DB::purge('landlord');

    array_map('unlink', glob($this->tenancyDir.'/*'));
    rmdir($this->tenancyDir);
});

function provisionar(string $name, string $domain): Tenant
{
    return app(ProvisionTenant::class)->execute($name, $domain, test()->tenancyDir."/{$name}.sqlite");
}

test('provisioning a tenant registers it and prepares its own migrated and seeded database', function () {
    $tenant = provisionar('alfa', 'alfa.test');

    expect(Tenant::where('domain', 'alfa.test')->exists())->toBeTrue();
    expect($tenant->database)->toBe($this->tenancyDir.'/alfa.sqlite');

    $tenant->execute(function () {
        expect(Schema::connection('tenant')->hasTable('productos'))->toBeTrue();
        expect(Permission::count())->toBeGreaterThan(0);
    });
});

test('the tenant is found from the request host', function () {
    $tenant = provisionar('alfa', 'alfa.test');
    provisionar('beta', 'beta.test');

    $found = app(DomainTenantFinder::class)->findForRequest(request()->duplicate(server: ['HTTP_HOST' => 'alfa.test']));

    expect($found->is($tenant))->toBeTrue();
});

test('each tenant only sees its own data', function () {
    $alfa = provisionar('alfa', 'alfa.test');
    $beta = provisionar('beta', 'beta.test');

    $alfa->execute(fn () => Cliente::factory()->create(['razon_social' => 'Cliente de Alfa']));

    expect($alfa->execute(fn () => Cliente::count()))->toBe(1);
    expect($beta->execute(fn () => Cliente::count()))->toBe(0);
});

test('a host that belongs to no tenant gets a 404', function () {
    $this->get('/')->assertNotFound();
});

test('a host that belongs to a tenant is served', function () {
    provisionar('alfa', 'alfa.test')->makeCurrent();

    $this->get('/')->assertOk();
});
