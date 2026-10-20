<?php

namespace App\Modules\Catalogo\Services;

use RuntimeException;

/**
 * A row of an import file that cannot be applied; its message is shown to the user.
 */
class FilaInvalida extends RuntimeException {}
