<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rules;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;
use Spatie\Permission\Models\Role;

/**
 * Separate entry point for livreurs (drivers).
 *
 * Drivers do not belong to the company back office - they land straight on
 * the mobile tracking screen. Registration is gated by the company's fleet
 * join code so nobody can enrol themselves into someone else's fleet.
 */
class DriverAuthController extends Controller
{
    public function showLogin(): Response
    {
        return Inertia::render('auth/driver/login');
    }

    public function login(Request $request): RedirectResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'string', 'email'],
            'password' => ['required', 'string'],
        ]);

        if (!Auth::attempt($credentials, $request->boolean('remember'))) {
            throw ValidationException::withMessages([
                'email' => __('auth.failed'),
            ]);
        }

        $user = Auth::user();

        if (!$this->isDriver($user)) {
            Auth::logout();
            $request->session()->invalidate();
            $request->session()->regenerateToken();

            throw ValidationException::withMessages([
                'email' => __('This account is not a livreur account. Use the main login instead.'),
            ]);
        }

        $request->session()->regenerate();

        return redirect()->intended(route('fleet-tracking.mobile'));
    }

    public function showRegister(): Response
    {
        return Inertia::render('auth/driver/register');
    }

    public function register(Request $request): RedirectResponse
    {
        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'email' => ['required', 'string', 'lowercase', 'email', 'max:255', 'unique:'.User::class],
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'join_code' => ['required', 'string', 'max:12'],
        ]);

        $company = User::withoutGlobalScopes()
            ->where('type', 'company')
            ->where('fleet_join_code', strtoupper(trim($validated['join_code'])))
            ->first();

        if (!$company) {
            throw ValidationException::withMessages([
                'join_code' => __('Unknown company code. Ask your manager for the fleet join code.'),
            ]);
        }

        $limit = $company->fleet_driver_limit;

        if ($limit !== null && $limit <= 0) {
            throw ValidationException::withMessages([
                'join_code' => __('This company has no Distribution subscription.'),
            ]);
        }

        if ($limit !== null && $this->driverCount($company->id) >= $limit) {
            throw ValidationException::withMessages([
                'join_code' => __('This company has reached its livreur limit.'),
            ]);
        }

        $driver = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'type' => 'staff',
            'lang' => $company->lang ?? 'ar',
            'email_verified_at' => now(),
            'created_by' => $company->id,
            'creator_id' => $company->id,
        ]);

        $staffRole = Role::where('name', 'staff')->where('created_by', $company->id)->first();

        if ($staffRole) {
            $driver->assignRole($staffRole);
        }

        Auth::login($driver);
        $request->session()->regenerate();

        return redirect()->route('fleet-tracking.mobile');
    }

    private function isDriver(?User $user): bool
    {
        return $user !== null
            && $user->type === 'staff'
            && $user->can('track-own-location');
    }

    private function driverCount(int $companyId): int
    {
        return User::withoutGlobalScopes()
            ->where('created_by', $companyId)
            ->where('type', 'staff')
            ->count();
    }
}
