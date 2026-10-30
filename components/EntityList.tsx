import {
  defaultRangeExtractor,
  type Range,
  useVirtualizer,
} from "@tanstack/react-virtual";
import { Trash2 } from "lucide-react";
import {
  type FocusEvent,
  type ReactNode,
  useCallback,
  useMemo,
  useRef,
  useState,
} from "react";
import type { StatusDefinition } from "@/utils/status-theme";
import { StatusSummary } from "./StatusSummary";

/** Initial row height guess; rows are measured once rendered. */
const ESTIMATED_ROW_HEIGHT = 36;
/** Rows rendered beyond each edge of the visible area. */
const OVERSCAN_ROWS = 10;

interface EntityListProps<T, K extends string | number> {
  readonly items: readonly T[];
  /** Must keep its identity across renders, or row keys are rebuilt. */
  readonly getId: (item: T) => K;
  readonly getStatus: (item: T) => string;
  readonly statusDefinitions: readonly StatusDefinition[];
  readonly selectedId: K | null;
  /** Must keep its identity across renders so memoized rows can skip. */
  readonly onSelect: (id: K) => void;
  /** Shows the remove-all button when set. */
  readonly onRemoveAll?: () => void;
  readonly removeAllTitle: string;
  readonly emptyLabel: string;
  /** Renders one row; the row calls `onSelect` with its item's id. */
  readonly renderItem: (
    item: T,
    isSelected: boolean,
    onSelect: (id: K) => void,
  ) => ReactNode;
}

/**
 * The visible range plus overscan, extended with the pinned indexes that fall
 * outside it. Sorted, so DOM order (and with it Tab order) follows the
 * visual order.
 */
function withPinnedIndexes(range: Range, pinned: readonly number[]): number[] {
  const indexes = new Set(defaultRangeExtractor(range));
  for (const index of pinned) {
    if (index >= 0 && index < range.count) indexes.add(index);
  }
  return Array.from(indexes).sort((a, b) => a - b);
}

/**
 * List of queries or mutations: status summary header with an optional
 * remove-all button, then the rows (or an empty-state label). Only the rows
 * in and near the visible area are mounted, plus the selected row and the
 * focused row with its neighbours, so keyboard focus and Tab order survive
 * scrolling those rows out of view.
 */
export function EntityList<T, K extends string | number>({
  items,
  getId,
  getStatus,
  statusDefinitions,
  selectedId,
  onSelect,
  onRemoveAll,
  removeAllTitle,
  emptyLabel,
  renderItem,
}: EntityListProps<T, K>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // Tracked by id rather than index, so it follows the item when the order
  // changes.
  const [focusedId, setFocusedId] = useState<K | null>(null);

  const focusedIndex = useMemo(
    () =>
      focusedId === null
        ? -1
        : items.findIndex((item) => getId(item) === focusedId),
    [items, getId, focusedId],
  );
  const selectedIndex = useMemo(
    () =>
      selectedId === null
        ? -1
        : items.findIndex((item) => getId(item) === selectedId),
    [items, getId, selectedId],
  );

  // The virtualizer rebuilds its measurements whenever `getItemKey` changes
  // identity, so it only changes with the items.
  const getItemKey = useCallback(
    (index: number) => {
      const item = items[index];
      return item === undefined ? index : getId(item);
    },
    [items, getId],
  );
  // The neighbours keep Tab / Shift+Tab moving to the adjacent row, as in an
  // unvirtualized list, even when the visible range is far away.
  const rangeExtractor = useCallback(
    (range: Range) =>
      withPinnedIndexes(
        range,
        focusedIndex === -1
          ? [selectedIndex]
          : [focusedIndex - 1, focusedIndex, focusedIndex + 1, selectedIndex],
      ),
    [focusedIndex, selectedIndex],
  );

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_ROWS,
    // Keyed by id so measured heights follow an item when the order changes.
    getItemKey,
    rangeExtractor,
  });

  function handleFocus(event: FocusEvent<HTMLDivElement>) {
    const row = event.target.closest<HTMLElement>("[data-index]");
    const item = row ? items[Number(row.dataset.index)] : undefined;
    if (item !== undefined) setFocusedId(getId(item));
  }

  function handleBlur(event: FocusEvent<HTMLDivElement>) {
    // Leaving the window reports no next target; the row stays pinned so
    // focus can return to it.
    const next = event.relatedTarget;
    if (next !== null && !event.currentTarget.contains(next)) {
      setFocusedId(null);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="@container flex items-center gap-2 px-3 py-1.5 shrink-0 bg-gray-100 dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700">
        <div className="justify-between w-full flex items-center gap-2">
          <StatusSummary
            items={items}
            getStatus={getStatus}
            statusDefinitions={statusDefinitions}
          />
          {onRemoveAll && (
            <button
              type="button"
              title={removeAllTitle}
              className={`shrink-0 cursor-pointer text-gray-400 hover:text-red-500 ${items.length === 0 ? "opacity-50 cursor-not-allowed" : ""}`}
              disabled={items.length === 0}
              onClick={onRemoveAll}
            >
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>
      {items.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {emptyLabel}
          </p>
        </div>
      ) : (
        // The focus handlers only observe focus moving between the row buttons
        // inside; they add no interaction of their own.
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto"
          onFocus={handleFocus}
          onBlur={handleBlur}
        >
          <div
            className="relative w-full"
            style={{ height: virtualizer.getTotalSize() }}
          >
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const item = items[virtualItem.index];
              if (item === undefined) return null;
              return (
                <div
                  key={virtualItem.key}
                  data-index={virtualItem.index}
                  ref={virtualizer.measureElement}
                  className="absolute top-0 left-0 w-full"
                  style={{ transform: `translateY(${virtualItem.start}px)` }}
                >
                  {renderItem(item, getId(item) === selectedId, onSelect)}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
