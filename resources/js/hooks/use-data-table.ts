import type {
    DragEvent as ReactDragEvent,
    MouseEvent as ReactMouseEvent,
    ReactNode,
} from 'react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { DateRangeValue } from '@/components/date-range-filter';
import {
    mergeColumnOrder,
    mergeColumnWidths,
    usePersistedSet,
    usePersistedState,
} from '@/hooks/use-persisted-state';

export type DataTableFilterVariant = 'text' | 'select' | 'date' | 'none';

export type DataTableSelectOption = {
    value: string;
    label: string;
};

export type DataTableColumn<T> = {
    /** Unique, stable column identifier (also used as the sort/filter key). */
    key: string;
    label: string;
    align?: 'right';
    /** Defaults to true, except when `filter` is `'none'`. */
    sortable?: boolean;
    /** Defaults to `'text'`. */
    filter?: DataTableFilterVariant;
    /** Required when `filter` is `'select'`. */
    selectOptions?: DataTableSelectOption[];
    /** Wraps long text onto several lines, following the column's width, instead of cutting it. */
    wrap?: boolean;
    /** Whether this column can be hidden via the "Columns" menu. Defaults to true, except when `filter` is `'none'`. */
    hideable?: boolean;
    /** Initial column width in pixels. */
    width?: number;
    /** Used for sorting, filtering and (by default) searching. Omit for columns that are purely presentational. */
    getValue?: (row: T) => string | number;
    render: (row: T) => ReactNode;
    /** Cell of the summary row, computed over the rows that pass the current filters. */
    footer?: (rows: T[]) => ReactNode;
};

/** One line of a page: a data row, or (when grouping) a group's or sub-group's header. */
export type DataTableEntry<T> =
    | { kind: 'row'; row: T }
    | { kind: 'group'; group: string; collapsed: boolean }
    | {
          kind: 'subgroup';
          group: string;
          parentGroup: string;
          collapsed: boolean;
      };

export type SortDirection = 'asc' | 'desc';

export type DataTableSort = {
    key: string;
    direction: SortDirection;
};

export type HeaderCellHandlers = {
    onResizeStart: (event: ReactMouseEvent) => void;
    onDragStart: (event: ReactDragEvent) => void;
    onDragOver: (event: ReactDragEvent) => void;
    onDrop: (event: ReactDragEvent) => void;
    onDragEnd: () => void;
    isDragging: boolean;
    isDragOver: boolean;
    cellRef: (element: HTMLTableCellElement | null) => void;
};

/** One collator for every comparison: `localeCompare` with options builds a new one each time. */
const SORT_COLLATOR = new Intl.Collator('es', { sensitivity: 'base' });

/** Groups in natural order ('R9' before 'R15'). */
const GROUP_COLLATOR = new Intl.Collator('es', {
    sensitivity: 'base',
    numeric: true,
});

/** A character that can't appear in a group value, so group/sub-group pairs never collide. */
const SUBGROUP_SEPARATOR = '\u0000';
const subgroupKey = (group: string, subgroup: string): string =>
    `${group}${SUBGROUP_SEPARATOR}${subgroup}`;

const MIN_COLUMN_WIDTH = 60;
const DEFAULT_COLUMN_WIDTH = 160;
/** Fits two icon buttons (edit / delete); a column with more passes its own `width`. */
const ACTIONS_COLUMN_WIDTH = 112;
const DEFAULT_PAGE_SIZE = 25;

export type UseDataTableOptions<T> = {
    data: T[];
    columns: DataTableColumn<T>[];
    pageSize?: number;
    /**
     * Lets the user change how many rows a page shows (offered by
     * `DataTable`, and remembered in the browser). `pageSize` is the default.
     */
    pageSizeOptions?: number[];
    /** Set to false to show every row without paging. Defaults to true. */
    paginate?: boolean;
    /** Overrides the default (all columns with `getValue`, joined) search text builder. */
    searchableText?: (row: T) => string;
    /**
     * Groups the rows: they are kept together by this key (groups in
     * natural order, the chosen sort inside each one) and `DataTable` shows
     * a collapsible header per group.
     */
    groupBy?: (row: T) => string;
    /**
     * Splits each group from `groupBy` into sub-groups by this key, each
     * with its own nested collapsible header. Ignored without `groupBy`.
     */
    groupBySecondary?: (row: T) => string;
    /** Goes back to the first page whenever this changes (e.g. an outside filter on `data`). */
    pageResetKey?: string;
    /**
     * Remembers the table's layout (widths, order, hidden columns) in the
     * browser and its search, sort and filters for the tab's session, so
     * leaving the page and coming back finds it as it was.
     */
    storageKey?: string;
};

function normalizeColumn<T>(
    column: DataTableColumn<T>,
): Required<
    Pick<DataTableColumn<T>, 'sortable' | 'filter' | 'hideable' | 'width'>
> &
    DataTableColumn<T> {
    const filter = column.filter ?? 'text';

    return {
        ...column,
        filter,
        sortable: column.sortable ?? filter !== 'none',
        hideable: column.hideable ?? filter !== 'none',
        width:
            column.width ??
            (column.key === 'acciones'
                ? ACTIONS_COLUMN_WIDTH
                : DEFAULT_COLUMN_WIDTH),
    };
}

/**
 * Encapsulates the full "advanced table" behavior shared across the app's
 * index pages: search, per-column sort/filter, resizable + draggable
 * (with FLIP animation) columns, show/hide columns, and client-side
 * pagination. Pair with the `DataTable` component, or consume directly for
 * a fully custom layout.
 */
export function useDataTable<T>({
    data,
    columns,
    pageSize: defaultPageSize = DEFAULT_PAGE_SIZE,
    pageSizeOptions,
    paginate = true,
    searchableText,
    pageResetKey,
    storageKey,
    groupBy,
    groupBySecondary,
}: UseDataTableOptions<T>) {
    const persistKey = (name: string) =>
        storageKey ? `table:${storageKey}:${name}` : null;
    const [requestedPageSize, setPageSize] = usePersistedState<number>(
        pageSizeOptions ? persistKey('page-size') : null,
        defaultPageSize,
        {
            merge: (stored, initial) =>
                Number.isInteger(stored) && stored >= 1 ? stored : initial,
        },
    );
    const pageSize = paginate ? requestedPageSize : Number.MAX_SAFE_INTEGER;
    // The "acciones" column always leads, so a row's buttons are at its
    // start instead of scrolled off at the end of a wide table.
    const normalizedColumns = useMemo(
        () =>
            [...columns]
                .sort(
                    (a, b) =>
                        Number(b.key === 'acciones') -
                        Number(a.key === 'acciones'),
                )
                .map(normalizeColumn),
        [columns],
    );
    const columnsMap = useMemo(
        () => new Map(normalizedColumns.map((column) => [column.key, column])),
        [normalizedColumns],
    );
    const columnKeys = useMemo(
        () => normalizedColumns.map((column) => column.key),
        [normalizedColumns],
    );
    const hideableColumns = useMemo(
        () => normalizedColumns.filter((column) => column.hideable),
        [normalizedColumns],
    );

    // A saved filter of a column that is gone would hide every row unseen.
    const onlyKnownKeys = <V>(stored: Record<string, V>) =>
        Object.fromEntries(
            Object.entries(stored).filter(([key]) => columnsMap.has(key)),
        );

    const [search, setSearch] = usePersistedState(persistKey('search'), '', {
        scope: 'session',
    });
    const [sort, setSort] = usePersistedState<DataTableSort | null>(
        persistKey('sort'),
        null,
        {
            scope: 'session',
            merge: (stored) =>
                stored && columnsMap.has(stored.key) ? stored : null,
        },
    );
    const [filters, setFilters] = usePersistedState<Record<string, string>>(
        persistKey('filters'),
        {},
        { scope: 'session', merge: onlyKnownKeys },
    );
    const [dateRanges, setDateRanges] = usePersistedState<
        Record<string, DateRangeValue>
    >(persistKey('dates'), {}, { scope: 'session', merge: onlyKnownKeys });
    const [page, setPage] = useState(1);

    const [columnWidths, setColumnWidths] = usePersistedState<
        Record<string, number>
    >(
        persistKey('widths'),
        () =>
            Object.fromEntries(
                normalizedColumns.map((column) => [column.key, column.width]),
            ),
        { merge: mergeColumnWidths },
    );
    const [columnOrder, setColumnOrder] = usePersistedState<string[]>(
        persistKey('order'),
        columnKeys,
        { merge: mergeColumnOrder },
    );
    const [hiddenColumns, setHiddenColumns] = usePersistedSet<string>(
        persistKey('hidden'),
        () => new Set(),
    );

    // Keeps widths/order in sync if the column set itself changes at
    // runtime (e.g. dynamic columns). Self-healing: `visibleColumnOrder`
    // below never trusts stale keys regardless of when this effect runs.
    useEffect(() => {
        setColumnWidths((prev) => {
            const missing = columnKeys.filter((key) => !(key in prev));

            if (missing.length === 0) {
                return prev;
            }

            const next = { ...prev };
            missing.forEach((key) => {
                next[key] = columnsMap.get(key)?.width ?? DEFAULT_COLUMN_WIDTH;
            });

            return next;
        });

        setColumnOrder((prev) => {
            const sameSet =
                prev.length === columnKeys.length &&
                columnKeys.every((key) => prev.includes(key));

            return sameSet ? prev : columnKeys;
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [columnKeys]);

    const [draggedKey, setDraggedKey] = useState<string | null>(null);
    const [dragOverKey, setDragOverKey] = useState<string | null>(null);
    const resizingKeyRef = useRef<string | null>(null);
    const resizeStartXRef = useRef(0);
    const resizeStartWidthRef = useRef(0);
    const headerRefs = useRef<Map<string, HTMLTableCellElement>>(new Map());
    const pendingFlipRef = useRef<Map<string, DOMRect> | null>(null);

    const registerHeaderRef =
        (key: string) => (element: HTMLTableCellElement | null) => {
            if (element) {
                headerRefs.current.set(key, element);
            } else {
                headerRefs.current.delete(key);
            }
        };

    /**
     * FLIP animation: capture every header cell's current position before
     * the reorder commits, then slide each one from its old spot to its
     * new one instead of snapping instantly, so drag-drop reads as "this
     * column moved" rather than a hard jump.
     */
    useLayoutEffect(() => {
        const prevRects = pendingFlipRef.current;

        if (!prevRects) {
            return;
        }

        pendingFlipRef.current = null;

        headerRefs.current.forEach((element, key) => {
            const prevRect = prevRects.get(key);

            if (!prevRect) {
                return;
            }

            const newRect = element.getBoundingClientRect();
            const deltaX = prevRect.left - newRect.left;

            if (deltaX === 0) {
                return;
            }

            element.style.transition = 'none';
            element.style.transform = `translateX(${deltaX}px)`;

            void element.getBoundingClientRect();

            requestAnimationFrame(() => {
                element.style.transition = 'transform 200ms ease';
                element.style.transform = '';
            });
        });
    }, [columnOrder]);

    useEffect(() => {
        const handleMouseMove = (event: MouseEvent) => {
            const key = resizingKeyRef.current;

            if (!key) {
                return;
            }

            const delta = event.clientX - resizeStartXRef.current;

            setColumnWidths((prev) => ({
                ...prev,
                [key]: Math.max(
                    resizeStartWidthRef.current + delta,
                    MIN_COLUMN_WIDTH,
                ),
            }));
        };

        const handleMouseUp = () => {
            resizingKeyRef.current = null;
        };

        document.addEventListener('pointermove', handleMouseMove);
        document.addEventListener('pointerup', handleMouseUp);
        document.addEventListener('pointercancel', handleMouseUp);

        return () => {
            document.removeEventListener('pointermove', handleMouseMove);
            document.removeEventListener('pointerup', handleMouseUp);
            document.removeEventListener('pointercancel', handleMouseUp);
        };
    }, []);

    const startResize = (key: string) => (event: ReactMouseEvent) => {
        event.preventDefault();
        resizingKeyRef.current = key;
        resizeStartXRef.current = event.clientX;
        resizeStartWidthRef.current = columnWidths[key] ?? DEFAULT_COLUMN_WIDTH;
    };

    const handleColumnDrop = (key: string) => (event: ReactDragEvent) => {
        event.preventDefault();
        setDragOverKey(null);

        if (!draggedKey || draggedKey === key) {
            setDraggedKey(null);
            return;
        }

        const prevRects = new Map<string, DOMRect>();
        headerRefs.current.forEach((element, columnKey) => {
            prevRects.set(columnKey, element.getBoundingClientRect());
        });
        pendingFlipRef.current = prevRects;

        setColumnOrder((prev) => {
            const next = [...prev];
            const fromIndex = next.indexOf(draggedKey);
            const toIndex = next.indexOf(key);

            if (fromIndex === -1 || toIndex === -1) {
                return prev;
            }

            next.splice(fromIndex, 1);
            next.splice(toIndex, 0, draggedKey);

            return next;
        });

        setDraggedKey(null);
    };

    const getHeaderCellHandlers = (key: string): HeaderCellHandlers => ({
        onResizeStart: startResize(key),
        onDragStart: (event) => {
            setDraggedKey(key);
            event.dataTransfer.effectAllowed = 'move';
        },
        onDragOver: (event) => {
            event.preventDefault();

            if (dragOverKey !== key) {
                setDragOverKey(key);
            }
        },
        onDrop: handleColumnDrop(key),
        onDragEnd: () => {
            setDraggedKey(null);
            setDragOverKey(null);
        },
        isDragging: draggedKey === key,
        isDragOver: dragOverKey === key && draggedKey !== key,
        cellRef: registerHeaderRef(key),
    });

    const toggleColumnVisibility = (key: string) => {
        setHiddenColumns((prev) => {
            const next = new Set(prev);

            if (next.has(key)) {
                next.delete(key);
            } else {
                next.add(key);
                setFilters((filtersPrev) => {
                    const { [key]: _removed, ...rest } = filtersPrev;

                    return rest;
                });
                setDateRanges((rangesPrev) => {
                    const { [key]: _removed, ...rest } = rangesPrev;

                    return rest;
                });
            }

            return next;
        });
    };

    const visibleColumnOrder = useMemo(() => {
        const known = new Set(columnKeys);
        const merged = columnOrder.filter((key) => known.has(key));

        columnKeys.forEach((key) => {
            if (!merged.includes(key)) {
                merged.push(key);
            }
        });

        return merged.filter((key) => !hiddenColumns.has(key));
    }, [columnOrder, columnKeys, hiddenColumns]);

    const handleSort = (key: string) => {
        setSort((prev) =>
            prev?.key === key
                ? { key, direction: prev.direction === 'asc' ? 'desc' : 'asc' }
                : { key, direction: 'asc' },
        );
    };

    const setFilter = (key: string, value: string) => {
        setFilters((prev) => ({ ...prev, [key]: value }));
    };

    const setDateRange = (key: string, value: DateRangeValue) => {
        setDateRanges((prev) => ({ ...prev, [key]: value }));
    };

    const clearFilters = () => {
        setFilters({});
        setDateRanges({});
    };

    const activeFilterCount =
        Object.values(filters).filter((value) => value.trim() !== '').length +
        Object.values(dateRanges).filter((range) => range.from || range.to)
            .length;

    const getSortValue = (row: T, key: string): string | number =>
        columnsMap.get(key)?.getValue?.(row) ?? '';

    const defaultSearchableText = (row: T): string =>
        normalizedColumns
            .filter((column) => column.getValue)
            .map((column) => String(column.getValue!(row)))
            .join(' ')
            .toLowerCase();

    const getSearchText = searchableText ?? defaultSearchableText;

    const filteredSorted = useMemo(() => {
        const term = search.trim().toLowerCase();

        let list = data.filter((row) => {
            if (term && !getSearchText(row).toLowerCase().includes(term)) {
                return false;
            }

            for (const [key, value] of Object.entries(filters)) {
                if (!value.trim()) {
                    continue;
                }

                const column = columnsMap.get(key);
                const cellValue = String(getSortValue(row, key))
                    .toLowerCase()
                    .trim();

                if (column?.filter === 'select') {
                    if (cellValue !== value.toLowerCase().trim()) {
                        return false;
                    }
                } else if (!cellValue.includes(value.toLowerCase().trim())) {
                    return false;
                }
            }

            for (const [key, range] of Object.entries(dateRanges)) {
                if (!range.from && !range.to) {
                    continue;
                }

                const raw = getSortValue(row, key);
                const time = raw ? new Date(raw).getTime() : NaN;

                if (Number.isNaN(time)) {
                    return false;
                }

                if (
                    range.from &&
                    time < new Date(`${range.from}T00:00:00`).getTime()
                ) {
                    return false;
                }

                if (
                    range.to &&
                    time > new Date(`${range.to}T23:59:59.999`).getTime()
                ) {
                    return false;
                }
            }

            return true;
        });

        if (sort) {
            // The sort value of each row is read once, not on every comparison.
            list = list
                .map((row) => ({ row, value: getSortValue(row, sort.key) }))
                .sort((a, b) => {
                    const comparison =
                        typeof a.value === 'number' &&
                        typeof b.value === 'number'
                            ? a.value - b.value
                            : SORT_COLLATOR.compare(
                                  String(a.value),
                                  String(b.value),
                              );

                    return sort.direction === 'asc' ? comparison : -comparison;
                })
                .map(({ row }) => row);
        }

        if (groupBy) {
            // Array.prototype.sort is stable: the sort above survives inside each (sub)group.
            list = list
                .map((row) => ({
                    row,
                    group: groupBy(row),
                    subgroup: groupBySecondary ? groupBySecondary(row) : '',
                }))
                .sort((a, b) => {
                    const comparison = GROUP_COLLATOR.compare(a.group, b.group);

                    return comparison !== 0
                        ? comparison
                        : GROUP_COLLATOR.compare(a.subgroup, b.subgroup);
                })
                .map(({ row }) => row);
        }

        return list;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [
        data,
        search,
        filters,
        dateRanges,
        sort,
        columnsMap,
        groupBy,
        groupBySecondary,
    ]);

    // How many of the filtered rows each group has (not only those of this page).
    const groupCounts = useMemo(() => {
        const counts = new Map<string, number>();

        if (groupBy) {
            filteredSorted.forEach((row) => {
                const group = groupBy(row);

                counts.set(group, (counts.get(group) ?? 0) + 1);
            });
        }

        return counts;
    }, [filteredSorted, groupBy]);

    // Same, one level down: how many rows each sub-group has within its group.
    const subgroupCounts = useMemo(() => {
        const counts = new Map<string, Map<string, number>>();

        if (groupBy && groupBySecondary) {
            filteredSorted.forEach((row) => {
                const group = groupBy(row);
                const subgroup = groupBySecondary(row);
                const inner = counts.get(group) ?? new Map<string, number>();

                inner.set(subgroup, (inner.get(subgroup) ?? 0) + 1);
                counts.set(group, inner);
            });
        }

        return counts;
    }, [filteredSorted, groupBy, groupBySecondary]);

    const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(
        new Set(),
    );

    // The rows of a collapsed (sub)group are not paged: the page fills up
    // with the rows that follow, so nobody has to flip pages to get past one.
    const pagedRows = useMemo(() => {
        if (!groupBy) {
            return filteredSorted;
        }

        return filteredSorted.filter((row) => {
            const group = groupBy(row);

            if (collapsedGroups.has(group)) {
                return false;
            }

            if (
                groupBySecondary &&
                collapsedGroups.has(subgroupKey(group, groupBySecondary(row)))
            ) {
                return false;
            }

            return true;
        });
    }, [filteredSorted, collapsedGroups, groupBy, groupBySecondary]);

    const totalPages = Math.max(Math.ceil(pagedRows.length / pageSize), 1);
    const currentPage = Math.min(page, totalPages);

    const paginatedRows = useMemo(
        () =>
            pagedRows.slice(
                (currentPage - 1) * pageSize,
                currentPage * pageSize,
            ),
        [pagedRows, currentPage, pageSize],
    );

    /**
     * What the page draws, in order: its rows and, when grouping, the group
     * and sub-group headers (also those of collapsed (sub)groups that sit
     * between its rows, and headers of a (sub)group that continues from the
     * previous page).
     */
    const entries = useMemo<DataTableEntry<T>[]>(() => {
        if (!groupBy) {
            return paginatedRows.map((row) => ({ kind: 'row', row }));
        }

        const start = (currentPage - 1) * pageSize;
        const end = start + pageSize;
        const isLastPage = currentPage === totalPages;
        const result: DataTableEntry<T>[] = [];
        const headedGroups = new Set<string>();
        const headedSubgroups = new Set<string>();
        // How many drawable rows come before the (sub)group being walked.
        let before = 0;
        let rowIndex = 0;

        groupCounts.forEach((groupTotal, group) => {
            const collapsed = collapsedGroups.has(group);
            const onPage =
                (before >= start && before < end) ||
                (before >= pagedRows.length && isLastPage);

            if (onPage) {
                result.push({ kind: 'group', group, collapsed });
                headedGroups.add(group);
            }

            if (collapsed) {
                return;
            }

            // Without a secondary grouping, the group is its own one sub-group.
            const subgroups = groupBySecondary
                ? (subgroupCounts.get(group) ?? new Map<string, number>())
                : new Map<string, number>([['', groupTotal]]);

            subgroups.forEach((subCount, subgroup) => {
                const subgroupCollapsedKey = subgroupKey(group, subgroup);
                const subCollapsed = Boolean(
                    groupBySecondary &&
                    collapsedGroups.has(subgroupCollapsedKey),
                );

                if (groupBySecondary) {
                    const subOnPage =
                        (before >= start && before < end) ||
                        (before >= pagedRows.length && isLastPage);

                    if (subOnPage) {
                        if (!headedGroups.has(group)) {
                            result.push({ kind: 'group', group, collapsed });
                            headedGroups.add(group);
                        }

                        result.push({
                            kind: 'subgroup',
                            group: subgroup,
                            parentGroup: group,
                            collapsed: subCollapsed,
                        });
                        headedSubgroups.add(subgroupCollapsedKey);
                    }
                }

                if (subCollapsed) {
                    return;
                }

                for (let i = 0; i < subCount; i++, rowIndex++) {
                    if (rowIndex < start || rowIndex >= end) {
                        continue;
                    }

                    // The group started on a previous page: head it again.
                    if (!headedGroups.has(group)) {
                        result.push({ kind: 'group', group, collapsed });
                        headedGroups.add(group);
                    }

                    if (
                        groupBySecondary &&
                        !headedSubgroups.has(subgroupCollapsedKey)
                    ) {
                        result.push({
                            kind: 'subgroup',
                            group: subgroup,
                            parentGroup: group,
                            collapsed: false,
                        });
                        headedSubgroups.add(subgroupCollapsedKey);
                    }

                    result.push({ kind: 'row', row: pagedRows[rowIndex] });
                }

                before += subCount;
            });
        });

        return result;
    }, [
        groupBy,
        groupBySecondary,
        paginatedRows,
        currentPage,
        pageSize,
        totalPages,
        groupCounts,
        subgroupCounts,
        collapsedGroups,
        pagedRows,
    ]);

    /** How many rows of a group are actually shown, given a set of collapsed (sub)groups. */
    const visibleCountOfGroup = (group: string, collapsed: Set<string>) => {
        if (collapsed.has(group)) {
            return 0;
        }

        if (!groupBySecondary) {
            return groupCounts.get(group) ?? 0;
        }

        let total = 0;

        (subgroupCounts.get(group) ?? new Map<string, number>()).forEach(
            (count, subgroup) => {
                if (!collapsed.has(subgroupKey(group, subgroup))) {
                    total += count;
                }
            },
        );

        return total;
    };

    /** Puts the page where the group's header is, so it doesn't jump out of sight. */
    const showGroup = (group: string, collapsed: Set<string>) => {
        let before = 0;

        for (const key of groupCounts.keys()) {
            if (key === group) {
                break;
            }

            before += visibleCountOfGroup(key, collapsed);
        }

        setPage(Math.floor(before / pageSize) + 1);
    };

    /** Same, for a sub-group's header. */
    const showSubgroup = (
        group: string,
        subgroup: string,
        collapsed: Set<string>,
    ) => {
        let before = 0;

        for (const key of groupCounts.keys()) {
            if (key === group) {
                break;
            }

            before += visibleCountOfGroup(key, collapsed);
        }

        if (!collapsed.has(group)) {
            for (const key of (
                subgroupCounts.get(group) ?? new Map<string, number>()
            ).keys()) {
                if (key === subgroup) {
                    break;
                }

                if (!collapsed.has(subgroupKey(group, key))) {
                    before += subgroupCounts.get(group)?.get(key) ?? 0;
                }
            }
        }

        setPage(Math.floor(before / pageSize) + 1);
    };

    const toggleGroup = (group: string) => {
        const next = new Set(collapsedGroups);

        if (!next.delete(group)) {
            next.add(group);
        }

        setCollapsedGroups(next);
        showGroup(group, next);
    };

    const toggleSubgroup = (group: string, subgroup: string) => {
        const key = subgroupKey(group, subgroup);
        const next = new Set(collapsedGroups);

        if (!next.delete(key)) {
            next.add(key);
        }

        setCollapsedGroups(next);
        showSubgroup(group, subgroup, next);
    };

    const allGroupsCollapsed =
        groupCounts.size > 0 &&
        [...groupCounts.keys()].every((group) => collapsedGroups.has(group));

    /** Collapses every group, or opens them all when they already are collapsed. */
    const toggleAllGroups = () => {
        setCollapsedGroups(
            allGroupsCollapsed ? new Set() : new Set(groupCounts.keys()),
        );
        setPage(1);
    };
    useEffect(() => {
        setPage(1);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [search, filters, dateRanges, sort, pageResetKey, requestedPageSize]);

    return {
        columns: normalizedColumns,
        hideableColumns,
        columnsMap,
        visibleColumnOrder,
        columnWidths,
        hiddenColumns,
        toggleColumnVisibility,
        getHeaderCellHandlers,
        sort,
        handleSort,
        search,
        setSearch,
        filters,
        setFilter,
        dateRanges,
        setDateRange,
        clearFilters,
        activeFilterCount,
        rows: paginatedRows,
        entries,
        totalRows: pagedRows.length,
        /** Rows that pass the search and filters, collapsed groups included. */
        matchedRows: filteredSorted.length,
        /** Rows kept out of the pages by collapsed groups. */
        hiddenRows: filteredSorted.length - pagedRows.length,
        groupCounts,
        subgroupCounts,
        collapsedGroups,
        toggleGroup,
        toggleSubgroup,
        allGroupsCollapsed,
        toggleAllGroups,
        page: currentPage,
        setPage,
        setPageSize,
        totalPages,
        pageSize,
    };
}
