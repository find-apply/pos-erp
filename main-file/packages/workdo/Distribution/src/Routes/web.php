<?php

use Illuminate\Support\Facades\Route;
use Workdo\Distribution\Http\Controllers\DistributionController;
use Workdo\Distribution\Http\Controllers\DriverAccessController;
use Workdo\Distribution\Http\Controllers\DriverPortalController;

/*
 * Back office. Gated by the module plan check and the distribution
 * permissions.
 */
Route::middleware(['web', 'auth', 'verified', 'PlanModuleCheck:Distribution'])
    ->prefix('distribution')
    ->name('distribution.')
    ->group(function () {
        Route::get('/', [DistributionController::class, 'index'])->name('index');

        Route::get('/drivers', [DistributionController::class, 'drivers'])->name('drivers');
        Route::post('/drivers', [DistributionController::class, 'storeDriver'])->name('drivers.store');
        Route::put('/drivers/{driver}', [DistributionController::class, 'updateDriver'])->name('drivers.update');
        Route::put('/drivers/{driver}/access-code', [DistributionController::class, 'regenerateDriverCode'])->name('drivers.access-code');
        Route::post('/drivers/{driver}/settle', [DistributionController::class, 'settleDriverCash'])->name('drivers.settle');
        Route::post('/drivers/{driver}/impersonate', [DistributionController::class, 'impersonateDriver'])->name('drivers.impersonate');
        Route::post('/drivers/{driver}/load', [DistributionController::class, 'loadVan'])->name('drivers.load');
        Route::post('/drivers/{driver}/unload', [DistributionController::class, 'unloadVan'])->name('drivers.unload');
        Route::delete('/drivers/{driver}', [DistributionController::class, 'destroyDriver'])->name('drivers.destroy');

        Route::get('/rounds', [DistributionController::class, 'rounds'])->name('rounds');
        Route::post('/rounds', [DistributionController::class, 'storeRound'])->name('rounds.store');
        Route::put('/rounds/{round}', [DistributionController::class, 'updateRound'])->name('rounds.update');
        Route::get('/rounds/{round}/track', [DistributionController::class, 'trackRound'])->name('rounds.track');
        Route::put('/rounds/{round}/transition', [DistributionController::class, 'transitionRound'])->name('rounds.transition');
        Route::delete('/rounds/{round}', [DistributionController::class, 'destroyRound'])->name('rounds.destroy');

        Route::get('/delivery-notes', [DistributionController::class, 'deliveryNotes'])->name('delivery-notes');
        Route::post('/delivery-notes', [DistributionController::class, 'storeDeliveryNote'])->name('delivery-notes.store');
        Route::put('/delivery-notes/{note}', [DistributionController::class, 'updateDeliveryNote'])->name('delivery-notes.update');
        Route::delete('/delivery-notes/{note}', [DistributionController::class, 'destroyDeliveryNote'])->name('delivery-notes.destroy');
        Route::get('/map', [DistributionController::class, 'map'])->name('map');
        Route::post('/map/pin', [DistributionController::class, 'savePin'])->name('map.pin');
        Route::get('/performance', [DistributionController::class, 'performance'])->name('performance');
    });

/*
 * Driver access. Guests reach the sign-in screen - this is the target the QR
 * on the driver card points at - and signed-in drivers reach their own stops.
 * Neither sits behind the back-office permissions.
 */
Route::middleware(['web'])
    ->prefix('livreur')
    ->name('distribution.driver.')
    ->group(function () {
        Route::get('/access', [DriverAccessController::class, 'show'])
            ->middleware('guest')
            ->name('access');

        Route::post('/access', [DriverAccessController::class, 'login'])
            ->middleware(['guest', 'throttle:10,1'])
            ->name('access.login');

        Route::middleware('auth')->group(function () {
            Route::get('/home', [DriverPortalController::class, 'home'])->name('home');
            Route::get('/round', [DriverPortalController::class, 'round'])->name('round');
            Route::get('/stock', [DriverPortalController::class, 'stock'])->name('stock');
            Route::get('/debts', [DriverPortalController::class, 'debts'])->name('debts');
            Route::get('/more', [DriverPortalController::class, 'more'])->name('more');
            Route::get('/map', [DriverPortalController::class, 'map'])->name('map');
            Route::post('/location', [DriverPortalController::class, 'storeLocation'])->name('location');
            Route::get('/printer', [DriverPortalController::class, 'printer'])->name('printer');
            Route::put('/notes/{note}/transit', [DriverPortalController::class, 'startTransit'])->name('notes.transit');
            Route::put('/notes/{note}/complete', [DriverPortalController::class, 'completeNote'])->name('notes.complete');
            Route::post('/collect', [DriverPortalController::class, 'collectDebt'])->name('collect');
            Route::post('/deposit', [DriverPortalController::class, 'depositCash'])->name('deposit');
            Route::post('/logout', [DriverAccessController::class, 'logout'])->name('logout');
        });
    });
