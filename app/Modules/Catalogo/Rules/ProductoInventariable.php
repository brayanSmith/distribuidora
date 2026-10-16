<?php

namespace App\Modules\Catalogo\Rules;

use App\Modules\Catalogo\Models\Producto;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Translation\PotentiallyTranslatedString;

/**
 * Rejects a producto_id that doesn't track stock: a servicio, or any
 * producto marked `inventariable = false`. Pair with `exists:productos,id`
 * so a truly missing id still gets that rule's own message.
 */
class ProductoInventariable implements ValidationRule
{
    /**
     * Run the validation rule.
     *
     * @param  Closure(string, ?string=): PotentiallyTranslatedString  $fail
     */
    public function validate(string $attribute, mixed $value, Closure $fail): void
    {
        $admiteStock = Producto::where('id', $value)
            ->where('inventariable', true)
            ->exists();

        if (! $admiteStock) {
            $fail('El producto seleccionado es un servicio y no maneja stock.');
        }
    }
}
