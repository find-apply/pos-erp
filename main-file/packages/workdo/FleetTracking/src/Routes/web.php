<?php

use Illuminate\Support\Facades\Route;
use Workdo\FleetTracking\Http\Controllers\FleetTrackingController;

Route::middleware(['web', 'auth', 'verified', 'PlanModuleCheck:FleetTracking'])
    ->prefix('fleet-tracking')
    ->name('fleet-tracking.')
    ->group(function () {
        Route::get('/', [FleetTrackingController::class, 'index'])->name('index');
        Route::get('/settings', [FleetTrackingController::class, 'settings'])->name('settings');
        Route::post('/vehicles', [FleetTrackingController::class, 'storeVehicle'])->name('vehicles.store');
        Route::put('/vehicles/{vehicle}', [FleetTrackingController::class, 'updateVehicle'])->name('vehicles.update');
        Route::post('/assignments', [FleetTrackingController::class, 'storeAssignment'])->name('assignments.store');
        Route::get('/vehicles/{vehicle}', [FleetTrackingController::class, 'showVehicle'])->name('vehicles.show');
        Route::get('/drivers/{driver}', [FleetTrackingController::class, 'showDriver'])->name('drivers.show');

        Route::get('/mobile', [FleetTrackingController::class, 'mobile'])->name('mobile');
        Route::post('/sessions/start', [FleetTrackingController::class, 'startSession'])->name('sessions.start');
        Route::post('/sessions/stop', [FleetTrackingController::class, 'stopSession'])->name('sessions.stop');
        Route::post('/pings', [FleetTrackingController::class, 'storePing'])->name('pings.store');
    });

Route::middleware(['api.json'])
    ->prefix('fleet-tracking')
    ->name('fleet-tracking.')
    ->group(function () {
        Route::post('/device-pings', [FleetTrackingController::class, 'devicePing'])->name('device-pings.store');
    });
