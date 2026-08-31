<?php

use Illuminate\Support\Facades\Route;
use Workdo\FleetTracking\Http\Controllers\FleetTrackingController;

Route::middleware(['web', 'auth', 'verified', 'PlanModuleCheck:FleetTracking'])
    ->prefix('fleet-tracking')
    ->name('fleet-tracking.')
    ->group(function () {
        Route::get('/', [FleetTrackingController::class, 'index'])->name('index');
        Route::get('/settings', [FleetTrackingController::class, 'settings'])->name('settings');
        // Declared before /vehicles/{vehicle} so the literal segment is not
        // swallowed by the wildcard.
        Route::get('/vehicles', [FleetTrackingController::class, 'vehicles'])->name('vehicles.index');
        // Redirect target is literal — the group prefix is not applied to redirect destinations.
        Route::redirect('/setting', '/fleet-tracking/settings');
        Route::post('/vehicles', [FleetTrackingController::class, 'storeVehicle'])->name('vehicles.store');
        Route::put('/vehicles/{vehicle}', [FleetTrackingController::class, 'updateVehicle'])->name('vehicles.update');
        Route::delete('/vehicles/{vehicle}', [FleetTrackingController::class, 'destroyVehicle'])->name('vehicles.destroy');
        Route::post('/assignments', [FleetTrackingController::class, 'storeAssignment'])->name('assignments.store');
        Route::put('/assignments/{assignment}/end', [FleetTrackingController::class, 'endAssignment'])->name('assignments.end');
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

        // Traccar forwards positions server-to-server and cannot carry a CSRF
        // token or a session, so this sits outside the authenticated group and
        // authenticates on the X-Traccar-Secret header instead.
        Route::post('/traccar/positions', [FleetTrackingController::class, 'traccarPosition'])
            ->name('traccar.positions');
    });
