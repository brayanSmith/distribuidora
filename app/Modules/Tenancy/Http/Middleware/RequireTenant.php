<?php

namespace App\Modules\Tenancy\Http\Middleware;

use App\Modules\Tenancy\Models\Tenant;
use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Answers 404 when the request host does not belong to any tenant.
 * It is a no-op while multitenancy is turned off (no tenant finder).
 */
class RequireTenant
{
    public function handle(Request $request, Closure $next): Response
    {
        if (config('multitenancy.tenant_finder')) {
            abort_unless(Tenant::checkCurrent(), Response::HTTP_NOT_FOUND);
        }

        return $next($request);
    }
}
