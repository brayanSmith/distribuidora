import type { Dispatch, SetStateAction } from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

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
 *
 * The stored value is only read after mount (in an effect), never during
 * render: storage isn't available during SSR, so reading it synchronously
 * would make the very first client render disagree with the server-rendered
 * HTML and trigger a hydration mismatch (React then discards and
 * regenerates the subtree, which is where the UI can get stuck looking
 * unresponsive until something else forces a clean re-render).
 */
export function usePersistedState<T>(
    key: string | null,
    initial: T | (() => T),
    { scope = 'local', merge }: Options<T> = {},
): [T, Dispatch<SetStateAction<T>>] {
    const [value, setValue] = useState<T>(() =>
        typeof initial === 'function' ? (initial as () => T)() : initial,
    );
    // The write effect below mustn't persist this initial value before the
    // read effect has had a chance to replace it with what's stored.
    const skipNextWrite = useRef(true);

    useEffect(() => {
        if (key === null) {
            return;
        }

        try {
            const raw = storageFor(scope)?.getItem(PREFIX + key);

            if (raw === null || raw === undefined) {
                return;
            }

            const stored = JSON.parse(raw) as T;

            setValue((current) => (merge ? merge(stored, current) : stored));
        } catch {
            // Anything missing, malformed or blocked falls back to the initial value.
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [key, scope]);

    useEffect(() => {
        if (key === null) {
            return;
        }

        if (skipNextWrite.current) {
            skipNextWrite.current = false;

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
