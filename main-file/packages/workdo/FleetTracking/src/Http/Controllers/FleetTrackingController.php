<?php

namespace Workdo\FleetTracking\Http\Controllers;

use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\Rule;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Workdo\FleetTracking\Models\Vehicle;
use Workdo\FleetTracking\Models\VehicleAssignment;
use Workdo\FleetTracking\Services\FleetTrackingService;

class FleetTrackingController extends Controller
{
    public function __construct(private FleetTrackingService $fleetService)
    {
    }

    public function index()
    {
        if (!Auth::user()->can('view-fleet-map') && !Auth::user()->can('manage-fleet-tracking')) {
            return back()->with('error', __('Permission denied'));
        }

        // Only vehicles and summary are read by the page, and the map polls this
        // route on an interval - anything extra here is re-queried every tick.
        return Inertia::render('FleetTracking/Index', $this->fleetService->dashboard(creatorId()));
    }

    /**
     * The vehicle registry - the day-to-day page.
     *
     * Split from `settings()` because the two are visited at very different
     * rates: vehicles and assignments change constantly, while the intake
     * endpoints are configured once. Keeping them together buried the registry
     * under setup panels nobody reads twice.
     */
    public function vehicles()
    {
        if (!Auth::user()->can('manage-fleet-tracking') && !Auth::user()->can('manage-vehicles')) {
            return back()->with('error', __('Permission denied'));
        }

        return Inertia::render('FleetTracking/Vehicles/Index', [
            ...$this->fleetService->dashboard(creatorId()),
            'drivers' => $this->drivers(),
            'can' => $this->fleetAbilities(),
        ]);
    }

    /** Intake configuration only: the device endpoint and Traccar forwarding. */
    public function settings()
    {
        if (!Auth::user()->can('manage-fleet-tracking') && !Auth::user()->can('manage-vehicles')) {
            return back()->with('error', __('Permission denied'));
        }

        return Inertia::render('FleetTracking/Settings', [
            'device_endpoint' => route('fleet-tracking.device-pings.store'),
            // Only shown to users who may manage the fleet - the secret lets
            // anyone holding it write positions for this company's vehicles.
            'traccar' => Auth::user()->can('manage-fleet-tracking') ? [
                'endpoint' => route('fleet-tracking.traccar.positions'),
                'secret' => $this->fleetService->traccarSecret(creatorId()),
            ] : null,
            'can' => $this->fleetAbilities(),
        ]);
    }

    private function fleetAbilities(): array
    {
        return [
            'manage_vehicles' => Auth::user()->can('manage-vehicles'),
            'manage_fleet' => Auth::user()->can('manage-fleet-tracking'),
        ];
    }

    public function storeVehicle(Request $request)
    {
        if (!Auth::user()->can('manage-vehicles')) {
            return back()->with('error', __('Permission denied'));
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'plate_number' => [
                'required',
                'string',
                'max:80',
                Rule::unique('vehicles', 'plate_number')->where('created_by', creatorId()),
            ],
            'vehicle_type' => ['required', 'string', 'max:80'],
            'status' => ['required', 'in:active,maintenance,inactive'],
            'gps_device_token' => ['nullable', 'string', 'max:255', 'unique:vehicles,gps_device_token'],
            'gps_device_name' => ['nullable', 'string', 'max:255'],
            // Traccar's own device id - the IMEI for most hardware trackers.
            'traccar_unique_id' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('vehicles', 'traccar_unique_id'),
            ],
            'airtag_reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->fleetService->createVehicle($validated, creatorId(), Auth::id());

        return back()->with('success', __('Vehicle created successfully.'));
    }

    public function updateVehicle(Request $request, Vehicle $vehicle)
    {
        if (!Auth::user()->can('manage-vehicles')) {
            return back()->with('error', __('Permission denied'));
        }
        if ($vehicle->created_by !== creatorId()) {
            return redirect()->route('fleet-tracking.settings')->with('error', __('Permission denied'));
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:255'],
            'plate_number' => [
                'required',
                'string',
                'max:80',
                Rule::unique('vehicles', 'plate_number')
                    ->where('created_by', creatorId())
                    ->ignore($vehicle->id),
            ],
            'vehicle_type' => ['required', 'string', 'max:80'],
            'status' => ['required', 'in:active,maintenance,inactive'],
            'gps_device_token' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('vehicles', 'gps_device_token')->ignore($vehicle->id),
            ],
            'gps_device_name' => ['nullable', 'string', 'max:255'],
            'traccar_unique_id' => [
                'nullable',
                'string',
                'max:255',
                Rule::unique('vehicles', 'traccar_unique_id')->ignore($vehicle->id),
            ],
            'airtag_reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->fleetService->updateVehicle($vehicle, $validated);

        return back()->with('success', __('Vehicle updated successfully.'));
    }

    public function destroyVehicle(Vehicle $vehicle)
    {
        if (!Auth::user()->can('manage-vehicles')) {
            return back()->with('error', __('Permission denied'));
        }
        if ($vehicle->created_by !== creatorId()) {
            return redirect()->route('fleet-tracking.settings')->with('error', __('Permission denied'));
        }

        try {
            $this->fleetService->deleteVehicle($vehicle);
        } catch (ValidationException $exception) {
            // Row actions have no form to render 422s into — flash is the visible channel.
            return back()->with('error', collect($exception->errors())->flatten()->first());
        }

        return back()->with('success', __('Vehicle deleted successfully.'));
    }

    public function endAssignment(VehicleAssignment $assignment)
    {
        if (!Auth::user()->can('manage-fleet-tracking') && !Auth::user()->can('manage-vehicles')) {
            return back()->with('error', __('Permission denied'));
        }
        if ($assignment->created_by !== creatorId()) {
            return redirect()->route('fleet-tracking.settings')->with('error', __('Permission denied'));
        }

        $this->fleetService->endAssignment($assignment);

        return back()->with('success', __('Assignment ended successfully.'));
    }

    public function storeAssignment(Request $request)
    {
        if (!Auth::user()->can('manage-fleet-tracking') && !Auth::user()->can('manage-vehicles')) {
            return back()->with('error', __('Permission denied'));
        }

        $validated = $request->validate([
            'vehicle_id' => [
                'required',
                'integer',
                Rule::exists('vehicles', 'id')->where('created_by', creatorId()),
            ],
            'driver_id' => [
                'required',
                'integer',
                Rule::exists('users', 'id')->where('created_by', creatorId()),
            ],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after_or_equal:starts_at'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->fleetService->createAssignment($validated, creatorId(), Auth::id());

        return back()->with('success', __('Vehicle assignment saved successfully.'));
    }

    public function showVehicle(Vehicle $vehicle)
    {
        if (!Auth::user()->can('view-fleet-map') && !Auth::user()->can('manage-fleet-tracking')) {
            return back()->with('error', __('Permission denied'));
        }
        if ($vehicle->created_by !== creatorId()) {
            return redirect()->route('fleet-tracking.index')->with('error', __('Permission denied'));
        }

        return Inertia::render('FleetTracking/Vehicles/Show', [
            ...$this->fleetService->vehicleDetail($vehicle),
        ]);
    }

    public function showDriver(User $driver)
    {
        $isOwnDriverPage = $driver->id === Auth::id() && Auth::user()->can('track-own-location');
        $canViewFleet = Auth::user()->can('view-fleet-map') || Auth::user()->can('manage-fleet-tracking');

        if (!$isOwnDriverPage && !$canViewFleet) {
            return back()->with('error', __('Permission denied'));
        }

        if ($driver->created_by !== creatorId() && $driver->id !== creatorId()) {
            return redirect()->route('fleet-tracking.index')->with('error', __('Permission denied'));
        }

        return Inertia::render('FleetTracking/Drivers/Show', [
            ...$this->fleetService->driverDetail($driver, creatorId()),
        ]);
    }

    public function mobile()
    {
        if (!Auth::user()->can('track-own-location')) {
            return back()->with('error', __('Permission denied'));
        }

        return Inertia::render('FleetTracking/Mobile/Track', $this->fleetService->mobileState(Auth::user(), creatorId()));
    }

    public function startSession(Request $request)
    {
        if (!Auth::user()->can('track-own-location')) {
            abort(403, __('Permission denied'));
        }

        $validated = $request->validate([
            'vehicle_id' => ['nullable', 'integer'],
        ]);

        $session = $this->fleetService->startSession(Auth::user(), creatorId(), $validated['vehicle_id'] ?? null);

        return response()->json([
            'success' => true,
            'session' => $this->fleetService->sessionPayload($session->load('vehicle')),
        ]);
    }

    public function stopSession()
    {
        if (!Auth::user()->can('track-own-location')) {
            abort(403, __('Permission denied'));
        }

        $session = $this->fleetService->stopSession(Auth::user(), creatorId());

        return response()->json([
            'success' => true,
            'session' => $session ? $this->fleetService->sessionPayload($session) : null,
        ]);
    }

    public function storePing(Request $request)
    {
        if (!Auth::user()->can('track-own-location')) {
            abort(403, __('Permission denied'));
        }

        $validated = $this->validatePing($request);
        $ping = $this->fleetService->recordMobilePing(Auth::user(), creatorId(), $validated);

        return response()->json([
            'success' => true,
            'ping' => $this->fleetService->pingPayload($ping),
        ]);
    }

    public function devicePing(Request $request)
    {
        $validated = [
            ...$this->validatePing($request),
            ...$request->validate([
                'device_token' => ['required', 'string', 'max:255'],
            ]),
        ];

        try {
            $ping = $this->fleetService->recordDevicePing($validated);
        } catch (ValidationException $exception) {
            throw $exception;
        }

        return response()->json([
            'success' => true,
            'ping' => $this->fleetService->pingPayload($ping),
        ]);
    }

    /**
     * Receives positions forwarded by a Traccar server.
     *
     * Unauthenticated by session - Traccar posts server-to-server - so the
     * request carries a per-company secret in the `X-Traccar-Secret` header,
     * set through Traccar's `forward.header` option.
     *
     * The vehicle is resolved first, because its company determines which
     * secret the request has to match; a token that is valid for one tenant
     * must not be able to move another tenant's vehicles.
     */
    public function traccarPosition(Request $request)
    {
        $payload = $request->all();

        try {
            $vehicle = $this->fleetService->vehicleForTraccarPayload($payload);
        } catch (ValidationException $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 422);
        }

        $expected = $this->fleetService->traccarSecret((int) $vehicle->created_by);
        $presented = (string) $request->header('X-Traccar-Secret', '');

        // hash_equals keeps the comparison constant-time; a plain === leaks the
        // secret one character at a time to anyone who can time the response.
        if ($presented === '' || !hash_equals($expected, $presented)) {
            return response()->json(['success' => false, 'message' => __('Invalid Traccar secret.')], 401);
        }

        try {
            $ping = $this->fleetService->recordTraccarPosition($payload);
        } catch (ValidationException $exception) {
            return response()->json(['success' => false, 'message' => $exception->getMessage()], 422);
        }

        return response()->json([
            'success' => true,
            'ping' => $this->fleetService->pingPayload($ping),
        ]);
    }

    private function validatePing(Request $request): array
    {
        return $request->validate([
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'accuracy' => ['nullable', 'numeric', 'min:0', 'max:99999'],
            'speed' => ['nullable', 'numeric', 'min:0', 'max:99999'],
            'heading' => ['nullable', 'numeric', 'min:0', 'max:360'],
            'battery' => ['nullable', 'integer', 'min:0', 'max:100'],
            'recorded_at' => ['nullable', 'date'],
        ]);
    }

    private function drivers()
    {
        return User::where('created_by', creatorId())
            ->whereNotIn('type', ['client', 'vendor'])
            ->orderBy('name')
            ->get(['id', 'name', 'email', 'mobile_no', 'type']);
    }

}
