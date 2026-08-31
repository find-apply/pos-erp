<?php

namespace Workdo\Distribution\Http\Controllers;

use App\Http\Controllers\Controller;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Workdo\Distribution\Models\Driver;

/**
 * Access-code sign-in for drivers.
 *
 * Drivers do not have an email they would remember, so they sign in with the
 * phone number their company registered plus a six-digit access code. The QR
 * on the driver card carries a link into this screen with the code prefilled,
 * leaving the phone number as the part the driver still supplies.
 */
class DriverAccessController extends Controller
{
    /** Attempts allowed per phone+IP before the pair is locked out. */
    private const MAX_ATTEMPTS = 5;
    private const DECAY_SECONDS = 60;

    public function show(Request $request): Response
    {
        return Inertia::render('Distribution/DriverAccess', [
            // Prefilled by the QR link; the phone number is still required, so
            // a scanned code on its own is not enough to sign in.
            'prefilled_code' => (string) $request->query('c', ''),
        ]);
    }

    public function login(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'phone' => ['required', 'string', 'max:40'],
            'access_code' => ['required', 'string', 'digits:6'],
        ]);

        $key = $this->throttleKey($request, $validated['phone']);

        // Six digits is a small space, so the pair is rate limited rather than
        // left open to being walked through.
        if (RateLimiter::tooManyAttempts($key, self::MAX_ATTEMPTS)) {
            throw ValidationException::withMessages([
                'access_code' => __('Too many attempts. Try again in :seconds seconds.', [
                    'seconds' => RateLimiter::availableIn($key),
                ]),
            ]);
        }

        $driver = Driver::with('user')
            ->where('phone', $validated['phone'])
            ->where('access_code', $validated['access_code'])
            ->where('status', Driver::STATUS_ACTIVE)
            ->first();

        if (!$driver || !$driver->user) {
            RateLimiter::hit($key, self::DECAY_SECONDS);

            throw ValidationException::withMessages([
                'access_code' => __('Wrong phone number or access code.'),
            ]);
        }

        RateLimiter::clear($key);

        Auth::login($driver->user, true);
        $request->session()->regenerate();

        return redirect()->route('distribution.driver.home');
    }

    public function logout(Request $request): RedirectResponse
    {
        Auth::logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return redirect()->route('distribution.driver.access');
    }

    private function throttleKey(Request $request, string $phone): string
    {
        return 'driver-access:'.Str::lower($phone).'|'.$request->ip();
    }
}
