<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Spatie's teams mode is off, so the permission tables go back to their
     * plain shape. Databases that never had the team column are left as is.
     */
    public function up(): void
    {
        if (Schema::hasColumn('roles', 'team_id')) {
            Schema::table('roles', function (Blueprint $table) {
                $table->dropUnique(['team_id', 'name', 'guard_name']);
                $table->dropIndex('roles_team_foreign_key_index');
                $table->dropColumn('team_id');
                $table->unique(['name', 'guard_name']);
            });
        }

        foreach (['model_has_roles' => 'role_id', 'model_has_permissions' => 'permission_id'] as $tableName => $pivotKey) {
            if (! Schema::hasColumn($tableName, 'team_id')) {
                continue;
            }

            $primaryName = $tableName === 'model_has_roles'
                ? 'model_has_roles_role_model_type_primary'
                : 'model_has_permissions_permission_model_type_primary';

            Schema::table($tableName, function (Blueprint $table) use ($tableName, $pivotKey, $primaryName) {
                $table->dropPrimary($primaryName);
                $table->dropIndex("{$tableName}_team_foreign_key_index");
                $table->dropColumn('team_id');
                $table->primary([$pivotKey, 'model_id', 'model_type'], $primaryName);
            });
        }
    }

    /**
     * Not reversible: teams mode is gone from the app.
     */
    public function down(): void
    {
        //
    }
};
