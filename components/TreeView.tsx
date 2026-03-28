import { useState, useEffect, useRef } from "react";
import { ChevronRight, Trash2, Copy, Check, ListX } from "lucide-react";
import { serializeToJsLiteral } from "@/utils/serialization";
import type { PathSegment } from "@/types/messages";

interface TreeViewProps {
  readonly data: unknown;
  readonly label?: string;
  readonly depth?: number;
  readonly ancestors?: ReadonlySet<object>;
  readonly editable?: boolean;
  readonly path?: readonly PathSegment[];
  readonly onFieldChange?: (path: readonly PathSegment[], value: string | number | boolean) => void;
  readonly onFieldDelete?: (path: readonly PathSegment[]) => void;
  readonly onArrayClear?: (path: readonly PathSegment[]) => void;
}

function StringInput({ value, path, onFieldChange }: { readonly value: string; readonly path: readonly PathSegment[]; readonly onFieldChange: (path: readonly PathSegment[], value: string | number | boolean) => void }) {
  const [local, setLocal] = useState(value);
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setLocal(value);
  }, [value]);

  return (
    <input
      type="text"
      className="flex-1 min-w-20 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        onFieldChange(path, local);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setLocal(value);
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function NumberInput({ value, path, onFieldChange }: { readonly value: number; readonly path: readonly PathSegment[]; readonly onFieldChange: (path: readonly PathSegment[], value: string | number | boolean) => void }) {
  const [local, setLocal] = useState(String(value));
  const focusedRef = useRef(false);

  useEffect(() => {
    if (!focusedRef.current) setLocal(String(value));
  }, [value]);

  return (
    <input
      type="number"
      className="flex-1 min-w-10 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-1 text-gray-900 dark:text-gray-100 outline-none focus:border-blue-500"
      value={local}
      onChange={(e) => setLocal(e.target.value)}
      onFocus={() => {
        focusedRef.current = true;
      }}
      onBlur={() => {
        focusedRef.current = false;
        if (local === "") {
          setLocal(String(value));
          return;
        }
        onFieldChange(path, Number(local));
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          setLocal(String(value));
          (e.target as HTMLInputElement).blur();
        }
      }}
    />
  );
}

function BooleanInput({ value, path, onFieldChange }: { readonly value: boolean; readonly path: readonly PathSegment[]; readonly onFieldChange: (path: readonly PathSegment[], value: string | number | boolean) => void }) {
  return (
    <label className="flex items-center gap-1 flex-1 min-w-10 cursor-pointer">
      <input type="checkbox" checked={value} onChange={() => onFieldChange(path, !value)} />
      <span className="text-yellow-600 dark:text-yellow-400">{String(value)}</span>
    </label>
  );
}

function DeleteButton({ path, onFieldDelete }: { readonly path: readonly PathSegment[]; readonly onFieldDelete: (path: readonly PathSegment[]) => void }) {
  return (
    <button type="button" title="Delete field" className="ml-auto shrink-0 text-gray-400 hover:text-red-500 cursor-pointer" onClick={() => onFieldDelete(path)}>
      <Trash2 size={12} />
    </button>
  );
}

function CollapsibleNode({ label, entries, isArray, summaryOverride, showClearButton, childSegments, depth, ancestors, editable, path, data, onFieldChange, onFieldDelete, onArrayClear }: { readonly label?: string; readonly entries: readonly (readonly [string, unknown])[]; readonly isArray: boolean; readonly summaryOverride?: string; readonly showClearButton?: boolean; readonly childSegments?: readonly PathSegment[]; readonly depth: number; readonly ancestors: ReadonlySet<object>; readonly editable: boolean; readonly path: readonly PathSegment[]; readonly data: unknown; readonly onFieldChange?: (path: readonly PathSegment[], value: string | number | boolean) => void; readonly onFieldDelete?: (path: readonly PathSegment[]) => void; readonly onArrayClear?: (path: readonly PathSegment[]) => void }) {
  const [expanded, setExpanded] = useState(depth === 0);
  const [copyState, setCopyState] = useState<"idle" | "copied" | "error">("idle");

  const summary = summaryOverride ?? (isArray ? `Array (${entries.length} element${entries.length !== 1 ? "s" : ""})` : `Object (${entries.length} entr${entries.length !== 1 ? "ies" : "y"})`);

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
        <button type="button" className="flex items-center gap-1 hover:underline cursor-pointer" onClick={() => setExpanded((e) => !e)}>
          <ChevronRight size={14} className={`text-blue-600 dark:text-blue-400 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`} />
          {label && <span className="text-green-700 dark:text-green-400">{label}:</span>}
          <span className="text-blue-600 dark:text-blue-400">{summary}</span>
        </button>
        <div className="ml-auto flex items-center">
          <button type="button" title={copyState === "copied" ? "Copied!" : copyState === "error" ? "Copy failed" : "Copy value"} className={`ml-1 shrink-0 cursor-pointer ${copyState === "copied" ? "text-green-500" : copyState === "error" ? "text-red-500" : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"}`} onClick={handleCopy}>
            {copyState === "copied" ? <Check size={12} /> : <Copy size={12} />}
          </button>
          {editable && shouldShowClear && entries.length > 0 && onArrayClear && (
            <button type="button" title="Clear array" className="ml-1 shrink-0 text-gray-400 hover:text-orange-500 cursor-pointer" onClick={() => onArrayClear(path)}>
              <ListX size={12} />
            </button>
          )}
          {editable && onFieldDelete && depth > 0 && <DeleteButton path={path} onFieldDelete={onFieldDelete} />}
        </div>
      </div>
      {expanded && (
        <div className="pl-4">
          {entries.map(([key, value], index) => (
            <TreeView key={key} data={value} label={key} depth={depth + 1} ancestors={ancestors} editable={editable} path={[...path, childSegments ? childSegments[index] : key]} onFieldChange={onFieldChange} onFieldDelete={onFieldDelete} onArrayClear={onArrayClear} />
          ))}
        </div>
      )}
    </div>
  );
}

export function TreeView({ data, label, depth = 0, ancestors = new Set(), editable = false, path = [], onFieldChange, onFieldDelete, onArrayClear }: TreeViewProps) {
  const labelSpan = label && (
    <span title={label} className="font-mono shrink text-ellipsis overflow-hidden text-green-700 dark:text-green-400">
      {label}:&nbsp;
    </span>
  );

  const deleteBtn = editable && onFieldDelete && depth > 0 && <DeleteButton path={path} onFieldDelete={onFieldDelete} />;

  if (data === undefined || data === null) {
    if (depth === 0) {
      return <p className="text-sm text-gray-500 dark:text-gray-400">No data</p>;
    }
    return (
      <div className="flex items-center gap-1">
        {labelSpan}
        <span className="flex-1 truncate min-w-10 text-gray-500 dark:text-gray-400">{data === null ? "null" : "undefined"}</span>
        {deleteBtn}
      </div>
    );
  }

  if (typeof data === "bigint") {
    return (
      <div className="flex items-center gap-1">
        {labelSpan}
        <span className="flex-1 truncate min-w-10 text-purple-600 dark:text-purple-400">{String(data)}n</span>
        {deleteBtn}
      </div>
    );
  }

  if (typeof data === "symbol") {
    return (
      <div className="flex items-center gap-1">
        {labelSpan}
        <span className="flex-1 truncate min-w-10 text-gray-500 dark:text-gray-400">
          Symbol(<span className="text-amber-600 dark:text-amber-400">{data.description ?? ""}</span>)
        </span>
        {deleteBtn}
      </div>
    );
  }

  if (typeof data === "function") {
    return (
      <div className="flex items-center gap-1">
        {labelSpan}
        <span className="flex-1 truncate min-w-10 text-gray-500 dark:text-gray-400 italic">fn</span>
        {deleteBtn}
      </div>
    );
  }

  if (typeof data === "boolean") {
    if (editable && onFieldChange) {
      return (
        <div className="flex items-center gap-1">
          {labelSpan}
          <BooleanInput value={data} path={path} onFieldChange={onFieldChange} />
          {deleteBtn}
        </div>
      );
    }
    return (
      <div className="flex items-center gap-1">
        {labelSpan}
        <span className="flex-1 truncate min-w-10 text-yellow-600 dark:text-yellow-400">{String(data)}</span>
        {deleteBtn}
      </div>
    );
  }

  if (typeof data === "string") {
    if (editable && onFieldChange) {
      return (
        <div className="flex items-center gap-1">
          {labelSpan}
          <StringInput value={data} path={path} onFieldChange={onFieldChange} />
          {deleteBtn}
        </div>
      );
    }
    return (
      <div className="flex items-center">
        {labelSpan}
        <span className="flex-1 truncate min-w-10 text-gray-900 dark:text-gray-100">&quot;{data}&quot;</span>
        {deleteBtn}
      </div>
    );
  }

  if (typeof data !== "object") {
    if (editable && onFieldChange && typeof data === "number") {
      return (
        <div className="flex items-center gap-1">
          {labelSpan}
          <NumberInput value={data} path={path} onFieldChange={onFieldChange} />
          {deleteBtn}
        </div>
      );
    }
    return (
      <div className="flex items-center">
        {labelSpan}
        <span className="flex-1 truncate min-w-10 text-gray-900 dark:text-gray-100">{String(data as number)}</span>
        {deleteBtn}
      </div>
    );
  }

  if (data instanceof Date) {
    return (
      <div className="flex items-center">
        {labelSpan}
        <span className="flex-1 truncate min-w-10 text-blue-600 dark:text-blue-400">{data.toISOString()}</span>
        {deleteBtn}
      </div>
    );
  }

  if (ancestors.has(data)) {
    return (
      <div className="flex items-center">
        {labelSpan}
        <span className="flex-1 truncate min-w-10 text-gray-500 dark:text-gray-400">[Circular]</span>
        {deleteBtn}
      </div>
    );
  }

  const childAncestors = new Set(ancestors);
  childAncestors.add(data);

  if (data instanceof Map) {
    const mapEntries = Array.from(data.entries());
    const displayEntries = mapEntries.map(([k, v]) => {
      const keyLabel = k === null ? "null" : k === undefined ? "undefined" : typeof k === "object" ? "[Object]" : typeof k === "function" ? "[Function]" : String(k);
      return [keyLabel, v] as const;
    });
    const n = mapEntries.length;
    const summary = `Map (${n} entr${n !== 1 ? "ies" : "y"})`;

    if (n === 0) {
      return (
        <div className="flex items-center">
          {labelSpan}
          <span className="flex-1 truncate min-w-10 text-gray-900 dark:text-gray-100">Map (0 entries)</span>
          {deleteBtn}
        </div>
      );
    }

    const childSegments = mapEntries.map(([k]) => ({ mapKey: String(k) }) as PathSegment);

    return <CollapsibleNode label={label} entries={displayEntries} isArray={false} summaryOverride={summary} childSegments={childSegments} depth={depth} ancestors={childAncestors} editable={editable} path={path} data={data} onFieldChange={onFieldChange} onFieldDelete={onFieldDelete} onArrayClear={onArrayClear} />;
  }

  if (data instanceof Set) {
    const members = Array.from(data.values());
    const displayEntries = members.map((v, i) => [String(i), v] as const);
    const n = members.length;
    const summary = `Set (${n} entr${n !== 1 ? "ies" : "y"})`;

    if (n === 0) {
      return (
        <div className="flex items-center">
          {labelSpan}
          <span className="flex-1 truncate min-w-10 text-gray-900 dark:text-gray-100">Set (0 entries)</span>
          {deleteBtn}
        </div>
      );
    }

    return <CollapsibleNode label={label} entries={displayEntries} isArray={false} summaryOverride={summary} showClearButton={true} depth={depth} ancestors={childAncestors} editable={editable} path={path} data={data} onFieldChange={onFieldChange} onFieldDelete={onFieldDelete} onArrayClear={onArrayClear} />;
  }

  const isArray = Array.isArray(data);
  const entries = isArray ? (data as unknown[]).map((value, index) => [String(index), value] as const) : Object.entries(data as Record<string, unknown>);

  if (entries.length === 0) {
    return (
      <div className="flex items-center">
        {labelSpan}
        <span className="flex-1 truncate min-w-10 text-gray-900 dark:text-gray-100">{isArray ? "[]" : "{}"}</span>
        {deleteBtn}
      </div>
    );
  }

  return <CollapsibleNode label={label} entries={entries} isArray={isArray} depth={depth} ancestors={childAncestors} editable={editable} path={path} data={data} onFieldChange={onFieldChange} onFieldDelete={onFieldDelete} onArrayClear={onArrayClear} />;
}
