<?php

namespace App\Http\Controllers\Auth;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Services\RegistrationCatalog;
use Illuminate\Auth\Events\Registered;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Validation\Rule;
use Illuminate\Validation\Rules;
use Inertia\Inertia;
use Inertia\Response;
use App\Models\EmailTemplate;

class RegisteredUserController extends Controller
{
    /**
     * Display the registration view.
     */
    public function create(): Response|RedirectResponse
    {
        // Check if registration is enabled
        $enableRegistration = admin_setting('enableRegistration');

        if ($enableRegistration !== 'on') {
            return redirect()->route('login');
        }

        $catalog = new RegistrationCatalog();

        return Inertia::render('auth/register', [
            'moduleCards' => $catalog->cards(),
            'currency' => $catalog->currency(),
            'trialDays' => $catalog->trialDays(),
        ]);
    }

    /**
     * Handle an incoming registration request.
     *
     * @throws \Illuminate\Validation\ValidationException
     */
    public function store(Request $request): RedirectResponse
    {
        // Check if registration is enabled
        $enableRegistration = admin_setting('enableRegistration');

        if ($enableRegistration !== 'on') {
            return redirect()->route('login');
        }

        $catalog = new RegistrationCatalog();

        $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|string|lowercase|email|max:255|unique:'.User::class,
            'password' => ['required', 'confirmed', Rules\Password::defaults()],
            'modules' => ['nullable', 'array'],
            'modules.*' => ['string', Rule::in($catalog->selectableKeys())],
        ]);

        $selection = $catalog->normalizeSelection($request->input('modules', []));

        try {
            $enableEmailVerification = admin_setting('enableEmailVerification');

            $adminUser = User::where('type', 'superadmin')->first();

            $user = User::create([
                'name' => $request->name,
                'email' => $request->email,
                'password' => Hash::make($request->password),
                'email_verified_at' => $enableEmailVerification === 'on' ? null : now(),
                'type' => 'company',
                'lang' => admin_setting('defaultLanguage') ?? 'en',
                'created_by' => $adminUser ? $adminUser->id : null,
                'fleet_join_code' => $catalog->generateJoinCode(),
                'fleet_driver_limit' => $catalog->driverLimitFor($selection),
            ]);

            User::CompanySetting($user->id);
            User::MakeRole($user->id);
            $user->assignRole($user->type);

            $catalog->activateFor($user->id, $selection);

            Auth::login($user);

             // Send welcome email
            if(admin_setting('New User') == 'on') {
                $emailData = [
                    'name' => $user->name,
                    'email' => $user->email,
                    'password' => $request->password,
                ];

                EmailTemplate::sendEmailTemplate('New User', [$user->email], $emailData, $adminUser->id);
            }

            if ($enableEmailVerification === 'on') {
                // Apply dynamic mail configuration
                SetConfigEmail($adminUser->id);
                $user->sendEmailVerificationNotification();
                return redirect(route('verification.notice'))->with('status', 'verification-link-sent');
            }

            return redirect(route('dashboard', absolute: false));

        } catch (\Exception $e) {
            return back()->withErrors(['error' => 'Registration failed. Please try again.']);
        }
    }
}
