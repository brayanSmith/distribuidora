<?php

namespace App\Modules\Tenancy\Models;

use Database\Factories\TenantFactory;
use Illuminate\Database\Eloquent\Attributes\UseFactory;
use Spatie\Multitenancy\Models\Tenant as BaseTenant;

/**
 * A business (distribuidora) with its own domain and its own database.
 * Lives in the landlord database.
 *
 * @property int $id
 * @property string $name
 * @property string $domain
 * @property string $database
 */
#[UseFactory(TenantFactory::class)]
class Tenant extends BaseTenant
{
    protected $fillable = ['name', 'domain', 'database'];
}
