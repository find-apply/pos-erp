<?php

use Illuminate\Support\Facades\Route;
use Workdo\Zakat\Http\Controllers\ZakatController;

Route::middleware(['web', 'auth', 'verified', 'PlanModuleCheck:Zakat'])->prefix('zakat')->name('zakat.')->group(function () {
    Route::get('/', [ZakatController::class, 'index'])->name('index');
    Route::put('/settings', [ZakatController::class, 'updateSettings'])->name('settings.update');

    Route::post('/calculations', [ZakatController::class, 'store'])->name('calculations.store');
    Route::get('/calculations/{calculation}', [ZakatController::class, 'show'])->name('calculations.show');
    Route::post('/calculations/{calculation}/finalize', [ZakatController::class, 'finalize'])->name('calculations.finalize');
    Route::get('/calculations/{calculation}/report', [ZakatController::class, 'report'])->name('calculations.report');

    Route::post('/calculations/{calculation}/payments', [ZakatController::class, 'storePayment'])->name('payments.store');
});
