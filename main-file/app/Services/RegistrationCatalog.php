<?php

namespace App\Services;

use App\Events\DefaultData;
use App\Events\GivePermissionToRole;
use App\Models\UserActiveModule;
use Spatie\Permission\Models\Role;

/**
 * Turns config/registration_modules.php into the payload the registration
 * picker renders, and resolves a submitted selection back into the modules
 * that get written to `user_active_modules`.
 */
class RegistrationCatalog
{
    /**
     * Cards for the picker, base card first.
     *
     * @return array<int, array<string, mixed>>
     */
    public function cards(): array
    {
        return array_values(config('registration_modules.cards', []));
    }

    public function currency(): string
    {
        return config('registration_modules.currency', 'DA');
    }

    public function trialDays(): int
    {
        return (int) config('registration_modules.trial_days', 0);
    }

    /**
     * Card keys that are always active and cannot be deselected.
     *
     * @return array<int, string>
     */
    public function baseKeys(): array
    {
        return array_values(array_map(
            fn (array $card) => $card['key'],
            array_filter($this->cards(), fn (array $card) => $card['base'] ?? false)
        ));
    }

    /**
     * @return array<int, string>
     */
    public function selectableKeys(): array
    {
        return array_values(array_map(fn (array $card) => $card['key'], $this->cards()));
    }

    public function card(string $key): ?array
    {
        foreach ($this->cards() as $card) {
            if ($card['key'] === $key) {
                return $card;
            }
        }

        return null;
    }

    /**
     * Normalise a submitted selection: base cards are forced on, unknown keys
     * dropped, and at most one card kept per mutually exclusive group.
     *
     * @param  array<int, string>  $keys
     * @return array<int, string>
     */
    public function normalizeSelection(array $keys): array
    {
        $selected = array_values(array_unique(array_merge($this->baseKeys(), $keys)));
        $seenGroups = [];
        $result = [];

        foreach ($this->cards() as $card) {
            if (!in_array($card['key'], $selected, true)) {
                continue;
            }

            $group = $card['group'] ?? null;

            if ($group !== null) {
                if (isset($seenGroups[$group])) {
                    continue;
                }
                $seenGroups[$group] = true;
            }

            $result[] = $card['key'];
        }

        return $result;
    }

    /**
     * Package names activated by a normalised selection.
     *
     * @param  array<int, string>  $keys
     * @return array<int, string>
     */
    public function modulesFor(array $keys): array
    {
        $modules = [];

        foreach ($keys as $key) {
            $card = $this->card($key);

            if ($card) {
                $modules = array_merge($modules, $card['modules'] ?? []);
            }
        }

        return array_values(array_unique($modules));
    }

    /**
     * The driver cap for a selection. Null means unlimited; 0 means the
     * company did not take a Distribution tier at all.
     *
     * @param  array<int, string>  $keys
     */
    public function driverLimitFor(array $keys): ?int
    {
        $hasFleet = false;

        foreach ($keys as $key) {
            $card = $this->card($key);

            if (!$card || !in_array('FleetTracking', $card['modules'] ?? [], true)) {
                continue;
            }

            $hasFleet = true;

            if (($card['driver_limit'] ?? null) === null) {
                return null; // unlimited tier wins
            }
        }

        if (!$hasFleet) {
            return 0;
        }

        $limits = [];

        foreach ($keys as $key) {
            $card = $this->card($key);

            if ($card && in_array('FleetTracking', $card['modules'] ?? [], true)) {
                $limits[] = (int) $card['driver_limit'];
            }
        }

        return $limits ? max($limits) : 0;
    }

    /**
     * @param  array<int, string>  $keys
     * @return array{monthly: int, yearly: int}
     */
    public function totalsFor(array $keys): array
    {
        $monthly = 0;
        $yearly = 0;

        foreach ($keys as $key) {
            $card = $this->card($key);

            if ($card) {
                $monthly += (int) $card['monthly_price'];
                $yearly += (int) $card['yearly_price'];
            }
        }

        return ['monthly' => $monthly, 'yearly' => $yearly];
    }

    /**
     * Persist the selection for a freshly created company.
     *
     * Writing `user_active_modules` alone is not enough: a module's menu
     * entries are hidden unless the matching permissions exist and are granted
     * to the company's roles. Each package listens for DefaultData and
     * GivePermissionToRole to seed its own defaults and permissions, so both
     * events have to fire - otherwise the user logs in to an empty sidebar.
     *
     * @param  array<int, string>  $keys
     */
    public function activateFor(int $userId, array $keys): void
    {
        $modules = $this->modulesFor($keys);

        foreach ($modules as $module) {
            UserActiveModule::firstOrCreate([
                'user_id' => $userId,
                'module' => $module,
            ]);
        }

        if (!$modules) {
            return;
        }

        $moduleList = implode(',', $modules);

        DefaultData::dispatch($userId, $moduleList);

        foreach (['company', 'staff', 'client'] as $roleName) {
            $role = Role::where('name', $roleName)->where('created_by', $userId)->first();

            if ($role) {
                GivePermissionToRole::dispatch($role->id, $roleName, $moduleList);
            }
        }
    }

    /**
     * A short, unambiguous code drivers type at /livreur/register.
     * Excludes characters that are easy to confuse when read aloud.
     */
    public function generateJoinCode(): string
    {
        $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

        do {
            $code = '';

            for ($i = 0; $i < 8; $i++) {
                $code .= $alphabet[random_int(0, strlen($alphabet) - 1)];
            }
        } while (\App\Models\User::withoutGlobalScopes()->where('fleet_join_code', $code)->exists());

        return $code;
    }
}
