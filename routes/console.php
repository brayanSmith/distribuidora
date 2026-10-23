<?php

use Illuminate\Support\Facades\Schedule;

/*
 * Push notifications with what is pending, every morning (Bogotá time), so
 * nobody has to open the app to find out.
 */
Schedule::command('entregas:avisar-pendientes')->dailyAt('07:00')->timezone('America/Bogota');
Schedule::command('cuentas-por-pagar:avisar')->dailyAt('07:00')->timezone('America/Bogota');
