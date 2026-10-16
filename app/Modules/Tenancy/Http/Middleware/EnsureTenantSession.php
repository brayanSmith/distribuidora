<?php

namespace App\Modules\Tenancy\Http\Middleware;

use Closure;
use Spatie\Multitenancy\Http\Middleware\EnsureValidTenantSession;

/**
 * Rejects a session that was started on a different tenant.
 * It is a no-op while multitenancy is turned off (no tenant finder).
 */
class EnsureTenantSession extends EnsureValidTenantSession
{
    public function handle($request, Closure $next)
    {
        if (! config('multitenancy.tenant_finder')) {
            return $next($request);
        }

        return parent::handle($request, $next);
    }
}
