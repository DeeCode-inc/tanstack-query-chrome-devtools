import { Check, ChevronRight, Copy, ListX, Trash2 } from "lucide-react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import type { PathSegment } from "@/types/messages";
import {
  CIRCULAR,
  dateToWireString,
  formatMapKey,
  serializeToJsLiteral,
} from "@/utils/serialization";

/** Like `String(n)`, but keeps the sign of -0, which `String` drops. */
function formatNumber(n: number): string {
  return Object.is(n, -0) ? "-0" : String(n);
}

/** Error fields rendered explicitly, ahead of the error's own props. */
const ERROR_FIELD_KEYS: ReadonlySet<string> = new Set([
  "name",
  "message",
  "stack",
]);

/** Nodes with more children than this show them in collapsed ranges. */
const CHUNK_SIZE = 100;

/** One child row of a collapsible node. */
export interface TreeEntry {
  /** React key, unique among the node's children. */
  readonly key: string;
  /** Text shown in front of the child's value. */
  readonly label: string;
  /** Segment appended to the node's path to address this child. */
  readonly segment: PathSegment;
  readonly value: unknown;
}

/** Entries for positional children (array items, Set members). */
function indexEntries(values: readonly unknown[]): TreeEntry[] {
  return values.map((value, index) => {
    const key = String(index);
    return { key, label: key, segment: key, value };
  });
}

/** Entries for named children (object properties, Error fields). */
function namedEntries(
  pairs: readonly (readonly [string, unknown])[],
): TreeEntry[] {
  return pairs.map(([key, value]) => ({
    key,
    label: key,
    segment: key,
    value,
  }));
}

/** Text colour of a read-only leaf value, by kind of value. */
const LEAF_VALUE_CLASS = {
  muted: "text-gray-500 dark:text-gray-400",
  bigint: "text-purple-600 dark:text-purple-400",
  boolean: "text-yellow-600 dark:text-yellow-400",
  text: "text-gray-900 dark:text-gray-100",
  date: "text-blue-600 dark:text-blue-400",
  fn: "text-gray-500 dark:text-gray-400 italic",
} as const;

function LeafValue({
  kind,
  children,
}: {
  readonly kind: keyof typeof LEAF_VALUE_CLASS;
  readonly children: ReactNode;
}) {
  return (
    <span className={`flex-1 truncate min-w-10 ${LEAF_VALUE_CLASS[kind]}`}>
      {children}
    </span>
  );
}

/** One non-collapsible row: optional label, the value, optional delete. */
function LeafRow({
  label,
  deleteButton,
  children,
}: {
  readonly label?: string;
  readonly deleteButton?: ReactNode;
  readonly children: ReactNode;
}) {
  return (
    <div className="flex items-center gap-1">
      {label && (
        <span
          title={label}
          className="font-mono shrink text-ellipsis overflow-hidden text-green-700 dark:text-green-400"
        >
          {label}:&nbsp;
        </span>
      )}
      {children}
      {deleteButton}
    </div>
  );
}

interface TreeViewProps {
  readonly data: unknown;
  readonly label?: string;
  readonly depth?: number;
  readonly ancestors?: ReadonlySet<object>;
  readonly editable?: boolean;
  readonly path?: readonly PathSegment[];
  readonly onFieldChange?: (
    path: readonly PathSegment[],
    value: string | number | boolean,
  ) => void;
  readonly onFieldDelete?: (path: readonly PathSegment[]) => void;
  readonly onArrayClear?: (path: readonly PathSegment[]) => void;
}

function StringInput({
  value,
  label,
  path,
  onFieldChange,
}: {
  readonly value: string;
  /** Field name, used for the input's accessible name. */
  readonly label: string;
  readonly path: readonly PathSegment[];
  readonly onFieldChange: (
    path: readonly PathSegment[],
    value: string | number | boolean,
  ) => void;
}) {
  const [local, setLocal] = useState(value);
  const focusedRef = useRef(false);
  // Set by Escape so the blur it triggers discards the edit instead of saving.
  const cancelRef = useRef(false);
  // Set by typing; a blur without it must not write the (possibly stale) text.
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setLocal(value);
  }, [value]);

  return (
    <input
      type="text"
      aria-label={`Edit ${label}`}
      className="flex-1 min-w-20 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
      value={local}
      onChange={(e) => {
        dirtyRef.current = true;
        setLocal(e.target.value);
      }}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        const dirty = dirtyRef.current;
        dirtyRef.current = false;
        if (cancelRef.current) {
          cancelRef.current = false;
          return;
        }
        if (!dirty) {
          // Show any host value that arrived while focused.
          setLocal(value);
          return;
        }
        if (local === value) return;
        onFieldChange(path, local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          cancelRef.current = true;
          setLocal(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function NumberInput({
  value,
  label,
  path,
  onFieldChange,
}: {
  readonly value: number;
  /** Field name, used for the input's accessible name. */
  readonly label: string;
  readonly path: readonly PathSegment[];
  readonly onFieldChange: (
    path: readonly PathSegment[],
    value: string | number | boolean,
  ) => void;
}) {
  const [local, setLocal] = useState(formatNumber(value));
  const focusedRef = useRef(false);
  // Set by Escape so the blur it triggers discards the edit instead of saving.
  const cancelRef = useRef(false);
  // Set by typing; a blur without it must not write the (possibly stale) text.
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setLocal(formatNumber(value));
  }, [value]);

  return (
    <input
      type="number"
      aria-label={`Edit ${label}`}
      className="flex-1 min-w-10 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
      value={local}
      onChange={(e) => {
        dirtyRef.current = true;
        setLocal(e.target.value);
      }}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        const dirty = dirtyRef.current;
        dirtyRef.current = false;
        if (cancelRef.current) {
          cancelRef.current = false;
          return;
        }
        const next = Number(local);
        if (!dirty || local === "" || Number.isNaN(next)) {
          // Nothing usable typed: show the current host value, which may
          // have changed while the input had focus.
          setLocal(formatNumber(value));
          return;
        }
        // Object.is so that changing 0 to -0 (or back) still counts as an edit.
        if (Object.is(next, value)) return;
        onFieldChange(path, next);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          cancelRef.current = true;
          setLocal(formatNumber(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function BooleanInput({
  value,
  label,
  path,
  onFieldChange,
}: {
  readonly value: boolean;
  /** Field name, used as the checkbox's accessible name. */
  readonly label: string;
  readonly path: readonly PathSegment[];
  readonly onFieldChange: (
    path: readonly PathSegment[],
    value: string | number | boolean,
  ) => void;
}) {
  return (
    <label className="flex items-center gap-1 flex-1 min-w-10 cursor-pointer">
      <input
        type="checkbox"
        aria-label={label}
        checked={value}
        onChange={() => onFieldChange(path, !value)}
      />
      <span className={LEAF_VALUE_CLASS.boolean}>{String(value)}</span>
    </label>
  );
}

function DeleteButton({
  path,
  onFieldDelete,
}: {
  readonly path: readonly PathSegment[];
  readonly onFieldDelete: (path: readonly PathSegment[]) => void;
}) {
  return (
    <button
      type="button"
      title="Delete field"
      className="ml-auto shrink-0 text-gray-400 hover:text-red-500 cursor-pointer"
      onClick={() => onFieldDelete(path)}
    >
      <Trash2 size={12} />
    </button>
  );
}

function CollapsibleNode({
  label,
  entries,
  isArray,
  summaryOverride,
  showClearButton,
  depth,
  ancestors,
  editable,
  path,
  data,
  onFieldChange,
  onFieldDelete,
  onArrayClear,
}: {
  readonly label?: string;
  readonly entries: readonly TreeEntry[];
  readonly isArray: boolean;
  readonly summaryOverride?: string;
  readonly showClearButton?: boolean;
  readonly depth: number;
  readonly ancestors: ReadonlySet<object>;
  readonly editable: boolean;
  readonly path: readonly PathSegment[];
  readonly data: unknown;
  readonly onFieldChange?: (
    path: readonly PathSegment[],
    value: string | number | boolean,
  ) => void;
  readonly onFieldDelete?: (path: readonly PathSegment[]) => void;
  readonly onArrayClear?: (path: readonly PathSegment[]) => void;
}) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">(
    "idle",
  );

  const summary =
    summaryOverride ??
    (isArray
      ? `Array (${entries.length} element${entries.length !== 1 ? "s" : ""})`
      : `Object (${entries.length} entr${entries.length !== 1 ? "ies" : "y"})`);

  const shouldShowClear = showClearButton ?? isArray;

  function handleCopy() {
    const text = serializeToJsLiteral(data);
    void navigator.clipboard.writeText(text).then(
      () => {
        setCopyState("copied");
        setTimeout(() => setCopyState("idle"), 1500);
      },
      () => {
        setCopyState("error");
        setTimeout(() => setCopyState("idle"), 1500);
      },
    );
  }

  return (
    <div>
      <div className="flex items-center">
        <button
          type="button"
          aria-expanded={expanded}
          className="flex items-center gap-1 hover:underline cursor-pointer"
          onClick={() => setExpanded((e) => !e)}
        >
          <ChevronRight
            size={14}
            className={`text-blue-600 dark:text-blue-400 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
          />
          {label && (
            <span className="text-green-700 dark:text-green-400">{label}:</span>
          )}
          <span className="text-blue-600 dark:text-blue-400">{summary}</span>
        </button>
        <div className="ml-auto flex items-center">
          <button
            type="button"
            title={
              copyState === "copied"
                ? "Copied!"
                : copyState === "error"
                  ? "Copy failed"
                  : "Copy value"
            }
            className={`ml-1 shrink-0 cursor-pointer ${copyState === "copied" ? "text-green-500" : copyState === "error" ? "text-red-500" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`}
            onClick={handleCopy}
          >
            {copyState === "copied" ? <Check size={12} /> : <Copy size={12} />}
          </button>
          {editable &&
            shouldShowClear &&
            entries.length > 0 &&
            onArrayClear && (
              <button
                type="button"
                title="Clear array"
                className="ml-1 shrink-0 text-gray-400 hover:text-orange-500 cursor-pointer"
                onClick={() => onArrayClear(path)}
              >
                <ListX size={12} />
              </button>
            )}
          {editable && onFieldDelete && depth > 0 && (
            <DeleteButton path={path} onFieldDelete={onFieldDelete} />
          )}
        </div>
      </div>
      {expanded && (
        <div className="pl-4">
          {entries.length > CHUNK_SIZE ? (
            entryRanges(entries.length).map(([start, end]) => (
              <EntryRange
                key={String(start)}
                start={start}
                end={end}
                entries={entries}
                depth={depth}
                ancestors={ancestors}
                editable={editable}
                path={path}
                onFieldChange={onFieldChange}
                onFieldDelete={onFieldDelete}
                onArrayClear={onArrayClear}
              />
            ))
          ) : (
            <TreeEntries
              entries={entries}
              depth={depth}
              ancestors={ancestors}
              editable={editable}
              path={path}
              onFieldChange={onFieldChange}
              onFieldDelete={onFieldDelete}
              onArrayClear={onArrayClear}
            />
          )}
        </div>
      )}
    </div>
  );
}

/** Inclusive `[start, end]` index ranges of at most `CHUNK_SIZE` entries. */
function entryRanges(count: number): (readonly [number, number])[] {
  const ranges: (readonly [number, number])[] = [];
  for (let start = 0; start < count; start += CHUNK_SIZE) {
    ranges.push([start, Math.min(start + CHUNK_SIZE, count) - 1]);
  }
  return ranges;
}

/** Context a node passes down to render its child rows. */
interface ChildRowsProps {
  /** Depth of the node owning the rows; rows render one level deeper. */
  readonly depth: number;
  readonly ancestors: ReadonlySet<object>;
  readonly editable: boolean;
  /** Path of the node owning the rows. */
  readonly path: readonly PathSegment[];
  readonly onFieldChange?: (
    path: readonly PathSegment[],
    value: string | number | boolean,
  ) => void;
  readonly onFieldDelete?: (path: readonly PathSegment[]) => void;
  readonly onArrayClear?: (path: readonly PathSegment[]) => void;
}

/** Renders the given child entries of a node, one `TreeView` each. */
function TreeEntries({
  entries,
  depth,
  ancestors,
  editable,
  path,
  onFieldChange,
  onFieldDelete,
  onArrayClear,
}: ChildRowsProps & { readonly entries: readonly TreeEntry[] }) {
  return (
    <>
      {entries.map((entry) => (
        <TreeView
          key={entry.key}
          data={entry.value}
          label={entry.label}
          depth={depth + 1}
          ancestors={ancestors}
          editable={editable}
          path={[...path, entry.segment]}
          onFieldChange={onFieldChange}
          onFieldDelete={onFieldDelete}
          onArrayClear={onArrayClear}
        />
      ))}
    </>
  );
}

/**
 * Collapsed-by-default group of a large node's children, entries `start`
 * through `end` inclusive. Keeps a node with thousands of children from
 * mounting them all at once.
 */
function EntryRange({
  start,
  end,
  entries,
  ...childRows
}: ChildRowsProps & {
  readonly start: number;
  readonly end: number;
  readonly entries: readonly TreeEntry[];
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div>
      <button
        type="button"
        aria-expanded={expanded}
        className="flex items-center gap-1 hover:underline cursor-pointer"
        onClick={() => setExpanded((e) => !e)}
      >
        <ChevronRight
          size={14}
          className={`text-blue-600 dark:text-blue-400 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
        />
        <span className="text-blue-600 dark:text-blue-400">
          {`[${start}…${end}]`}
        </span>
      </button>
      {expanded && (
        <div className="pl-4">
          <TreeEntries entries={entries.slice(start, end + 1)} {...childRows} />
        </div>
      )}
    </div>
  );
}

export function TreeView({
  data,
  label,
  depth = 0,
  ancestors = new Set(),
  editable = false,
  path = [],
  onFieldChange,
  onFieldDelete,
  onArrayClear,
}: TreeViewProps) {
  const deleteBtn = editable && onFieldDelete && depth > 0 && (
    <DeleteButton path={path} onFieldDelete={onFieldDelete} />
  );
  // Accessible name for edit inputs; the root value has no label.
  const inputLabel = label ?? "value";

  if (data === undefined || data === null) {
    if (depth === 0) {
      return (
        <p className="text-sm text-gray-500 dark:text-gray-400">No data</p>
      );
    }
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        <LeafValue kind="muted">
          {data === null ? "null" : "undefined"}
        </LeafValue>
      </LeafRow>
    );
  }

  if (typeof data === "bigint") {
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        <LeafValue kind="bigint">{String(data)}n</LeafValue>
      </LeafRow>
    );
  }

  if (data === CIRCULAR) {
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        <LeafValue kind="muted">[Circular]</LeafValue>
      </LeafRow>
    );
  }

  if (typeof data === "symbol") {
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        <LeafValue kind="muted">
          Symbol(
          <span className="text-amber-600 dark:text-amber-400">
            {data.description ?? ""}
          </span>
          )
        </LeafValue>
      </LeafRow>
    );
  }

  if (typeof data === "function") {
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        <LeafValue kind="fn">fn</LeafValue>
      </LeafRow>
    );
  }

  if (typeof data === "boolean") {
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        {editable && onFieldChange ? (
          <BooleanInput
            value={data}
            label={inputLabel}
            path={path}
            onFieldChange={onFieldChange}
          />
        ) : (
          <LeafValue kind="boolean">{String(data)}</LeafValue>
        )}
      </LeafRow>
    );
  }

  if (typeof data === "string") {
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        {editable && onFieldChange ? (
          <StringInput
            value={data}
            label={inputLabel}
            path={path}
            onFieldChange={onFieldChange}
          />
        ) : (
          <LeafValue kind="text">&quot;{data}&quot;</LeafValue>
        )}
      </LeafRow>
    );
  }

  if (typeof data !== "object") {
    // NaN and ±Infinity have no editable form in a number input.
    const numberEditable =
      editable &&
      onFieldChange &&
      typeof data === "number" &&
      Number.isFinite(data);
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        {numberEditable ? (
          <NumberInput
            value={data}
            label={inputLabel}
            path={path}
            onFieldChange={onFieldChange}
          />
        ) : (
          <LeafValue kind="text">{formatNumber(data as number)}</LeafValue>
        )}
      </LeafRow>
    );
  }

  if (data instanceof Date) {
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        <LeafValue kind="date">{dateToWireString(data)}</LeafValue>
      </LeafRow>
    );
  }

  if (ancestors.has(data)) {
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        <LeafValue kind="muted">[Circular]</LeafValue>
      </LeafRow>
    );
  }

  const childAncestors = new Set(ancestors);
  childAncestors.add(data);

  if (data instanceof Error) {
    const errorEntries: (readonly [string, unknown])[] = [
      ["name", data.name],
      ["message", data.message],
    ];
    if (typeof data.stack === "string") {
      errorEntries.push(["stack", data.stack]);
    }
    for (const entry of Object.entries(data)) {
      if (!ERROR_FIELD_KEYS.has(entry[0])) errorEntries.push(entry);
    }
    const errorName = typeof data.name === "string" ? data.name : "Error";
    const errorMessage = typeof data.message === "string" ? data.message : "";

    return (
      <CollapsibleNode
        label={label}
        entries={namedEntries(errorEntries)}
        isArray={false}
        summaryOverride={`${errorName}: ${errorMessage}`}
        showClearButton={false}
        depth={depth}
        ancestors={childAncestors}
        editable={false}
        path={path}
        data={data}
      />
    );
  }

  if (data instanceof Map) {
    // Map keys can be any value, so children are addressed by entry position.
    const mapEntries: TreeEntry[] = Array.from(data.entries(), ([k, v], i) => ({
      key: String(i),
      label: formatMapKey(k),
      segment: { mapIndex: i },
      value: v,
    }));
    const n = mapEntries.length;
    const summary = `Map (${n} entr${n !== 1 ? "ies" : "y"})`;

    if (n === 0) {
      return (
        <LeafRow label={label} deleteButton={deleteBtn}>
          <LeafValue kind="text">Map (0 entries)</LeafValue>
        </LeafRow>
      );
    }

    return (
      <CollapsibleNode
        label={label}
        entries={mapEntries}
        isArray={false}
        summaryOverride={summary}
        depth={depth}
        ancestors={childAncestors}
        editable={editable}
        path={path}
        data={data}
        onFieldChange={onFieldChange}
        onFieldDelete={onFieldDelete}
        onArrayClear={onArrayClear}
      />
    );
  }

  if (data instanceof Set) {
    const members = Array.from(data.values());
    const n = members.length;
    const summary = `Set (${n} entr${n !== 1 ? "ies" : "y"})`;

    if (n === 0) {
      return (
        <LeafRow label={label} deleteButton={deleteBtn}>
          <LeafValue kind="text">Set (0 entries)</LeafValue>
        </LeafRow>
      );
    }

    return (
      <CollapsibleNode
        label={label}
        entries={indexEntries(members)}
        isArray={false}
        summaryOverride={summary}
        showClearButton={true}
        depth={depth}
        ancestors={childAncestors}
        editable={editable}
        path={path}
        data={data}
        onFieldChange={onFieldChange}
        onFieldDelete={onFieldDelete}
        onArrayClear={onArrayClear}
      />
    );
  }

  const isArray = Array.isArray(data);
  const entries = isArray
    ? indexEntries(data)
    : namedEntries(Object.entries(data as Record<string, unknown>));

  if (entries.length === 0) {
    return (
      <LeafRow label={label} deleteButton={deleteBtn}>
        <LeafValue kind="text">{isArray ? "[]" : "{}"}</LeafValue>
      </LeafRow>
    );
  }

  return (
    <CollapsibleNode
      label={label}
      entries={entries}
      isArray={isArray}
      depth={depth}
      ancestors={childAncestors}
      editable={editable}
      path={path}
      data={data}
      onFieldChange={onFieldChange}
      onFieldDelete={onFieldDelete}
      onArrayClear={onArrayClear}
    />
  );
}
