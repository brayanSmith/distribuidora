<?php

namespace App\Support\Notificaciones;

use App\Models\User;
use Illuminate\Database\Eloquent\Collection;

/**
 * Who gets a push notification: the users with the permission to see what
 * it is about and that turned notifications on in some device.
 */
class Destinatarios
{
    /**
     * @return Collection<int, User>
     */
    public static function conPermiso(string $permiso): Collection
    {
        return User::permission($permiso)->whereHas('pushSubscriptions')->get();
    }
}
