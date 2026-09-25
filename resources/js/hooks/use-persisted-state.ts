import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';

const PREFIX = 'ui:';

/** `local` survives closing the browser; `session` lasts while the tab is open. */
type Scope = 'local' | 'session';

type Options<T> = {
    scope?: Scope;
    /** Combines what was saved with the initial value (e.g. to drop stale keys). */
    merge?: (stored: T, initial: T) => T;
};

function storageFor(scope: Scope): Storage | null {
    try {
        return scope === 'local' ? window.localStorage : window.sessionStorage;
    } catch {
        return null;
    }
}

/**
 * `useState` that remembers its value in the browser's storage under `key`,
 * so it survives leaving the page and coming back (a table's filters, column
 * widths…). With a `null` key it is a plain `useState`. Anything missing,
 * malformed or blocked falls back to the initial value.
 */
export function usePersistedState<T>(
    key: string | null,
    initial: T | (() => T),
    { scope = 'local', merge }: Options<T> = {},
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() => {
        const start =
            typeof initial === 'function' ? (initial as () => T)() : initial;

        if (key === null) {
            return start;
        }

        try {
            const raw = storageFor(scope)?.getItem(PREFIX + key);

            if (raw === null || raw === undefined) {
                return start;
            }

            const stored = JSON.parse(raw) as T;

            return merge ? merge(stored, start) : stored;
        } catch {
            return start;
        }
    });

    useEffect(() => {
        if (key === null) {
            return;
        }

        try {
            storageFor(scope)?.setItem(PREFIX + key, JSON.stringify(value));
        } catch {
            // Storage full or unavailable: it just isn't remembered.
        }
    }, [key, scope, value]);

    return [value, setValue];
}

/** Same as `usePersistedState` for a `Set` (stored as an array). */
export function usePersistedSet<T extends string>(
    key: string | null,
    initial: () => Set<T>,
    scope: Scope = 'local',
): [Set<T>, Dispatch<SetStateAction<Set<T>>>] {
    const [items, setItems] = usePersistedState<T[]>(
        key,
        () => [...initial()],
        {
            scope,
            merge: (stored, start) => (Array.isArray(stored) ? stored : start),
        },
    );
    const set = useMemo(() => new Set(items), [items]);
    const setSet = useCallback<Dispatch<SetStateAction<Set<T>>>>(
        (update) =>
            setItems((prev) => {
                const next =
                    typeof update === 'function'
                        ? update(new Set(prev))
                        : update;

                return [...next];
            }),
        [setItems],
    );

    return [set, setSet];
}

/** Keeps a saved column order only while it holds exactly the current columns. */
export function mergeColumnOrder<K extends string>(
    stored: K[],
    initial: K[],
): K[] {
    return Array.isArray(stored) &&
        stored.length === initial.length &&
        initial.every((key) => stored.includes(key))
        ? stored
        : initial;
}

/** Widths saved for the columns that exist, over the default ones. */
export function mergeColumnWidths<W extends Record<string, number>>(
    stored: W,
    initial: W,
): W {
    return { ...initial, ...stored };
}
