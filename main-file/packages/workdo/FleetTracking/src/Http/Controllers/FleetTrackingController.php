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

        return Inertia::render('FleetTracking/Index', [
            ...$this->fleetService->dashboard(creatorId()),
            'drivers' => $this->drivers(),
            'sources' => $this->sources(),
        ]);
    }

    public function settings()
    {
        if (!Auth::user()->can('manage-fleet-tracking') && !Auth::user()->can('manage-vehicles')) {
            return back()->with('error', __('Permission denied'));
        }

        return Inertia::render('FleetTracking/Settings', [
            ...$this->fleetService->dashboard(creatorId()),
            'drivers' => $this->drivers(),
            'device_endpoint' => route('fleet-tracking.device-pings.store', [], false),
        ]);
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
            'airtag_reference' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:2000'],
        ]);

        $this->fleetService->updateVehicle($vehicle, $validated);

        return back()->with('success', __('Vehicle updated successfully.'));
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

    private function sources(): array
    {
        return [
            ['value' => FleetTrackingService::MOBILE_SOURCE, 'label' => __('Mobile GPS')],
            ['value' => FleetTrackingService::DEVICE_SOURCE, 'label' => __('GPS Device')],
            ['value' => FleetTrackingService::MANUAL_SOURCE, 'label' => __('Manual')],
            ['value' => FleetTrackingService::AIRTAG_SOURCE, 'label' => __('AirTag Reference')],
        ];
    }
}
