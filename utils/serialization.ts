interface TypeSentinel {
  readonly __tqcd_type: "bigint" | "date" | "function" | "symbol" | "map" | "set";
  readonly value?: string;
  readonly entries?: readonly unknown[];
}

type WriteTarget = Record<string, unknown> | unknown[];

function writeSlot(target: WriteTarget, key: string | number, val: unknown): void {
  if (typeof key === "number") {
    (target as unknown[])[key] = val;
  } else {
    (target as Record<string, unknown>)[key] = val;
  }
}

interface EncodeFrame {
  value: unknown;
  target: WriteTarget;
  key: string | number;
}

export function encodeBigInts(value: unknown): unknown {
  const root: [unknown] = [undefined];
  const stack: EncodeFrame[] = [{ value, target: root, key: 0 }];
  const seen = new WeakSet<object>();

  while (stack.length > 0) {
    const frame = stack.pop()!;
    const v = frame.value;

    if (v === null || v === undefined) {
      writeSlot(frame.target, frame.key, v);
      continue;
    }

    switch (typeof v) {
      case "bigint":
        writeSlot(frame.target, frame.key, { __tqcd_type: "bigint", value: String(v) } as TypeSentinel);
        continue;
      case "symbol":
        writeSlot(frame.target, frame.key, { __tqcd_type: "symbol", value: v.description ?? "" } as TypeSentinel);
        continue;
      case "function":
        writeSlot(frame.target, frame.key, { __tqcd_type: "function" } as TypeSentinel);
        continue;
      case "string":
      case "number":
      case "boolean":
        writeSlot(frame.target, frame.key, v);
        continue;
    }

    const obj = v as object;
    if (seen.has(obj)) {
      writeSlot(frame.target, frame.key, undefined);
      continue;
    }
    seen.add(obj);

    if (obj instanceof Date) {
      writeSlot(frame.target, frame.key, { __tqcd_type: "date", value: obj.toISOString() } as TypeSentinel);
      continue;
    }

    if (Array.isArray(obj)) {
      const result = new Array<unknown>(obj.length);
      writeSlot(frame.target, frame.key, result);
      for (let i = obj.length - 1; i >= 0; i--) {
        stack.push({ value: obj[i], target: result, key: i });
      }
      continue;
    }

    if (obj instanceof Map) {
      const entries: [unknown, unknown][] = [];
      const sentinel = { __tqcd_type: "map" as const, entries };
      writeSlot(frame.target, frame.key, sentinel);
      const mapEntries = Array.from(obj.entries());
      for (let i = mapEntries.length - 1; i >= 0; i--) {
        const pair: [unknown, unknown] = [undefined, undefined];
        entries.push(pair);
        stack.push({ value: mapEntries[i][1], target: pair, key: 1 });
        stack.push({ value: mapEntries[i][0], target: pair, key: 0 });
      }
      entries.reverse();
      continue;
    }

    if (obj instanceof Set) {
      const entries: unknown[] = [];
      const sentinel = { __tqcd_type: "set" as const, entries };
      writeSlot(frame.target, frame.key, sentinel);
      const setValues = Array.from(obj.values());
      entries.length = setValues.length;
      for (let i = setValues.length - 1; i >= 0; i--) {
        stack.push({ value: setValues[i], target: entries, key: i });
      }
      continue;
    }

    const result: Record<string, unknown> = {};
    writeSlot(frame.target, frame.key, result);
    const objEntries = Object.entries(obj as Record<string, unknown>);
    for (let i = objEntries.length - 1; i >= 0; i--) {
      stack.push({ value: objEntries[i][1], target: result, key: objEntries[i][0] });
    }
  }

  return root[0];
}

interface DecodeFrame {
  kind: "decode";
  value: unknown;
  target: WriteTarget;
  key: string | number;
}

interface FinalizeMapFrame {
  kind: "finalize-map";
  entries: [unknown, unknown][];
  target: WriteTarget;
  key: string | number;
}

interface FinalizeSetFrame {
  kind: "finalize-set";
  entries: unknown[];
  target: WriteTarget;
  key: string | number;
}

export function decodeBigInts(value: unknown): unknown {
  const root: [unknown] = [undefined];
  const stack: (DecodeFrame | FinalizeMapFrame | FinalizeSetFrame)[] = [
    { kind: "decode", value, target: root, key: 0 },
  ];
  const seen = new WeakSet<object>();

  while (stack.length > 0) {
    const frame = stack.pop()!;

    if (frame.kind === "finalize-map") {
      writeSlot(frame.target, frame.key, new Map(frame.entries));
      continue;
    }
    if (frame.kind === "finalize-set") {
      writeSlot(frame.target, frame.key, new Set(frame.entries));
      continue;
    }

    const v = frame.value;

    if (typeof v !== "object" || v === null) {
      writeSlot(frame.target, frame.key, v);
      continue;
    }

    if (seen.has(v)) {
      writeSlot(frame.target, frame.key, undefined);
      continue;
    }
    seen.add(v);

    if (Array.isArray(v)) {
      const result = new Array<unknown>(v.length);
      writeSlot(frame.target, frame.key, result);
      for (let i = v.length - 1; i >= 0; i--) {
        stack.push({ kind: "decode", value: v[i], target: result, key: i });
      }
      continue;
    }

    const obj = v as Record<string, unknown>;

    switch (obj.__tqcd_type) {
      case "bigint":
        if (typeof obj.value === "string") {
          writeSlot(frame.target, frame.key, BigInt(obj.value));
        } else {
          writeSlot(frame.target, frame.key, undefined);
        }
        continue;
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
          stack.push({ kind: "finalize-map", entries, target: frame.target, key: frame.key });
          for (let i = pairs.length - 1; i >= 0; i--) {
            const pair: [unknown, unknown] = [undefined, undefined];
            entries.push(pair);
            stack.push({ kind: "decode", value: pairs[i][1], target: pair, key: 1 });
            stack.push({ kind: "decode", value: pairs[i][0], target: pair, key: 0 });
          }
          entries.reverse();
        }
        continue;
      case "set":
        if (Array.isArray(obj.entries)) {
          const items = obj.entries as unknown[];
          const entries: unknown[] = [];
          entries.length = items.length;
          stack.push({ kind: "finalize-set", entries, target: frame.target, key: frame.key });
          for (let i = items.length - 1; i >= 0; i--) {
            stack.push({ kind: "decode", value: items[i], target: entries, key: i });
          }
        }
        continue;
    }

    const result: Record<string, unknown> = {};
    writeSlot(frame.target, frame.key, result);
    const objEntries = Object.entries(obj);
    for (let i = objEntries.length - 1; i >= 0; i--) {
      stack.push({ kind: "decode", value: objEntries[i][1], target: result, key: objEntries[i][0] });
    }
  }

  return root[0];
}

function prepareForStringify(value: unknown): unknown {
  if (typeof value === "bigint") return `__bigint:${String(value)}`;
  if (typeof value === "symbol") return `__symbol:${value.description ?? ""}`;
  if (typeof value === "function") return "__function";
  if (value instanceof Date) return value.toISOString();
  if (value instanceof Map) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of value.entries()) {
      result[String(k)] = prepareForStringify(v);
    }
    return result;
  }
  if (value instanceof Set) {
    return Array.from(value.values()).map(prepareForStringify);
  }
  if (Array.isArray(value)) return value.map(prepareForStringify);
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = prepareForStringify(v);
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

export function serializeToJsLiteral(
  value: unknown,
  indent = 2,
  ancestors: ReadonlySet<object> = new Set(),
): string {
  if (value === null) return "null";
  if (value === undefined) return "undefined";

  switch (typeof value) {
    case "string":
      return `"${escapeString(value)}"`;
    case "number":
      if (Number.isNaN(value)) return "NaN";
      if (value === Infinity) return "Infinity";
      if (value === -Infinity) return "-Infinity";
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

  // value is object (non-null)
  const obj = value as object;

  if (ancestors.has(obj)) return '"[Circular]"';

  if (obj instanceof Date) {
    return `new Date("${obj.toISOString()}")`;
  }

  const childAncestors = new Set(ancestors);
  childAncestors.add(obj);

  if (obj instanceof Map) {
    const mapEntries = Array.from(obj.entries());
    if (mapEntries.length === 0) return "new Map([])";
    const items = mapEntries.map(
      ([k, v]) => `[${serializeToJsLiteral(k, indent, childAncestors)}, ${serializeToJsLiteral(v, indent, childAncestors)}]`,
    );
    const inner = items.map((item) =>
      item.split("\n").map((line) => " ".repeat(indent) + line).join("\n"),
    ).join(",\n");
    return `new Map([\n${inner},\n])`;
  }

  if (obj instanceof Set) {
    const members = Array.from(obj.values());
    if (members.length === 0) return "new Set([])";
    const items = members.map(
      (m) => serializeToJsLiteral(m, indent, childAncestors),
    );
    const inner = items.map((item) =>
      item.split("\n").map((line) => " ".repeat(indent) + line).join("\n"),
    ).join(",\n");
    return `new Set([\n${inner},\n])`;
  }

  if (Array.isArray(obj)) {
    if (obj.length === 0) return "[]";
    const items = obj.map(
      (item) => serializeToJsLiteral(item, indent, childAncestors),
    );
    const inner = items.map((item) =>
      item.split("\n").map((line) => " ".repeat(indent) + line).join("\n"),
    ).join(",\n");
    return `[\n${inner},\n]`;
  }

  const entries = Object.entries(obj as Record<string, unknown>);
  if (entries.length === 0) return "{}";

  const lines = entries.map(([key, val]) => {
    const formattedKey = VALID_IDENT.test(key) ? key : `"${escapeString(key)}"`;
    const serializedVal = serializeToJsLiteral(val, indent, childAncestors);
    const valLines = serializedVal.split("\n");
    if (valLines.length === 1) {
      return " ".repeat(indent) + `${formattedKey}: ${serializedVal}`;
    }
    const indented = valLines.map((line, i) =>
      i === 0 ? line : " ".repeat(indent) + line,
    ).join("\n");
    return " ".repeat(indent) + `${formattedKey}: ${indented}`;
  });

  return `{\n${lines.join(",\n")},\n}`;
}
