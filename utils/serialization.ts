interface TypeSentinel {
  readonly __tqcd_type:
    | "bigint"
    | "date"
    | "function"
    | "symbol"
    | "map"
    | "set"
    | "error"
    | "undefined"
    | "number"
    | "circular"
    | "truncated";
  readonly value?: string;
  readonly entries?: readonly unknown[];
  readonly name?: string;
  readonly message?: string;
  readonly stack?: string;
  readonly props?: Record<string, unknown>;
  /**
   * Children of a container left out because its encoding budget ran out.
   * See `encodeForWire` for where it appears.
   */
  readonly omitted?: number;
}

type WriteTarget = Record<string, unknown> | unknown[];

/**
 * Stand-in for a reference back to an object that is already on the current
 * path from the root (a cycle). Decoding produces it in place of the cyclic
 * reference, so decoded values are always acyclic trees.
 */
export const CIRCULAR: unique symbol = Symbol("Circular");

/**
 * Stand-in for a value the page did not send because the encoding budget of
 * its field ran out (see `encodeForWire`). Decoding produces it in place of
 * the value. It is not the value: the viewer must never write it back.
 */
export const TRUNCATED: unique symbol = Symbol("Truncated");

/**
 * Decoded containers the encoder cut short, with the number of children it
 * left out. Decoded values are never mutated, so the count cannot go stale.
 */
const omittedChildren = new WeakMap<object, number>();

/**
 * How many children (array items, object keys, Map entries, Set members, or
 * Error props) of a decoded container were left out by the encoder, which
 * sent only the ones before them. 0 for a complete value or a non-container.
 */
export function omittedCount(value: unknown): number {
  if (typeof value !== "object" || value === null) return 0;
  return omittedChildren.get(value) ?? 0;
}

/** A child count as it appears on the wire: a safe non-negative integer. */
function isOmittedCount(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

/**
 * Number values that JSON cannot carry: `JSON.stringify` turns NaN and
 * ±Infinity into `null` and -0 into `0`. They travel as their string form.
 */
const SPECIAL_NUMBERS = {
  NaN: Number.NaN,
  Infinity: Number.POSITIVE_INFINITY,
  "-Infinity": Number.NEGATIVE_INFINITY,
  "-0": -0,
} as const;

type SpecialNumberLabel = keyof typeof SPECIAL_NUMBERS;

function specialNumberLabel(n: number): SpecialNumberLabel | null {
  if (Number.isNaN(n)) return "NaN";
  if (n === Number.POSITIVE_INFINITY) return "Infinity";
  if (n === Number.NEGATIVE_INFINITY) return "-Infinity";
  if (Object.is(n, -0)) return "-0";
  return null;
}

function isSpecialNumberLabel(value: unknown): value is SpecialNumberLabel {
  return typeof value === "string" && Object.hasOwn(SPECIAL_NUMBERS, value);
}

function isErrorObject(obj: object): obj is Error {
  return (
    obj instanceof Error ||
    Object.prototype.toString.call(obj) === "[object Error]"
  );
}

const BIGINT_WIRE = /^-?\d+$/;

/**
 * `new Date("nope")` is still `instanceof Date`, but its time value is NaN and
 * `toISOString()` throws `RangeError: Invalid time value` on it. Any invalid
 * Date anywhere in the inspected cache would therefore make serialization throw.
 *
 * That is not contained to the panel: `entrypoints/sync.js` runs in the page's
 * MAIN world as a QueryCache subscriber, and `QueryCache.notify` iterates its
 * subscribers without catching. The RangeError unwinds out of the host
 * application's own React render/commit and trips its error boundary, so a
 * single invalid Date in the cache takes the inspected app down.
 *
 * `"Invalid Date"` is used as the wire value because `new Date("Invalid Date")`
 * decodes back to an equally invalid Date, keeping the round-trip faithful.
 *
 * The guard calls `Date.prototype.getTime.call(date)` rather than
 * `date.getTime()`: `getTime` is an overridable method, while `toISOString`
 * reads the internal [[DateValue]] slot and ignores any override. Going through
 * the prototype keeps the guard reading the same slot as the call it protects,
 * so an overridden `getTime` can neither hide a NaN time value nor introduce a
 * throw where the unguarded code had none.
 */
export const INVALID_DATE_LABEL = "Invalid Date";

export function isInvalidDate(date: Date): boolean {
  return Number.isNaN(Date.prototype.getTime.call(date));
}

export function dateToWireString(date: Date): string {
  return isInvalidDate(date) ? INVALID_DATE_LABEL : date.toISOString();
}

function writeSlot(
  target: WriteTarget,
  key: string | number,
  val: unknown,
): void {
  if (typeof key === "number") {
    (target as unknown[])[key] = val;
  } else if (key === "__proto__") {
    // An own `__proto__` key survives JSON and structured clone as a plain
    // data property. Assigning it would instead hit the inherited
    // `Object.prototype.__proto__` setter and replace the target's prototype
    // (e.g. turning a decoded object into a fake Map), so it is defined as an
    // ordinary own property, the way `JSON.parse` creates it.
    Object.defineProperty(target, key, {
      value: val,
      writable: true,
      enumerable: true,
      configurable: true,
    });
  } else {
    (target as Record<string, unknown>)[key] = val;
  }
}

// === Encoding ===

/**
 * Default budget of one user-data field (a query's `state.data` or `meta`, a
 * mutation's `variables`, ...), in UTF-8 bytes of encoded JSON.
 *
 * Encoding runs synchronously on the inspected page's main thread, and page
 * values are graphs: an object reachable along several paths (a doubly linked
 * list, d3's `parent` + `descendants()`, the Fiber behind a React dev
 * element's `_owner`) is written out once per path, which can grow
 * exponentially. The budget bounds the output and the work of one field
 * whatever its shape: every value visited writes at least one byte, every
 * container opened is charged `CONTAINER_WORK_BYTES` on top, and string reads
 * that end up writing nothing are charged too.
 *
 * 8 MiB keeps ordinary large data whole (20 000 rows of 10 fields encode to
 * about 5 MB in some 30 ms) while a field that would blow up is cut after
 * roughly 20 to 60 ms of work.
 */
export const FIELD_BUDGET_BYTES = 8 * 1024 * 1024;

/** Smallest budget honoured; anything below cannot open a root container. */
const MIN_BUDGET_BYTES = 256;

/**
 * Charged against the budget, on top of its bytes, for every container
 * opened. Opening one (allocating the result, listing the children, tracking
 * the cycle path) costs about as much as writing this many bytes of
 * primitives, so without it a graph of tiny objects would do several times
 * the work per budget byte that flat data does.
 */
const CONTAINER_WORK_BYTES = 16;

/**
 * Deepest container nesting encoded; deeper containers are truncated in
 * place. Everything downstream recurses per level: structured clone
 * (`window.postMessage`), `JSON.stringify` (extension ports) and the viewer's
 * copy and label helpers, which overflow the stack at roughly 1 000 to 3 000
 * levels, and a Map takes three JSON levels. Without it, a long linked chain
 * (a linked list, a Fiber's `return` / `sibling` links) that fits the budget
 * would still make posting the whole message throw.
 */
const MAX_NESTING = 256;

/** Result of `encodeForWire`. */
export interface WireEncoding<T = unknown> {
  /**
   * The encoded value: plain objects, arrays, strings, finite numbers,
   * booleans and null only, so it survives both structured clone and JSON.
   */
  readonly value: T;
  /**
   * Exact size of `JSON.stringify(value)` in UTF-8 bytes, which is how a
   * Chrome extension port measures a message. Never above the budget of a
   * finite-budget encoding.
   */
  readonly utf8Bytes: number;
  /** Whether any part of the input was left out (see `encodeForWire`). */
  readonly truncated: boolean;
}

/** UTF-8 size of `JSON.stringify(template)`; all templates are ASCII. */
function asciiJsonBytes(template: unknown): number {
  return JSON.stringify(template).length;
}

/** The two quotes around a JSON string. */
const QUOTES_BYTES = 2;
const NULL_BYTES = 4;
const TRUE_BYTES = 4;
const FALSE_BYTES = 5;
/** `[`, `,` and `]` around one Map entry. */
const PAIR_BYTES = 3;
/** `{"__tqcd_type":"truncated"}`, the in-place truncation sentinel. */
const TRUNCATED_BYTES = asciiJsonBytes({ __tqcd_type: "truncated" });
const UNDEFINED_BYTES = asciiJsonBytes({ __tqcd_type: "undefined" });
const FUNCTION_BYTES = asciiJsonBytes({ __tqcd_type: "function" });
const CIRCULAR_BYTES = asciiJsonBytes({ __tqcd_type: "circular" });
// Sentinels with a single string `value`, without that string's bytes.
const BIGINT_SHELL_BYTES =
  asciiJsonBytes({ __tqcd_type: "bigint", value: "" }) - QUOTES_BYTES;
const SYMBOL_SHELL_BYTES =
  asciiJsonBytes({ __tqcd_type: "symbol", value: "" }) - QUOTES_BYTES;
const DATE_SHELL_BYTES =
  asciiJsonBytes({ __tqcd_type: "date", value: "" }) - QUOTES_BYTES;
const NUMBER_SHELL_BYTES =
  asciiJsonBytes({ __tqcd_type: "number", value: "" }) - QUOTES_BYTES;
// Container sentinels with no children.
const MAP_SHELL_BYTES = asciiJsonBytes({ __tqcd_type: "map", entries: [] });
const SET_SHELL_BYTES = asciiJsonBytes({ __tqcd_type: "set", entries: [] });
/** Error sentinel with empty props, without its name and message strings. */
const ERROR_SHELL_BYTES =
  asciiJsonBytes({ __tqcd_type: "error", name: "", message: "", props: {} }) -
  2 * QUOTES_BYTES;
/** `,"stack":`, without the stack string. */
const STACK_FIELD_BYTES = ',"stack":'.length;
/** `,"omitted":` on a cut Map, Set or Error sentinel, without the count. */
const OMITTED_FIELD_BYTES = ',"omitted":'.length;
/** Last item of a cut array, without the count and the separator. */
const ARRAY_TAIL_SHELL_BYTES = '{"__tqcd_type":"truncated","omitted":}'.length;
/** Wrapper of a cut object, without the count and the object itself. */
const RECORD_WRAPPER_SHELL_BYTES =
  '{"__tqcd_type":"truncated","omitted":,"props":}'.length;
/** Digits of the largest count that can be written (a safe integer). */
const MAX_COUNT_DIGITS = 16;
/**
 * Held by every open container for the marker it writes if it is cut short,
 * so that cutting every open container at once still fits the budget.
 */
const TAIL_RESERVE_BYTES =
  Math.max(
    1 + ARRAY_TAIL_SHELL_BYTES,
    RECORD_WRAPPER_SHELL_BYTES,
    OMITTED_FIELD_BYTES,
  ) + MAX_COUNT_DIGITS;

/**
 * Any code unit `JSON.stringify` does not copy as one ASCII byte: `"`, `\`,
 * control characters (escaped) and everything from U+0080 (multi-byte).
 */
const NEEDS_UTF8_SCAN = /[^\x20\x21\x23-\x5b\x5d-\x7f]/;

/**
 * UTF-8 size of `JSON.stringify(s)`, quotes included, when it is at most
 * `limit`; otherwise some number above `limit`. Reads at most about `limit`
 * code units, so a huge string costs nothing to reject.
 */
function jsonStringBytes(s: string, limit: number): number {
  const length = s.length;
  // Every code unit takes at least one byte.
  if (length + QUOTES_BYTES > limit) return length + QUOTES_BYTES;
  if (!NEEDS_UTF8_SCAN.test(s)) return length + QUOTES_BYTES;
  let bytes = QUOTES_BYTES;
  for (let i = 0; i < length && bytes <= limit; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) {
      if (c >= 0x20 && c !== 0x22 && c !== 0x5c) bytes += 1;
      // \" \\ \b \t \n \f \r
      else if (
        c === 0x22 ||
        c === 0x5c ||
        (c >= 0x08 && c <= 0x0a) ||
        c === 0x0c ||
        c === 0x0d
      ) {
        bytes += 2;
      }
      // \u00XX
      else bytes += 6;
    } else if (c < 0x800) {
      bytes += 2;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const next = i + 1 < length ? s.charCodeAt(i + 1) : 0;
      if (next >= 0xdc00 && next <= 0xdfff) {
        // A surrogate pair is one 4-byte code point.
        bytes += 4;
        i++;
      } else {
        // `JSON.stringify` escapes a lone surrogate as \uXXXX.
        bytes += 6;
      }
    } else if (c >= 0xdc00 && c <= 0xdfff) {
      bytes += 6;
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/**
 * Bytes one field may still spend. Every open container also holds
 * `TAIL_RESERVE_BYTES` and every pending value `TRUNCATED_BYTES` that are
 * not counted here, so whatever gets cut, the output stays within budget.
 */
interface Scope {
  remaining: number;
}

function fieldScope(budgetBytes: number): Scope {
  // `>=` rather than `Math.max` so that NaN also falls back to the minimum.
  const budget =
    budgetBytes >= MIN_BUDGET_BYTES ? budgetBytes : MIN_BUDGET_BYTES;
  // The root's slot reservation comes out of the budget like a child's.
  return { remaining: budget - TRUNCATED_BYTES };
}

/** Marks a subtree that `encodeForWire` encodes with a budget of its own. */
class FieldBudget {
  readonly value: unknown;
  readonly budgetBytes: number;

  constructor(value: unknown, budgetBytes: number) {
    this.value = value;
    this.budgetBytes = budgetBytes;
  }
}

/**
 * Wraps one user-data field of an entity so that `encodeForWire` gives it a
 * budget of its own, instead of the one of the value around it. Meant for the
 * fields of an entry encoded with an unbounded budget: the entry's structure
 * is then always complete, and a field that runs out of budget is cut without
 * starving its siblings. Inside a finite budget the marker is ignored and the
 * field shares the enclosing budget.
 */
export function withFieldBudget(
  value: unknown,
  budgetBytes: number = FIELD_BUDGET_BYTES,
): unknown {
  return new FieldBudget(value, budgetBytes);
}

interface MapSentinel {
  readonly __tqcd_type: "map";
  readonly entries: [unknown, unknown][];
  omitted?: number;
}

interface SetSentinel {
  readonly __tqcd_type: "set";
  readonly entries: unknown[];
  omitted?: number;
}

interface ErrorSentinel {
  readonly __tqcd_type: "error";
  readonly name: string;
  readonly message: string;
  readonly stack?: string;
  readonly props: Record<string, unknown>;
  omitted?: number;
}

interface ValueFrame {
  readonly kind: "value";
  readonly value: unknown;
  readonly target: WriteTarget;
  readonly key: string | number;
  readonly scope: Scope;
  /**
   * The Map or Set this value is a key or member of. Decoding turns every
   * in-place truncation into the same `TRUNCATED` value, so two truncated
   * keys or members would merge and shift the positions edits address. One
   * that would be truncated in place cuts its owner short instead.
   */
  readonly owner?: MapFrame | SetFrame;
}

/** An open array; `index` is the next item to encode. */
interface ArrayFrame {
  readonly kind: "array";
  readonly obj: readonly unknown[];
  readonly length: number;
  readonly result: unknown[];
  readonly scope: Scope;
  index: number;
}

/** An open plain object, or the props of an open Error. */
interface RecordFrame {
  readonly kind: "record";
  readonly obj: object;
  readonly keys: readonly string[];
  /** Values by key index, or `null` to read each one from `obj` when due. */
  readonly values: readonly unknown[] | null;
  readonly result: Record<string, unknown>;
  readonly scope: Scope;
  /** Slot holding `result`; a cut object is rewrapped there. */
  readonly target: WriteTarget;
  readonly key: string | number;
  /** For Error props: the sentinel that records a cut instead. */
  readonly errorSentinel: ErrorSentinel | null;
  index: number;
}

interface MapFrame {
  readonly kind: "map";
  readonly obj: object;
  readonly iterator: Iterator<[unknown, unknown]>;
  readonly size: number;
  readonly sentinel: MapSentinel;
  readonly scope: Scope;
  /** Entries started, including one whose key is being encoded. */
  index: number;
  /** The started entry, whose value is pushed once its key is encoded. */
  pair: [unknown, unknown] | null;
  pairValue: unknown;
  /** Set by the key frame of `pair` (see `ValueFrame.owner`). */
  cut: boolean;
}

interface SetFrame {
  readonly kind: "set";
  readonly obj: object;
  readonly iterator: Iterator<unknown>;
  readonly size: number;
  readonly sentinel: SetSentinel;
  readonly scope: Scope;
  /** Members started, including one being encoded. */
  index: number;
  /** Set by the frame of the last member (see `ValueFrame.owner`). */
  cut: boolean;
}

type ContainerFrame = ArrayFrame | RecordFrame | MapFrame | SetFrame;

interface EncodeRun {
  readonly stack: (ValueFrame | ContainerFrame)[];
  /**
   * Objects on the path from the root to the current frame. Only a reference
   * to one of these is a cycle; an object that is merely shared between
   * siblings is encoded again at every occurrence.
   */
  readonly ancestors: Set<object>;
  /** UTF-8 bytes of JSON written so far. */
  bytes: number;
  truncated: boolean;
}

/**
 * Encodes `value` for the bridge: every value JSON cannot carry (bigint,
 * Date, Map, Set, Error, undefined, NaN, ±Infinity, -0, symbols, functions)
 * becomes a `__tqcd_type` sentinel that `decodeBigInts` reverses, and a
 * reference back to an object on the current path becomes "circular".
 *
 * Output and work are bounded by `budgetBytes` of encoded JSON (see
 * `FIELD_BUDGET_BYTES`), and nesting by `MAX_NESTING`. Within both the
 * output is complete. Past them, values are left out:
 * - a value that does not fit is replaced in place by
 *   `{ __tqcd_type: "truncated" }`, except a Map key or Set member, which
 *   cuts its Map or Set short there instead;
 * - a container cut short keeps its first children and records how many it
 *   left out: an array gets a last item `{ __tqcd_type: "truncated",
 *   omitted }`, an object is wrapped as `{ __tqcd_type: "truncated",
 *   omitted, props }`, and a Map, Set or Error sentinel gets `omitted`.
 * So arrays stay arrays and objects stay records, and the children that are
 * sent keep their index, key or position, which edit paths rely on.
 *
 * The returned `utf8Bytes` is exact, computed while encoding at no extra
 * pass. `budgetBytes` may be `Infinity` for structure that must arrive whole;
 * its user-data fields are then marked with `withFieldBudget`.
 */
export function encodeForWire(
  value: unknown,
  budgetBytes: number = FIELD_BUDGET_BYTES,
): WireEncoding {
  const root: [unknown] = [undefined];
  const run: EncodeRun = {
    stack: [
      {
        kind: "value",
        value,
        target: root,
        key: 0,
        scope: fieldScope(budgetBytes),
      },
    ],
    ancestors: new Set(),
    bytes: 0,
    truncated: false,
  };
  const { stack } = run;

  while (stack.length > 0) {
    const frame = stack[stack.length - 1]!;
    switch (frame.kind) {
      case "value":
        stack.pop();
        encodeValue(run, frame);
        break;
      case "array":
        stepArray(run, frame);
        break;
      case "record":
        stepRecord(run, frame);
        break;
      case "map":
        stepMap(run, frame);
        break;
      case "set":
        stepSet(run, frame);
        break;
    }
  }

  return { value: root[0], utf8Bytes: run.bytes, truncated: run.truncated };
}

/**
 * `encodeForWire` with the default field budget, for callers that only need
 * the value.
 */
export function encodeBigInts(value: unknown): unknown {
  return encodeForWire(value).value;
}

/**
 * Writes `wire`, which takes `bytes`, into the frame's slot if it fits in
 * `available`; otherwise truncates the value in place.
 */
function place(
  run: EncodeRun,
  frame: ValueFrame,
  wire: unknown,
  bytes: number,
  available: number,
): void {
  if (bytes > available) {
    truncateInPlace(run, frame);
    return;
  }
  writeSlot(frame.target, frame.key, wire);
  frame.scope.remaining = available - bytes;
  run.bytes += bytes;
}

/**
 * Like `place` for a value made of a fixed shell and the string `text`.
 * Rejecting a string after reading it is charged to the budget, otherwise a
 * large string reachable along many paths would be read once per path for
 * free.
 */
function placeWithString(
  run: EncodeRun,
  frame: ValueFrame,
  wire: unknown,
  shellBytes: number,
  text: string,
  available: number,
): void {
  const limit = available - shellBytes;
  const textBytes = jsonStringBytes(text, limit);
  if (textBytes <= limit) {
    place(run, frame, wire, shellBytes + textBytes, available);
    return;
  }
  truncateInPlace(run, frame);
  chargeRejectedString(frame.scope, text, limit);
}

/** Charges the reading of a string that turned out not to fit in `limit`. */
function chargeRejectedString(scope: Scope, s: string, limit: number): void {
  // Rejected on its length alone, without reading it.
  if (s.length + QUOTES_BYTES > limit) return;
  scope.remaining = Math.max(0, scope.remaining - s.length);
}

/**
 * Replaces the frame's value with the in-place truncation sentinel, paid for
 * by the slot's reservation, or cuts the frame's owner short instead.
 */
function truncateInPlace(run: EncodeRun, frame: ValueFrame): void {
  run.truncated = true;
  if (frame.owner) {
    frame.owner.cut = true;
    // The reservation is not used.
    frame.scope.remaining += TRUNCATED_BYTES;
    return;
  }
  writeSlot(frame.target, frame.key, {
    __tqcd_type: "truncated",
  } satisfies TypeSentinel);
  run.bytes += TRUNCATED_BYTES;
}

/**
 * Takes `openBytes` for a container's empty form plus its tail reservation.
 * Returns false, having truncated the container in place, if they do not fit
 * or the container would be nested too deep.
 */
function openContainer(
  run: EncodeRun,
  frame: ValueFrame,
  openBytes: number,
  available: number,
): boolean {
  const cost = openBytes + CONTAINER_WORK_BYTES;
  // Every open container is on the path, so the path is the nesting depth.
  if (
    run.ancestors.size >= MAX_NESTING ||
    cost + TAIL_RESERVE_BYTES > available
  ) {
    truncateInPlace(run, frame);
    return false;
  }
  frame.scope.remaining = available - cost - TAIL_RESERVE_BYTES;
  run.bytes += openBytes;
  return true;
}

function encodeValue(run: EncodeRun, frame: ValueFrame): void {
  const v = frame.value;
  const scope = frame.scope;
  // Everything left, plus the reservation taken out for this value's slot,
  // which always covers the in-place truncation sentinel.
  const available = scope.remaining + TRUNCATED_BYTES;

  if (v === null) {
    place(run, frame, v, NULL_BYTES, available);
    return;
  }

  if (v === undefined) {
    place(
      run,
      frame,
      { __tqcd_type: "undefined" } satisfies TypeSentinel,
      UNDEFINED_BYTES,
      available,
    );
    return;
  }

  switch (typeof v) {
    case "bigint": {
      const digits = String(v);
      place(
        run,
        frame,
        { __tqcd_type: "bigint", value: digits } satisfies TypeSentinel,
        BIGINT_SHELL_BYTES + digits.length + QUOTES_BYTES,
        available,
      );
      return;
    }
    case "symbol": {
      const description = v.description ?? "";
      placeWithString(
        run,
        frame,
        { __tqcd_type: "symbol", value: description } satisfies TypeSentinel,
        SYMBOL_SHELL_BYTES,
        description,
        available,
      );
      return;
    }
    case "function":
      place(
        run,
        frame,
        { __tqcd_type: "function" } satisfies TypeSentinel,
        FUNCTION_BYTES,
        available,
      );
      return;
    case "number": {
      const label = specialNumberLabel(v);
      if (label === null) {
        // `JSON.stringify` writes a finite number as `String` does.
        place(run, frame, v, String(v).length, available);
      } else {
        place(
          run,
          frame,
          { __tqcd_type: "number", value: label } satisfies TypeSentinel,
          NUMBER_SHELL_BYTES + label.length + QUOTES_BYTES,
          available,
        );
      }
      return;
    }
    case "string":
      placeWithString(run, frame, v, 0, v, available);
      return;
    case "boolean":
      place(run, frame, v, v ? TRUE_BYTES : FALSE_BYTES, available);
      return;
  }

  const obj = v;

  if (obj instanceof FieldBudget) {
    run.stack.push({
      ...frame,
      value: obj.value,
      // Only an unbounded scope hands out budgets of its own: inside a finite
      // one, the field's bytes would escape the enclosing budget.
      scope:
        scope.remaining === Number.POSITIVE_INFINITY
          ? fieldScope(obj.budgetBytes)
          : scope,
    });
    return;
  }

  // A Date has no children to recurse into, so it cannot close a cycle and
  // needs no ancestor bookkeeping.
  if (obj instanceof Date) {
    const wire = dateToWireString(obj);
    placeWithString(
      run,
      frame,
      { __tqcd_type: "date", value: wire } satisfies TypeSentinel,
      DATE_SHELL_BYTES,
      wire,
      available,
    );
    return;
  }

  if (run.ancestors.has(obj)) {
    place(
      run,
      frame,
      { __tqcd_type: "circular" } satisfies TypeSentinel,
      CIRCULAR_BYTES,
      available,
    );
    return;
  }

  if (isErrorObject(obj)) {
    encodeError(run, frame, obj, available);
    return;
  }

  if (Array.isArray(obj)) {
    if (!openContainer(run, frame, 2, available)) return;
    const result: unknown[] = [];
    writeSlot(frame.target, frame.key, result);
    run.ancestors.add(obj);
    run.stack.push({
      kind: "array",
      obj,
      length: obj.length,
      result,
      scope,
      index: 0,
    });
    return;
  }

  if (obj instanceof Map) {
    if (!openContainer(run, frame, MAP_SHELL_BYTES, available)) return;
    const sentinel: MapSentinel = { __tqcd_type: "map", entries: [] };
    writeSlot(frame.target, frame.key, sentinel satisfies TypeSentinel);
    run.ancestors.add(obj);
    run.stack.push({
      kind: "map",
      obj,
      iterator: obj.entries(),
      size: obj.size,
      sentinel,
      scope,
      index: 0,
      pair: null,
      pairValue: undefined,
      cut: false,
    });
    return;
  }

  if (obj instanceof Set) {
    if (!openContainer(run, frame, SET_SHELL_BYTES, available)) return;
    const sentinel: SetSentinel = { __tqcd_type: "set", entries: [] };
    writeSlot(frame.target, frame.key, sentinel satisfies TypeSentinel);
    run.ancestors.add(obj);
    run.stack.push({
      kind: "set",
      obj,
      iterator: obj.values(),
      size: obj.size,
      sentinel,
      scope,
      index: 0,
      cut: false,
    });
    return;
  }

  if (!openContainer(run, frame, 2, available)) return;
  const result: Record<string, unknown> = {};
  writeSlot(frame.target, frame.key, result);
  run.ancestors.add(obj);
  run.stack.push({
    kind: "record",
    obj,
    // Keys up front, values as they come: a cut object reads only the
    // values it sends.
    keys: Object.keys(obj),
    values: null,
    result,
    scope,
    target: frame.target,
    key: frame.key,
    errorSentinel: null,
    index: 0,
  });
}

function encodeError(
  run: EncodeRun,
  frame: ValueFrame,
  obj: Error,
  available: number,
): void {
  const name = typeof obj.name === "string" ? obj.name : "Error";
  const message = typeof obj.message === "string" ? obj.message : "";
  const errorStack: unknown = obj.stack;
  const stackText = typeof errorStack === "string" ? errorStack : null;

  // The shell (the sentinel with empty props) has to fit along with the
  // tail reservation of the props.
  const limit = available - TAIL_RESERVE_BYTES;
  let shellBytes =
    ERROR_SHELL_BYTES + (stackText === null ? 0 : STACK_FIELD_BYTES);
  // Code units read while measuring, charged if the shell is rejected.
  let read = 0;
  const texts =
    stackText === null ? [name, message] : [name, message, stackText];
  for (const text of texts) {
    if (shellBytes > limit) break;
    const textLimit = limit - shellBytes;
    if (text.length + QUOTES_BYTES <= textLimit) read += text.length;
    shellBytes += jsonStringBytes(text, textLimit);
  }
  if (!openContainer(run, frame, shellBytes, available)) {
    frame.scope.remaining = Math.max(0, frame.scope.remaining - read);
    return;
  }

  const props: Record<string, unknown> = {};
  const sentinel: ErrorSentinel = {
    __tqcd_type: "error",
    name,
    message,
    ...(stackText !== null ? { stack: stackText } : {}),
    props,
  };
  writeSlot(frame.target, frame.key, sentinel satisfies TypeSentinel);
  const propEntries: [string, unknown][] = Object.entries(obj);
  // `new Error(msg, { cause })` defines `cause` as a non-enumerable own
  // property, which `Object.entries` skips.
  if (
    Object.hasOwn(obj, "cause") &&
    !Object.prototype.propertyIsEnumerable.call(obj, "cause")
  ) {
    propEntries.push(["cause", obj.cause]);
  }
  run.ancestors.add(obj);
  run.stack.push({
    kind: "record",
    obj,
    keys: propEntries.map(([propKey]) => propKey),
    values: propEntries.map(([, propValue]) => propValue),
    result: props,
    scope: frame.scope,
    target: frame.target,
    key: frame.key,
    errorSentinel: sentinel,
    index: 0,
  });
}

/**
 * Takes the separator and slot bytes of a container's next child plus the
 * child's reservation. Returns false if they do not fit.
 */
function takeSlot(scope: Scope, slotBytes: number, reserved: number): boolean {
  if (slotBytes + reserved > scope.remaining) return false;
  scope.remaining -= slotBytes + reserved;
  return true;
}

function stepArray(run: EncodeRun, frame: ArrayFrame): void {
  const { index } = frame;
  if (index >= frame.length) {
    closeContainer(run, frame, 0);
    return;
  }
  const separator = index > 0 ? 1 : 0;
  if (!takeSlot(frame.scope, separator, TRUNCATED_BYTES)) {
    closeContainer(run, frame, frame.length - index);
    return;
  }
  run.bytes += separator;
  frame.index = index + 1;
  run.stack.push({
    kind: "value",
    value: frame.obj[index],
    target: frame.result,
    key: index,
    scope: frame.scope,
  });
}

function stepRecord(run: EncodeRun, frame: RecordFrame): void {
  const { index, keys, scope } = frame;
  if (index >= keys.length) {
    closeContainer(run, frame, 0);
    return;
  }
  const key = keys[index]!;
  const separator = index > 0 ? 1 : 0;
  // `"key":` goes before the value.
  const limit = scope.remaining - TRUNCATED_BYTES - separator - 1;
  const keyBytes = jsonStringBytes(key, limit);
  if (keyBytes > limit) {
    chargeRejectedString(scope, key, limit);
    closeContainer(run, frame, keys.length - index);
    return;
  }
  const slotBytes = separator + keyBytes + 1;
  scope.remaining -= slotBytes + TRUNCATED_BYTES;
  run.bytes += slotBytes;
  frame.index = index + 1;
  run.stack.push({
    kind: "value",
    value:
      frame.values === null
        ? (frame.obj as Record<string, unknown>)[key]
        : frame.values[index],
    target: frame.result,
    key,
    scope,
  });
}

function stepMap(run: EncodeRun, frame: MapFrame): void {
  const { scope, pair } = frame;
  if (pair !== null) {
    frame.pair = null;
    if (frame.cut) {
      // The entry's key could not be sent: drop the entry, refunding its
      // slot and the reservation of the value that is never encoded.
      frame.sentinel.entries.pop();
      frame.index -= 1;
      const slotBytes = (frame.index > 0 ? 1 : 0) + PAIR_BYTES;
      scope.remaining += slotBytes + TRUNCATED_BYTES;
      run.bytes -= slotBytes;
      closeContainer(run, frame, remainingMembers(frame));
      return;
    }
    const pairValue = frame.pairValue;
    frame.pairValue = undefined;
    run.stack.push({
      kind: "value",
      value: pairValue,
      target: pair,
      key: 1,
      scope,
    });
    return;
  }
  const next = frame.iterator.next();
  if (next.done) {
    closeContainer(run, frame, 0);
    return;
  }
  const slotBytes = (frame.index > 0 ? 1 : 0) + PAIR_BYTES;
  if (!takeSlot(scope, slotBytes, 2 * TRUNCATED_BYTES)) {
    closeContainer(run, frame, remainingMembers(frame));
    return;
  }
  run.bytes += slotBytes;
  const [mapKey, mapValue] = next.value;
  const started: [unknown, unknown] = [undefined, undefined];
  frame.sentinel.entries.push(started);
  frame.index += 1;
  frame.pair = started;
  frame.pairValue = mapValue;
  run.stack.push({
    kind: "value",
    value: mapKey,
    target: started,
    key: 0,
    scope,
    owner: frame,
  });
}

function stepSet(run: EncodeRun, frame: SetFrame): void {
  const { scope } = frame;
  const { entries } = frame.sentinel;
  if (frame.cut) {
    // The last member could not be sent: drop it, refunding its separator.
    entries.pop();
    frame.index -= 1;
    const separator = frame.index > 0 ? 1 : 0;
    scope.remaining += separator;
    run.bytes -= separator;
    closeContainer(run, frame, remainingMembers(frame));
    return;
  }
  const next = frame.iterator.next();
  if (next.done) {
    closeContainer(run, frame, 0);
    return;
  }
  const separator = frame.index > 0 ? 1 : 0;
  if (!takeSlot(scope, separator, TRUNCATED_BYTES)) {
    closeContainer(run, frame, remainingMembers(frame));
    return;
  }
  run.bytes += separator;
  const key = entries.length;
  entries.push(undefined);
  frame.index += 1;
  run.stack.push({
    kind: "value",
    value: next.value,
    target: entries,
    key,
    scope,
    owner: frame,
  });
}

/**
 * Members of a Map or Set not sent yet, counting the one at `index`, which
 * exists since iteration got that far. At least 1 even if the page resized
 * the collection while it was being encoded.
 */
function remainingMembers(frame: MapFrame | SetFrame): number {
  return Math.max(1, frame.size - frame.index);
}

/**
 * Pops the container on top of the stack. `omitted` children, if any, are
 * recorded in the container's tail marker, paid for by its reservation.
 */
function closeContainer(
  run: EncodeRun,
  frame: ContainerFrame,
  omitted: number,
): void {
  run.stack.pop();
  run.ancestors.delete(frame.obj);
  let tailBytes = 0;
  if (omitted > 0) {
    run.truncated = true;
    const countBytes = String(omitted).length;
    switch (frame.kind) {
      case "array":
        tailBytes =
          (frame.result.length > 0 ? 1 : 0) +
          ARRAY_TAIL_SHELL_BYTES +
          countBytes;
        frame.result.push({
          __tqcd_type: "truncated",
          omitted,
        } satisfies TypeSentinel);
        break;
      case "record":
        if (frame.errorSentinel) {
          frame.errorSentinel.omitted = omitted;
          tailBytes = OMITTED_FIELD_BYTES + countBytes;
        } else {
          writeSlot(frame.target, frame.key, {
            __tqcd_type: "truncated",
            omitted,
            props: frame.result,
          } satisfies TypeSentinel);
          tailBytes = RECORD_WRAPPER_SHELL_BYTES + countBytes;
        }
        break;
      case "map":
      case "set":
        frame.sentinel.omitted = omitted;
        tailBytes = OMITTED_FIELD_BYTES + countBytes;
        break;
    }
  }
  frame.scope.remaining += TAIL_RESERVE_BYTES - tailBytes;
  run.bytes += tailBytes;
}

// === Decoding ===

interface DecodeFrame {
  kind: "decode";
  value: unknown;
  target: WriteTarget;
  key: string | number;
}

interface FinalizeMapFrame {
  kind: "finalize-map";
  entries: [unknown, unknown][];
  omitted: unknown;
  target: WriteTarget;
  key: string | number;
}

interface FinalizeSetFrame {
  kind: "finalize-set";
  entries: unknown[];
  omitted: unknown;
  target: WriteTarget;
  key: string | number;
}

/**
 * Popped once every child frame of `obj` has been processed, which is when
 * `obj` leaves the current root-to-node path.
 */
interface ExitFrame {
  kind: "exit";
  obj: object;
}

/** Records the `omitted` count of a wire container on its decoded value. */
function recordOmitted(decoded: object, omitted: unknown): void {
  if (isOmittedCount(omitted) && omitted > 0) {
    omittedChildren.set(decoded, omitted);
  }
}

/**
 * The count of the tail marker `encodeForWire` appends to an array it cut
 * short, or null when the array's last item is not one. The wrapper of a cut
 * object has `props` and is an ordinary item.
 */
function arrayTailCount(items: readonly unknown[]): number | null {
  const last = items.at(-1);
  if (typeof last !== "object" || last === null) return null;
  const marker = last as Record<string, unknown>;
  return marker.__tqcd_type === "truncated" &&
    isOmittedCount(marker.omitted) &&
    !Object.hasOwn(marker, "props")
    ? marker.omitted
    : null;
}

/**
 * Builds the real `Error` for an error sentinel. `name` and `stack` are
 * defined like the engine defines them on a native error (non-enumerable),
 * so only the sentinel's `props` show up as enumerable own properties.
 */
function decodeErrorShell(sentinel: Record<string, unknown>): Error {
  const error = new Error(
    typeof sentinel.message === "string" ? sentinel.message : "",
  );
  Object.defineProperty(error, "name", {
    value: typeof sentinel.name === "string" ? sentinel.name : "Error",
    writable: true,
    enumerable: false,
    configurable: true,
  });
  if (typeof sentinel.stack === "string") {
    Object.defineProperty(error, "stack", {
      value: sentinel.stack,
      writable: true,
      enumerable: false,
      configurable: true,
    });
  }
  return error;
}

export function decodeBigInts(value: unknown): unknown {
  const root: [unknown] = [undefined];
  const stack: (
    | DecodeFrame
    | FinalizeMapFrame
    | FinalizeSetFrame
    | ExitFrame
  )[] = [{ kind: "decode", value, target: root, key: 0 }];
  // Same path-based cycle tracking as `encodeForWire`: a payload that arrived
  // through structured clone can be cyclic, and the decoded value must not be.
  const ancestors = new Set<object>();

  while (stack.length > 0) {
    const frame = stack.pop()!;

    if (frame.kind === "exit") {
      ancestors.delete(frame.obj);
      continue;
    }
    if (frame.kind === "finalize-map") {
      const map = new Map(frame.entries);
      recordOmitted(map, frame.omitted);
      writeSlot(frame.target, frame.key, map);
      continue;
    }
    if (frame.kind === "finalize-set") {
      const set = new Set(frame.entries);
      recordOmitted(set, frame.omitted);
      writeSlot(frame.target, frame.key, set);
      continue;
    }

    const v = frame.value;

    if (typeof v !== "object" || v === null) {
      writeSlot(frame.target, frame.key, v);
      continue;
    }

    if (ancestors.has(v)) {
      writeSlot(frame.target, frame.key, CIRCULAR);
      continue;
    }
    ancestors.add(v);
    stack.push({ kind: "exit", obj: v });

    if (Array.isArray(v)) {
      // A cut array's tail marker becomes its omitted count, not an item.
      const omitted = arrayTailCount(v);
      const length = omitted === null ? v.length : v.length - 1;
      const result = new Array<unknown>(length);
      recordOmitted(result, omitted);
      writeSlot(frame.target, frame.key, result);
      for (let i = length - 1; i >= 0; i--) {
        stack.push({ kind: "decode", value: v[i], target: result, key: i });
      }
      continue;
    }

    const obj = v as Record<string, unknown>;

    switch (obj.__tqcd_type) {
      case "bigint":
        // `BigInt("1.5")` and `BigInt("abc")` throw; decoding must not.
        if (typeof obj.value === "string" && BIGINT_WIRE.test(obj.value)) {
          writeSlot(frame.target, frame.key, BigInt(obj.value));
        } else {
          writeSlot(frame.target, frame.key, undefined);
        }
        continue;
      case "undefined":
        writeSlot(frame.target, frame.key, undefined);
        continue;
      case "number":
        writeSlot(
          frame.target,
          frame.key,
          isSpecialNumberLabel(obj.value)
            ? SPECIAL_NUMBERS[obj.value]
            : undefined,
        );
        continue;
      case "circular":
        writeSlot(frame.target, frame.key, CIRCULAR);
        continue;
      case "truncated": {
        const props = obj.props;
        if (
          !isOmittedCount(obj.omitted) ||
          typeof props !== "object" ||
          props === null ||
          Array.isArray(props)
        ) {
          writeSlot(frame.target, frame.key, TRUNCATED);
          continue;
        }
        // A cut object: its sent keys, with the omitted count recorded.
        if (ancestors.has(props)) {
          writeSlot(frame.target, frame.key, CIRCULAR);
          continue;
        }
        ancestors.add(props);
        stack.push({ kind: "exit", obj: props });
        const result: Record<string, unknown> = {};
        recordOmitted(result, obj.omitted);
        writeSlot(frame.target, frame.key, result);
        const propEntries = Object.entries(props);
        for (let i = propEntries.length - 1; i >= 0; i--) {
          const [propKey, propValue] = propEntries[i]!;
          stack.push({
            kind: "decode",
            value: propValue,
            target: result,
            key: propKey,
          });
        }
        continue;
      }
      case "error": {
        const error = decodeErrorShell(obj);
        recordOmitted(error, obj.omitted);
        writeSlot(frame.target, frame.key, error);
        const props = obj.props;
        if (typeof props === "object" && props !== null) {
          // The decoded props are written straight onto the Error instance.
          const propEntries = Object.entries(props);
          for (let i = propEntries.length - 1; i >= 0; i--) {
            const [propKey, propValue] = propEntries[i]!;
            stack.push({
              kind: "decode",
              value: propValue,
              target: error as unknown as Record<string, unknown>,
              key: propKey,
            });
          }
        }
        continue;
      }
      case "date":
        if (typeof obj.value === "string") {
          writeSlot(frame.target, frame.key, new Date(obj.value));
        } else {
          writeSlot(frame.target, frame.key, undefined);
        }
        continue;
      case "function":
        writeSlot(frame.target, frame.key, () => undefined);
        continue;
      case "symbol":
        if (typeof obj.value === "string") {
          writeSlot(frame.target, frame.key, Symbol(obj.value));
        } else {
          writeSlot(frame.target, frame.key, undefined);
        }
        continue;
      case "map":
        if (Array.isArray(obj.entries)) {
          const pairs = obj.entries as [unknown, unknown][];
          const entries: [unknown, unknown][] = [];
          stack.push({
            kind: "finalize-map",
            entries,
            omitted: obj.omitted,
            target: frame.target,
            key: frame.key,
          });
          // `pairs` aliases the incoming payload rather than a fresh array, so
          // it must not be reversed in place. Its elements come from a cast of
          // untrusted data and may not be well-formed pairs, hence `?.`.
          for (let i = pairs.length - 1; i >= 0; i--) {
            const sourcePair = pairs[i];
            const pair: [unknown, unknown] = [undefined, undefined];
            entries.push(pair);
            stack.push({
              kind: "decode",
              value: sourcePair?.[1],
              target: pair,
              key: 1,
            });
            stack.push({
              kind: "decode",
              value: sourcePair?.[0],
              target: pair,
              key: 0,
            });
          }
          entries.reverse();
        }
        continue;
      case "set":
        if (Array.isArray(obj.entries)) {
          const items = obj.entries as unknown[];
          const entries: unknown[] = [];
          entries.length = items.length;
          stack.push({
            kind: "finalize-set",
            entries,
            omitted: obj.omitted,
            target: frame.target,
            key: frame.key,
          });
          for (let i = items.length - 1; i >= 0; i--) {
            stack.push({
              kind: "decode",
              value: items[i],
              target: entries,
              key: i,
            });
          }
        }
        continue;
    }

    const result: Record<string, unknown> = {};
    writeSlot(frame.target, frame.key, result);
    const objEntries = Object.entries(obj).reverse();
    for (const [entryKey, entryValue] of objEntries) {
      stack.push({
        kind: "decode",
        value: entryValue,
        target: result,
        key: entryKey,
      });
    }
  }

  return root[0];
}

/**
 * Text for a Map key, used by the key labels and the tree view. Never throws.
 *
 * Primitives go through `String`, which cannot throw for them (symbols
 * included). Objects and functions get a fixed tag instead of being coerced:
 * coercion calls their `toString` / `valueOf`, and decoded page data can carry
 * own non-callable `toString` / `valueOf` keys, or be an array holding a
 * symbol, so `String(key)` would throw a TypeError and take the UI down.
 */
export function formatMapKey(key: unknown): string {
  if (key === CIRCULAR) return "[Circular]";
  if (key === TRUNCATED) return "[Truncated]";
  if (typeof key === "function") return "[Function]";
  if (typeof key === "object" && key !== null) return "[Object]";
  return String(key);
}

/** Text standing for the children a cut container did not receive. */
function omittedText(omitted: number): string {
  return `[${String(omitted)} more truncated]`;
}

/** Key under which a cut object's or Map's label lists its omitted count. */
const OMITTED_LABEL_KEY = "…";

function prepareForStringify(value: unknown): unknown {
  // The viewer's markers read as what they stand for, not as symbols.
  if (value === CIRCULAR) return "[Circular]";
  if (value === TRUNCATED) return "[Truncated]";
  if (typeof value === "bigint") return `__bigint:${String(value)}`;
  if (typeof value === "symbol") return `__symbol:${value.description ?? ""}`;
  if (typeof value === "function") return "__function";
  if (value instanceof Date) return dateToWireString(value);
  const omitted = omittedCount(value);
  if (value instanceof Map) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      writeSlot(result, formatMapKey(k), prepareForStringify(v));
    }
    if (omitted > 0) {
      writeSlot(result, OMITTED_LABEL_KEY, omittedText(omitted));
    }
    return result;
  }
  if (value instanceof Set || Array.isArray(value)) {
    const items = Array.from(value, prepareForStringify);
    if (omitted > 0) items.push(omittedText(omitted));
    return items;
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      writeSlot(result, k, prepareForStringify(v));
    }
    if (omitted > 0) {
      writeSlot(result, OMITTED_LABEL_KEY, omittedText(omitted));
    }
    return result;
  }
  return value;
}

export function stringifyWithBigInt(value: unknown, indent?: number): string {
  return JSON.stringify(prepareForStringify(value), null, indent)
    .replace(/"__bigint:(-?\d+)"/g, "$1n")
    .replace(/"__symbol:(.*?)"/g, "Symbol($1)")
    .replace(/"__function"/g, "fn");
}

const VALID_IDENT = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;

function escapeString(s: string): string {
  return s
    .replace(/\\/g, "\\\\")
    .replace(/"/g, '\\"')
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "\\r")
    .replace(/\t/g, "\\t");
}

/**
 * Brackets item lines that are already indented. A container the page cut
 * short ends with a comment counting the children it did not send, which
 * keeps the literal valid JavaScript.
 */
function literalBlock(
  open: string,
  lines: readonly string[],
  close: string,
  omitted: number,
  indent: number,
): string {
  const body = lines.map((line) => `${line},\n`).join("");
  const note =
    omitted > 0
      ? `${" ".repeat(indent)}/* ${String(omitted)} more truncated */\n`
      : "";
  return `${open}\n${body}${note}${close}`;
}

/** Indents every line of each multi-line item by `indent` spaces. */
function indentItems(items: readonly string[], indent: number): string[] {
  return items.map((item) =>
    item
      .split("\n")
      .map((line) => " ".repeat(indent) + line)
      .join("\n"),
  );
}

export function serializeToJsLiteral(
  value: unknown,
  indent = 2,
  ancestors: ReadonlySet<object> = new Set(),
): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";
  if (value === CIRCULAR) return '"[Circular]"';
  if (value === TRUNCATED) return '"[Truncated]"';

  switch (typeof value) {
    case "string":
      return `"${escapeString(value)}"`;
    case "number":
      if (Number.isNaN(value)) return "NaN";
      if (value === Infinity) return "Infinity";
      if (value === -Infinity) return "-Infinity";
      // `String(-0)` is "0".
      if (Object.is(value, -0)) return "-0";
      return String(value);
    case "boolean":
      return String(value);
    case "bigint":
      return `${String(value)}n`;
    case "symbol":
      return `Symbol("${escapeString(value.description ?? "")}")`;
    case "function":
      return "() => {/* Function export is not supported */}";
  }

  if (ancestors.has(value)) return '"[Circular]"';

  if (value instanceof Error) {
    // Only the message is reproduced; name, stack and extra props are dropped.
    const message = typeof value.message === "string" ? value.message : "";
    return `new Error("${escapeString(message)}")`;
  }

  if (value instanceof Date) {
    // `new Date(NaN)` is the faithful literal for an invalid Date — emitting
    // `new Date("Invalid Date")` would also work, but NaN states the intent.
    if (isInvalidDate(value)) return "new Date(NaN)";
    // `toISOString()` is page-overridable and this literal lands on the user's
    // clipboard, so the result is escaped like every other emitted string.
    return `new Date("${escapeString(value.toISOString())}")`;
  }

  const childAncestors = new Set(ancestors);
  childAncestors.add(value);
  const omitted = omittedCount(value);

  if (value instanceof Map) {
    const mapEntries = Array.from(value.entries());
    if (mapEntries.length === 0 && omitted === 0) return "new Map([])";
    const items = mapEntries.map(
      ([k, v]) =>
        `[${serializeToJsLiteral(k, indent, childAncestors)}, ${serializeToJsLiteral(v, indent, childAncestors)}]`,
    );
    return literalBlock(
      "new Map([",
      indentItems(items, indent),
      "])",
      omitted,
      indent,
    );
  }

  if (value instanceof Set) {
    const members = Array.from(value.values());
    if (members.length === 0 && omitted === 0) return "new Set([])";
    const items = members.map((m) =>
      serializeToJsLiteral(m, indent, childAncestors),
    );
    return literalBlock(
      "new Set([",
      indentItems(items, indent),
      "])",
      omitted,
      indent,
    );
  }

  if (Array.isArray(value)) {
    if (value.length === 0 && omitted === 0) return "[]";
    const items = value.map((item) =>
      serializeToJsLiteral(item, indent, childAncestors),
    );
    return literalBlock("[", indentItems(items, indent), "]", omitted, indent);
  }

  const entries = Object.entries(value as Record<string, unknown>);
  if (entries.length === 0 && omitted === 0) return "{}";

  const lines = entries.map(([key, val]) => {
    // In an object literal, `__proto__: v` sets the prototype whether the key
    // is bare or quoted; only a computed key creates an own property.
    const formattedKey =
      key === "__proto__"
        ? '["__proto__"]'
        : VALID_IDENT.test(key)
          ? key
          : `"${escapeString(key)}"`;
    const serializedVal = serializeToJsLiteral(val, indent, childAncestors);
    const valLines = serializedVal.split("\n");
    if (valLines.length === 1) {
      return `${" ".repeat(indent)}${formattedKey}: ${serializedVal}`;
    }
    const indented = valLines
      .map((line, i) => (i === 0 ? line : " ".repeat(indent) + line))
      .join("\n");
    return `${" ".repeat(indent)}${formattedKey}: ${indented}`;
  });

  return literalBlock("{", lines, "}", omitted, indent);
}
