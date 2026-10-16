<?php

namespace Database\Factories;

use App\Modules\Tenancy\Models\Tenant;
use Illuminate\Database\Eloquent\Factories\Factory;

/**
 * @extends Factory<Tenant>
 */
class TenantFactory extends Factory
{
    protected $model = Tenant::class;

    /**
     * @return array<string, mixed>
     */
    public function definition(): array
    {
        $slug = fake()->unique()->slug(2);

        return [
            'name' => fake()->company(),
            'domain' => "{$slug}.test",
            'database' => 'tenant_'.str_replace('-', '_', $slug),
        ];
    }
}
