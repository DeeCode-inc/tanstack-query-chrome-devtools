interface TypeSentinel {
  readonly __tqcd_type: "bigint" | "date" | "function" | "symbol" | "map" | "set";
  readonly value?: string;
  readonly entries?: readonly unknown[];
}

export function encodeBigInts(value: unknown): unknown {
  if (typeof value === "bigint") {
    return { __tqcd_type: "bigint", value: String(value) } as TypeSentinel;
  }
  if (typeof value === "symbol") {
    return { __tqcd_type: "symbol", value: value.description ?? "" } as TypeSentinel;
  }
  if (typeof value === "function") {
    return { __tqcd_type: "function" } as TypeSentinel;
  }
  if (Array.isArray(value)) {
    return value.map(encodeBigInts);
  }
  if (value instanceof Map) {
    return {
      __tqcd_type: "map",
      entries: Array.from(value.entries()).map(
        ([k, v]) => [encodeBigInts(k), encodeBigInts(v)] as const,
      ),
    } as TypeSentinel;
  }
  if (value instanceof Set) {
    return {
      __tqcd_type: "set",
      entries: Array.from(value.values()).map(encodeBigInts),
    } as TypeSentinel;
  }
  if (value instanceof Date) {
    return { __tqcd_type: "date", value: value.toISOString() } as TypeSentinel;
  }
  if (typeof value === "object" && value !== null) {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      result[k] = encodeBigInts(v);
    }
    return result;
  }
  return value;
}

export function decodeBigInts(value: unknown): unknown {
  if (typeof value === "object" && value !== null && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    switch (obj.__tqcd_type) {
      case "bigint":
        if (typeof obj.value === "string") return BigInt(obj.value);
        break;
      case "date":
        if (typeof obj.value === "string") return new Date(obj.value);
        break;
      case "function":
        return () => undefined;
      case "symbol":
        if (typeof obj.value === "string") return Symbol(obj.value);
        break;
      case "map":
        if (Array.isArray(obj.entries)) {
          return new Map(
            (obj.entries as [unknown, unknown][]).map(
              ([k, v]) => [decodeBigInts(k), decodeBigInts(v)] as const,
            ),
          );
        }
        break;
      case "set":
        if (Array.isArray(obj.entries)) {
          return new Set(
            (obj.entries as unknown[]).map(decodeBigInts),
          );
        }
        break;
    }
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj)) {
      result[k] = decodeBigInts(v);
    }
    return result;
  }
  if (Array.isArray(value)) {
    return value.map(decodeBigInts);
  }
  return value;
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
