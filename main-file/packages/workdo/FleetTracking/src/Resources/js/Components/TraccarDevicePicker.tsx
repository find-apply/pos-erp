import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Check, ChevronsUpDown, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import type { TraccarDevice } from '../data/traccar-devices';

/** Rendered rows per search. The full list is 2 160 devices - drawing them all
 *  janks the popover, and nobody scrolls past the first screen anyway. */
const MAX_RESULTS = 60;

/**
 * Pick a tracker from Traccar's supported-device list.
 *
 * The value stored is the model name; protocol and port are looked back up from
 * it, so nothing extra has to be persisted. Free text is still accepted - the
 * list covers what Traccar ships with, not what every reseller rebrands.
 */
export function TraccarDevicePicker({
    value,
    onChange,
    placeholder,
}: {
    value: string;
    onChange: (model: string) => void;
    placeholder?: string;
}) {
    const { t } = useTranslation();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [devices, setDevices] = useState<readonly TraccarDevice[] | null>(null);
    const searchRef = useRef<HTMLInputElement>(null);

    // ~70KB of device data, pulled only once someone opens the picker.
    useEffect(() => {
        if (!open || devices) return;

        let cancelled = false;
        import('../data/traccar-devices').then((module) => {
            if (!cancelled) setDevices(module.TRACCAR_DEVICES);
        });

        return () => {
            cancelled = true;
        };
    }, [devices, open]);

    useEffect(() => {
        if (open) setTimeout(() => searchRef.current?.focus(), 50);
    }, [open]);

    const results = useMemo(() => {
        if (!devices) return [];

        const needle = query.trim().toLowerCase();
        if (!needle) return devices.slice(0, MAX_RESULTS);

        const matches: TraccarDevice[] = [];
        for (const device of devices) {
            if (device[0].toLowerCase().includes(needle) || device[1].includes(needle)) {
                matches.push(device);
                if (matches.length >= MAX_RESULTS) break;
            }
        }

        return matches;
    }, [devices, query]);

    // Shown under the field so the port to open on the Traccar server is visible
    // without leaving the form.
    const selected = useMemo(
        () => (value && devices ? devices.find((device) => device[0] === value) : undefined),
        [devices, value]
    );

    return (
        <div>
            <div className="flex gap-2">
                <Popover open={open} onOpenChange={setOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant="outline"
                            role="combobox"
                            aria-expanded={open}
                            className="flex-1 justify-between font-normal"
                        >
                            <span className={cn('truncate', !value && 'text-muted-foreground')}>
                                {value || placeholder || t('Search a tracker model')}
                            </span>
                            <ChevronsUpDown className="ms-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                        <div className="flex items-center gap-2 border-b px-3">
                            <Search className="h-4 w-4 shrink-0 opacity-50" />
                            <Input
                                ref={searchRef}
                                value={query}
                                onChange={(event) => setQuery(event.target.value)}
                                placeholder={t('Search a tracker model')}
                                className="h-11 border-0 px-0 shadow-none focus-visible:ring-0"
                            />
                        </div>

                        <div className="max-h-[280px] overflow-y-auto py-1">
                            {!devices && (
                                <p className="px-3 py-6 text-center text-sm text-muted-foreground">{t('Loading')}…</p>
                            )}

                            {/* The list covers what Traccar ships with, not every
                                rebranded reseller unit - so an unmatched search is
                                still usable as a plain name. */}
                            {devices && results.length === 0 && (
                                <div className="px-3 py-5 text-center">
                                    <p className="text-sm text-muted-foreground">{t('No matching tracker.')}</p>
                                    {query.trim() && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            size="sm"
                                            className="mt-3"
                                            onClick={() => {
                                                onChange(query.trim());
                                                setOpen(false);
                                            }}
                                        >
                                            {t('Use')} “{query.trim()}”
                                        </Button>
                                    )}
                                </div>
                            )}

                            {results.map((device) => (
                                <button
                                    key={`${device[0]}-${device[1]}-${device[2]}`}
                                    type="button"
                                    onClick={() => {
                                        onChange(device[0]);
                                        setOpen(false);
                                    }}
                                    className="flex w-full items-center gap-2 px-3 py-2 text-start text-sm hover:bg-accent"
                                >
                                    <Check
                                        className={cn(
                                            'h-4 w-4 shrink-0',
                                            device[0] === value ? 'opacity-100' : 'opacity-0'
                                        )}
                                    />
                                    <span className="min-w-0 flex-1 truncate">{device[0]}</span>
                                    <span dir="ltr" className="shrink-0 font-mono text-xs text-muted-foreground">
                                        {device[1]}:{device[2]}
                                    </span>
                                </button>
                            ))}

                            {devices && results.length >= MAX_RESULTS && (
                                <p className="px-3 py-2 text-center text-xs text-muted-foreground">
                                    {t('More results exist. Keep typing to narrow them down.')}
                                </p>
                            )}
                        </div>
                    </PopoverContent>
                </Popover>

                {value && (
                    <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        onClick={() => onChange('')}
                        aria-label={t('Clear')}
                    >
                        <X className="h-4 w-4" />
                    </Button>
                )}
            </div>

            {selected && (
                <p className="mt-1 text-xs text-muted-foreground">
                    {t('Traccar must listen for this model on')}{' '}
                    <span dir="ltr" className="font-mono">
                        {selected[1]}:{selected[2]}
                    </span>
                </p>
            )}
        </div>
    );
}
