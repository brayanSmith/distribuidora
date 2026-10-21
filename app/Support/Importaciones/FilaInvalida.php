<?php

namespace App\Support\Importaciones;

use RuntimeException;

/**
 * A row of an import that cannot be saved; its message is shown to the user.
 */
class FilaInvalida extends RuntimeException {}
