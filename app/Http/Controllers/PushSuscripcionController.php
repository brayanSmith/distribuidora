<?php

namespace App\Http\Controllers;

use Illuminate\Http\Request;
use Illuminate\Http\Response;

/**
 * The devices where the user turned push notifications on: the browser
 * hands over where to send them, and forgets it when they are turned off.
 */
class PushSuscripcionController extends Controller
{
    public function store(Request $request): Response
    {
        $datos = $request->validate([
            'endpoint' => ['required', 'url', 'max:500'],
            'keys.p256dh' => ['required', 'string'],
            'keys.auth' => ['required', 'string'],
            'content_encoding' => ['nullable', 'string', 'in:aesgcm,aes128gcm'],
        ]);

        $request->user()->updatePushSubscription(
            $datos['endpoint'],
            $datos['keys']['p256dh'],
            $datos['keys']['auth'],
            $datos['content_encoding'] ?? 'aes128gcm',
        );

        return response()->noContent();
    }

    public function destroy(Request $request): Response
    {
        $datos = $request->validate(['endpoint' => ['required', 'string']]);

        $request->user()->deletePushSubscription($datos['endpoint']);

        return response()->noContent();
    }
}
