import { describe, expect, it } from "vitest";
import { BRIDGE_SOURCE, type ChangeEvent } from "@/types/messages";
import type { QueryEntry } from "@/types/ui";
import { parseBridgeMessage } from "@/utils/guards";
import {
  CIRCULAR,
  decodeBigInts,
  EncodePass,
  encodeBigInts,
  encodeForWire,
  FIELD_BUDGET_BYTES,
  formatMapKey,
  omittedCount,
  REPEAT_ALLOWANCE_BYTES,
  serializeToJsLiteral,
  stringifyWithBigInt,
  TRUNCATED,
} from "@/utils/serialization";
import { setAtPath } from "@/utils/set-at-path";
import {
  encodeChange,
  encodeMutationEntry,
  encodeQueryEntry,
  encodeQueryEntryForMessage,
} from "@/utils/wire-entities";
import { makeMutation, makeQuery } from "./fixtures";

type Rec = Record<string, unknown>;

/**
 * The trip a value takes from the inspected page to a viewer: encoded in the
 * page, carried as JSON (how a Chrome extension port transfers a message), and
 * decoded in the viewer.
 */
function roundTrip(value: unknown): unknown {
  return decodeBigInts(JSON.parse(JSON.stringify(encodeBigInts(value))));
}

/** `roundTrip` under an explicit budget. */
function roundTripWithin(value: unknown, budgetBytes: number): unknown {
  const { value: wire } = encodeForWire(value, budgetBytes);
  return decodeBigInts(JSON.parse(JSON.stringify(wire)));
}

/** What a Chrome extension port measures: the UTF-8 size of the JSON. */
function jsonUtf8Bytes(value: unknown): number {
  return new TextEncoder().encode(JSON.stringify(value)).length;
}

/** Reads an own `__proto__` data property, never the inherited accessor. */
function ownProto(value: object): unknown {
  return Object.getOwnPropertyDescriptor(value, "__proto__")?.value;
}

describe("shared references", () => {
  it("encodes an object shared by two siblings at both places", () => {
    const shared = { id: 1, tags: ["a"] };
    const out = roundTrip({ a: shared, b: shared }) as Rec;
    expect(out.a).toEqual(shared);
    expect(out.b).toEqual(shared);
  });

  it("keeps query data that also appears under state.data", () => {
    const data = { items: [1, 2] };
    expect(roundTrip({ data, state: { data } })).toEqual({
      data: { items: [1, 2] },
      state: { data: { items: [1, 2] } },
    });
  });
});

describe("cycles", () => {
  it("replaces a self reference with CIRCULAR and keeps the siblings", () => {
    const root: Rec = { name: "root", sibling: { x: 1 } };
    root.self = root;
    expect(roundTrip(root)).toEqual({
      name: "root",
      sibling: { x: 1 },
      self: CIRCULAR,
    });
  });

  it("marks only the reference that closes the cycle", () => {
    const parent: Rec = { label: "parent" };
    parent.child = { parent };
    expect(roundTrip(parent)).toEqual({
      label: "parent",
      child: { parent: CIRCULAR },
    });
  });

  it("handles cycles through arrays and Map values", () => {
    const list: unknown[] = [1];
    list.push(list);
    expect(roundTrip(list)).toEqual([1, CIRCULAR]);

    const map = new Map<string, unknown>();
    map.set("me", map);
    const out = roundTrip(map) as Map<string, unknown>;
    expect(out.get("me")).toBe(CIRCULAR);
  });

  it("decodes a cyclic structured-clone payload into an acyclic value", () => {
    const payload: Rec = { a: 1 };
    payload.self = payload;
    expect(decodeBigInts(structuredClone(payload))).toEqual({
      a: 1,
      self: CIRCULAR,
    });
  });
});

describe("errors", () => {
  it("round-trips name, message, stack, props and cause", () => {
    const cause = new Error("inner");
    const error = Object.assign(new TypeError("outer", { cause }), {
      status: 404,
    });

    const out = roundTrip(error);

    expect(out).toBeInstanceOf(Error);
    const decoded = out as Error & Rec;
    expect(decoded.name).toBe("TypeError");
    expect(decoded.message).toBe("outer");
    expect(decoded.stack).toBe(error.stack);
    expect(decoded.status).toBe(404);
    expect(decoded.cause).toBeInstanceOf(Error);
    expect((decoded.cause as Error).message).toBe("inner");
  });

  it("defines name and stack as non-enumerable, props as enumerable", () => {
    const error = Object.assign(new Error("m", { cause: "why" }), { code: 1 });
    const decoded = roundTrip(error) as Error;
    expect(Object.keys(decoded)).toEqual(["code", "cause"]);
    expect(Object.getOwnPropertyDescriptor(decoded, "name")?.enumerable).toBe(
      false,
    );
    expect(Object.getOwnPropertyDescriptor(decoded, "stack")?.enumerable).toBe(
      false,
    );
  });

  it("decodes an error nested inside data", () => {
    const out = roundTrip({ err: new RangeError("bad") }) as Rec;
    expect(out.err).toBeInstanceOf(Error);
    expect((out.err as Error).name).toBe("RangeError");
  });

  it("omits the stack key when the stack is not a string", () => {
    const error = new Error("m");
    Object.defineProperty(error, "stack", { value: 42, configurable: true });
    const encoded = encodeBigInts(error) as Rec;
    expect(encoded.__tqcd_type).toBe("error");
    expect(Object.hasOwn(encoded, "stack")).toBe(false);
  });

  it("recognises an error by its tag when instanceof fails", () => {
    const foreign = { message: "cross-realm", [Symbol.toStringTag]: "Error" };
    const out = roundTrip(foreign);
    expect(out).toBeInstanceOf(Error);
    expect((out as Error).message).toBe("cross-realm");
  });
});

describe("special numbers", () => {
  const cases: [string, number][] = [
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["-Infinity", Number.NEGATIVE_INFINITY],
    ["-0", -0],
  ];

  it.each(cases)("round-trips %s", (_label, value) => {
    expect(Object.is(roundTrip(value), value)).toBe(true);
    expect(Object.is((roundTrip({ value }) as Rec).value, value)).toBe(true);
    expect(Object.is((roundTrip([value]) as unknown[])[0], value)).toBe(true);
  });

  it("leaves ordinary numbers as plain JSON numbers", () => {
    expect(encodeBigInts({ a: 1.5, b: 0 })).toEqual({ a: 1.5, b: 0 });
  });

  it("decodes an unknown number label to undefined", () => {
    expect(
      decodeBigInts({ __tqcd_type: "number", value: "1e3" }),
    ).toBeUndefined();
  });
});

describe("undefined", () => {
  it("round-trips undefined at the root", () => {
    expect(roundTrip(undefined)).toBeUndefined();
  });

  it("keeps an object key whose value is undefined", () => {
    const out = roundTrip({ a: undefined, b: 1 }) as Rec;
    expect(Object.hasOwn(out, "a")).toBe(true);
    expect(out.a).toBeUndefined();
  });

  it("keeps an undefined array slot", () => {
    const out = roundTrip([1, undefined, 3]) as unknown[];
    expect(out).toHaveLength(3);
    expect(Object.hasOwn(out, 1)).toBe(true);
    expect(out[1]).toBeUndefined();
  });

  it("keeps undefined Map values and Set members", () => {
    const map = roundTrip(new Map([["k", undefined]])) as Map<string, unknown>;
    expect(map.has("k")).toBe(true);
    expect(map.get("k")).toBeUndefined();
    const set = roundTrip(new Set([undefined])) as Set<unknown>;
    expect(set.has(undefined)).toBe(true);
  });
});

describe("bigint", () => {
  const cases: bigint[] = [0n, 123n, -45n, 2n ** 70n];

  it.each(cases)("round-trips %s", (value) => {
    expect(roundTrip(value)).toBe(value);
  });

  const malformed: unknown[] = ["abc", "1.5", "", " 1", "1n", 12, null];

  it.each(malformed)(
    "decodes a bigint sentinel with value %j to undefined",
    (value) => {
      let out: unknown;
      expect(() => {
        out = decodeBigInts({ v: { __tqcd_type: "bigint", value } });
      }).not.toThrow();
      expect(Object.hasOwn(out as Rec, "v")).toBe(true);
      expect((out as Rec).v).toBeUndefined();
    },
  );
});

describe("dates", () => {
  it("round-trips a valid Date", () => {
    const date = new Date("2024-01-02T03:04:05.678Z");
    const out = roundTrip(date);
    expect(out).toBeInstanceOf(Date);
    expect((out as Date).getTime()).toBe(date.getTime());
  });

  it("round-trips an invalid Date without throwing", () => {
    const invalid = new Date("nope");
    let out: unknown;
    expect(() => {
      out = roundTrip({ invalid });
    }).not.toThrow();
    const decoded = (out as Rec).invalid;
    expect(decoded).toBeInstanceOf(Date);
    expect(Number.isNaN((decoded as Date).getTime())).toBe(true);
  });
});

describe("Map and Set", () => {
  it("round-trips a Map with number, string and object keys in order", () => {
    const objectKey = { id: 1 };
    const map = new Map<unknown, unknown>([
      [1, "number one"],
      [objectKey, "object"],
      ["1", "string one"],
    ]);

    const out = roundTrip(map) as Map<unknown, unknown>;

    expect(out).toBeInstanceOf(Map);
    expect(out.size).toBe(3);
    expect(out.get(1)).toBe("number one");
    expect(out.get("1")).toBe("string one");
    const keys = Array.from(out.keys());
    expect(keys[0]).toBe(1);
    expect(keys[1]).toEqual(objectKey);
    expect(out.get(keys[1])).toBe("object");
    expect(keys[2]).toBe("1");
  });

  it("round-trips a Set with its members in order", () => {
    const out = roundTrip(new Set<unknown>([3, "a", { x: 1 }, 1n]));
    expect(out).toBeInstanceOf(Set);
    expect(Array.from(out as Set<unknown>)).toEqual([3, "a", { x: 1 }, 1n]);
  });

  it("round-trips containers nested in each other", () => {
    const value = [new Set([new Map([["k", [1n, -0]]])])];
    const out = roundTrip(value) as [Set<Map<string, [bigint, number]>>];
    const map = Array.from(out[0])[0];
    expect(map).toBeInstanceOf(Map);
    expect(map?.get("k")?.[0]).toBe(1n);
    expect(Object.is(map?.get("k")?.[1], -0)).toBe(true);
  });
});

describe("functions and symbols", () => {
  it("decodes a function to a function and a symbol to a symbol", () => {
    const out = roundTrip({ fn: () => 1, sym: Symbol("tag") }) as Rec;
    expect(typeof out.fn).toBe("function");
    expect(typeof out.sym).toBe("symbol");
    expect((out.sym as symbol).description).toBe("tag");
  });
});

describe("untrusted wire data", () => {
  const malformed: Rec[] = [
    { __tqcd_type: "map", entries: [null, 5, [1]] },
    { __tqcd_type: "map", entries: "nope" },
    { __tqcd_type: "set", entries: 3 },
    { __tqcd_type: "date", value: 5 },
    { __tqcd_type: "symbol", value: 5 },
    { __tqcd_type: "error" },
    { __tqcd_type: "error", name: 5, message: {}, props: "x" },
    { __tqcd_type: "number", value: "NaN!" },
    { __tqcd_type: "truncated", omitted: "x", props: 5 },
    { __tqcd_type: "truncated", omitted: -1, props: {} },
    { __tqcd_type: "truncated", omitted: 2, props: [1] },
    { __tqcd_type: "map", entries: [], omitted: 1e300 },
    { __tqcd_type: "set", entries: [], omitted: "3" },
    { __tqcd_type: "error", message: "m", props: {}, omitted: Number.NaN },
  ];

  it.each(malformed)("decodes %j without throwing", (payload) => {
    expect(() => decodeBigInts({ payload })).not.toThrow();
  });

  it("keeps an own __proto__ key as data and the prototype untouched", () => {
    const page = JSON.parse('{"__proto__":{"a":1},"b":2}') as Rec;
    const out = roundTrip(page) as Rec;
    expect(Object.hasOwn(out, "__proto__")).toBe(true);
    expect(Object.getPrototypeOf(out)).toBe(Object.prototype);
    expect(ownProto(out)).toEqual({ a: 1 });
    expect(out.b).toBe(2);
    expect(({} as Rec).a).toBeUndefined();
  });

  it("does not let a sentinel under __proto__ replace the prototype", () => {
    const forged = JSON.parse(
      '[{"__proto__":{"__tqcd_type":"map","entries":[]}}]',
    ) as unknown;
    const item = (decodeBigInts(forged) as Rec[])[0]!;
    expect(Object.getPrototypeOf(item)).toBe(Object.prototype);
    expect(item).not.toBeInstanceOf(Map);
    expect(ownProto(item)).toBeInstanceOf(Map);
  });

  it("keeps a decoded error an Error when its props hold __proto__", () => {
    const forged = JSON.parse(
      '{"__tqcd_type":"error","name":"E","message":"m","props":{"__proto__":{"x":1}}}',
    ) as unknown;
    const out = decodeBigInts(forged) as Error;
    expect(Object.getPrototypeOf(out)).toBe(Error.prototype);
    expect(ownProto(out)).toEqual({ x: 1 });
  });

  it("keeps an own __proto__ key in labels and JS literals", () => {
    const page = JSON.parse('{"__proto__":{"a":1}}') as unknown;
    expect(stringifyWithBigInt(page)).toBe('{"__proto__":{"a":1}}');
    expect(serializeToJsLiteral(page)).toBe(
      '{\n  ["__proto__"]: {\n    a: 1,\n  },\n}',
    );
  });
});

describe("formatMapKey", () => {
  const primitives: unknown[] = [1, -0, Number.NaN, "k", true, null, 5n];

  it.each(primitives)("formats the primitive %s like String()", (key) => {
    expect(formatMapKey(key)).toBe(String(key));
  });

  it("formats undefined and symbols like String()", () => {
    expect(formatMapKey(undefined)).toBe("undefined");
    expect(formatMapKey(Symbol("s"))).toBe("Symbol(s)");
  });

  it("tags objects and functions without coercing them", () => {
    const hostile = { toString: 1, valueOf: 1 };
    expect(formatMapKey(hostile)).toBe("[Object]");
    expect(formatMapKey([Symbol("x")])).toBe("[Object]");
    expect(formatMapKey(new Date(0))).toBe("[Object]");
    expect(formatMapKey(() => 1)).toBe("[Function]");
  });

  it("labels a decoded Map key whose toString is not callable", () => {
    const payload = JSON.parse(
      '["fx-mapkey",{"__tqcd_type":"map","entries":[[{"toString":1},1]]}]',
    ) as unknown;
    expect(stringifyWithBigInt(decodeBigInts(payload))).toBe(
      '["fx-mapkey",{"[Object]":1}]',
    );
  });
});

describe("stringifyWithBigInt", () => {
  it("writes bigints, symbols and functions in readable form", () => {
    expect(stringifyWithBigInt([1n, Symbol("s"), () => 1])).toBe(
      "[1n,Symbol(s),fn]",
    );
  });
});

describe("serializeToJsLiteral", () => {
  it("writes -0 and the other special numbers", () => {
    expect(serializeToJsLiteral(-0)).toBe("-0");
    expect(serializeToJsLiteral(Number.NaN)).toBe("NaN");
    expect(serializeToJsLiteral(Number.NEGATIVE_INFINITY)).toBe("-Infinity");
  });

  it("writes an Error as a constructor call with an escaped message", () => {
    const literal = serializeToJsLiteral(new Error('say "hi"'));
    expect(literal.startsWith("new Error(")).toBe(true);
    expect(literal).toBe('new Error("say \\"hi\\"")');
  });

  it("writes CIRCULAR and live cycles as [Circular]", () => {
    expect(serializeToJsLiteral(CIRCULAR)).toBe('"[Circular]"');
    const root: Rec = {};
    root.self = root;
    expect(serializeToJsLiteral(root)).toBe('{\n  self: "[Circular]",\n}');
  });

  it("writes bigints and dates", () => {
    expect(serializeToJsLiteral(5n)).toBe("5n");
    expect(serializeToJsLiteral(new Date("nope"))).toBe("new Date(NaN)");
    expect(serializeToJsLiteral(new Date(0))).toBe(
      'new Date("1970-01-01T00:00:00.000Z")',
    );
  });
});

// === Encoding budget ===

/** Nodes linked both ways, so each node is reachable along many paths. */
function doublyLinkedList(n: number): Rec[] {
  const nodes: Rec[] = Array.from({ length: n }, (_, i) => ({ id: i }));
  nodes.forEach((node, i) => {
    node.prev = nodes[i - 1] ?? null;
    node.next = nodes[i + 1] ?? null;
  });
  return nodes;
}

/** A d3-hierarchy-like tree: `parent` and `children` links plus a flat list. */
function d3Hierarchy(n: number): Rec {
  const nodes: Rec[] = [{ id: 0, parent: null, children: [] }];
  for (let i = 1; i < n; i++) {
    const parent = nodes[Math.floor((i - 1) / 2)]!;
    const node: Rec = { id: i, parent, children: [] };
    (parent.children as Rec[]).push(node);
    nodes.push(node);
  }
  return { root: nodes[0], descendants: nodes };
}

/** Every node lists every other node. */
function completeGraph(n: number): Rec[] {
  const nodes: Rec[] = Array.from({ length: n }, (_, i) => ({ id: i }));
  for (const node of nodes) node.neighbours = nodes.filter((o) => o !== node);
  return nodes;
}

/** Each level references the one below twice: 2^depth root-to-leaf paths. */
function binaryDag(depth: number): unknown {
  let node: unknown = { leaf: true };
  for (let i = 0; i < depth; i++) node = { a: node, b: node };
  return node;
}

/** Ten fields of the usual kinds per row. */
function tableRows(n: number): Rec[] {
  return Array.from({ length: n }, (_, i) => ({
    id: i,
    name: `Item ${i}`,
    email: `user${i}@example.com`,
    active: i % 2 === 0,
    score: i * 1.25,
    createdAt: new Date(1_700_000_000_000 + i * 1000),
    tags: ["alpha", "beta"],
    city: "Zürich",
    count: i * 7,
    note: null,
  }));
}

/** Encodes with the default budget and reports how long it took. */
function timedEncode(value: unknown) {
  const start = performance.now();
  const result = encodeForWire(value);
  return { ...result, elapsedMs: performance.now() - start };
}

describe("encoding budget", () => {
  // Without a budget, each of these takes seconds to forever and gigabytes.
  const pathological: [string, () => unknown][] = [
    ["a doubly linked list", () => doublyLinkedList(5000)],
    ["a d3-style hierarchy", () => d3Hierarchy(5000)],
    ["a complete graph", () => completeGraph(12)],
    ["a binary DAG", () => binaryDag(40)],
    ["a huge array", () => Array.from({ length: 3_000_000 }, (_, i) => i)],
    ["a huge sparse array", () => new Array(1e9)],
    [
      "a huge Map",
      () => new Map(Array.from({ length: 1_000_000 }, (_, i) => [i, i])),
    ],
    ["a huge string", () => "x".repeat(64 * 1024 * 1024)],
  ];

  it.each(pathological)("bounds the output and the time of %s", (_, make) => {
    const value = make();
    const result = timedEncode(value);
    expect(result.truncated).toBe(true);
    expect(result.utf8Bytes).toBeLessThanOrEqual(FIELD_BUDGET_BYTES);
    expect(jsonUtf8Bytes(result.value)).toBe(result.utf8Bytes);
    // Tens of milliseconds locally; the bound only leaves room for slow CI.
    expect(result.elapsedMs).toBeLessThan(1000);
  });

  it("does not walk the children of a container met when the budget is spent", () => {
    const list = Array.from({ length: 1_000_000 }, (_, i) => i);
    const pad = "x".repeat(FIELD_BUDGET_BYTES - 1000);
    const start = performance.now();
    const { value } = encodeForWire({ pad, list });
    const elapsedMs = performance.now() - start;
    const decoded = decodeBigInts(value) as { pad: string; list: number[] };
    expect(decoded.pad).toBe(pad);
    expect(decoded.list.length + omittedCount(decoded.list)).toBe(list.length);
    expect(decoded.list.length).toBeLessThan(1000);
    expect(elapsedMs).toBeLessThan(200);
  });

  it("cuts a huge string in place and keeps its siblings", () => {
    const blob = "x".repeat(FIELD_BUDGET_BYTES);
    const result = timedEncode({ blob, id: 1, tags: ["a"] });
    expect(result.value).toEqual({
      blob: { __tqcd_type: "truncated" },
      id: 1,
      tags: ["a"],
    });
    expect(decodeBigInts(result.value)).toEqual({
      blob: TRUNCATED,
      id: 1,
      tags: ["a"],
    });
    expect(result.elapsedMs).toBeLessThan(100);
  });

  it("caps nesting so that posting, labelling and copying cannot overflow the stack", () => {
    let chain: unknown = { end: true };
    for (let i = 0; i < 20_000; i++) chain = { next: new Map([["k", chain]]) };
    const { value, truncated } = encodeForWire(chain);
    expect(truncated).toBe(true);
    expect(() => structuredClone(value)).not.toThrow();
    expect(() => JSON.stringify(value)).not.toThrow();
    const decoded = decodeBigInts(value);
    expect(() => serializeToJsLiteral(decoded)).not.toThrow();
    expect(() => stringifyWithBigInt([decoded])).not.toThrow();

    let node = decoded;
    let levels = 0;
    while (typeof node === "object" && node !== null) {
      node = ((node as Rec).next as Map<string, unknown>).get("k");
      levels++;
    }
    expect(node).toBe(TRUNCATED);
    expect(levels).toBeGreaterThan(100);
    expect(levels).toBeLessThan(200);
  });

  it("keeps nesting of a hundred levels whole", () => {
    let chain: unknown = { end: true };
    for (let i = 0; i < 100; i++) chain = { next: [chain] };
    expect(encodeForWire(chain).truncated).toBe(false);
    expect(roundTrip(chain)).toEqual(chain);
  });

  it("keeps ordinary large data whole", () => {
    const rows = tableRows(20_000);
    const result = encodeForWire(rows);
    expect(result.truncated).toBe(false);
    expect(JSON.stringify(result.value)).toBe(
      JSON.stringify(encodeForWire(rows, Number.POSITIVE_INFINITY).value),
    );
    expect(roundTrip(rows)).toEqual(rows);
  });
});

describe("under budget", () => {
  it("duplicates shared objects and marks cycles, exactly as before", () => {
    const shared = { id: 1, tags: ["a"] };
    const root: Rec = { a: shared, b: [shared, shared] };
    root.self = root;
    const result = encodeForWire(root);
    expect(result.truncated).toBe(false);
    expect(result.value).toEqual({
      a: { id: 1, tags: ["a"] },
      b: [
        { id: 1, tags: ["a"] },
        { id: 1, tags: ["a"] },
      ],
      self: { __tqcd_type: "circular" },
    });
    expect(encodeBigInts(root)).toEqual(result.value);
  });

  it("writes no truncation marker", () => {
    const value = {
      map: new Map([[{ k: 1 }, new Set([1n, Number.NaN])]]),
      error: Object.assign(new Error("e", { cause: "c" }), { code: 1 }),
      list: [undefined, -0, new Date(0), Symbol("s"), () => 1],
    };
    const result = encodeForWire(value);
    expect(result.truncated).toBe(false);
    expect(JSON.stringify(result.value)).not.toContain("truncated");
    expect(JSON.stringify(result.value)).not.toContain("omitted");
  });
});

describe("truncation", () => {
  it("ends a cut array with a marker counting the items left out", () => {
    const items = Array.from({ length: 1000 }, (_, i) => i);
    const { value } = encodeForWire(items, 1000);
    const wire = value as unknown[];
    const shown = wire.length - 1;
    expect(wire.at(-1)).toEqual({
      __tqcd_type: "truncated",
      omitted: items.length - shown,
    });

    const decoded = roundTripWithin(items, 1000) as number[];
    expect(decoded).toEqual(items.slice(0, shown));
    expect(omittedCount(decoded)).toBe(items.length - shown);
  });

  it("wraps a cut object and decodes it to a plain object with its first keys", () => {
    const record = Object.fromEntries(
      Array.from({ length: 1000 }, (_, i) => [`key${i}`, i]),
    );
    const { value } = encodeForWire(record, 1000);
    expect((value as Rec).__tqcd_type).toBe("truncated");

    const decoded = roundTripWithin(record, 1000) as Rec;
    expect(Object.getPrototypeOf(decoded)).toBe(Object.prototype);
    const keys = Object.keys(decoded);
    expect(keys).toEqual(Object.keys(record).slice(0, keys.length));
    expect(keys.length + omittedCount(decoded)).toBe(1000);
  });

  it("records the omitted children of a Map, a Set and an Error", () => {
    const n = 1000;
    const map = roundTripWithin(
      new Map(Array.from({ length: n }, (_, i) => [i, i])),
      1000,
    ) as Map<number, number>;
    expect(map).toBeInstanceOf(Map);
    expect(map.size + omittedCount(map)).toBe(n);
    expect(Array.from(map.keys())).toEqual(
      Array.from({ length: map.size }, (_, i) => i),
    );

    const set = roundTripWithin(
      new Set(Array.from({ length: n }, (_, i) => i)),
      1000,
    ) as Set<number>;
    expect(set).toBeInstanceOf(Set);
    expect(set.size + omittedCount(set)).toBe(n);

    const error = Object.assign(
      new Error("big"),
      Object.fromEntries(Array.from({ length: n }, (_, i) => [`p${i}`, i])),
    );
    error.stack = "short";
    const decodedError = roundTripWithin(error, 1000) as Error;
    expect(decodedError).toBeInstanceOf(Error);
    expect(decodedError.message).toBe("big");
    expect(Object.keys(decodedError).length + omittedCount(decodedError)).toBe(
      n,
    );
  });

  it("cuts a Map or Set before a key or member that does not fit", () => {
    // Two truncated keys would decode to the same TRUNCATED key and merge.
    const big = "x".repeat(2000);
    const map = roundTripWithin(
      new Map([
        ["a", 1],
        [big, 2],
        [`${big}!`, 3],
      ]),
      1000,
    ) as Map<string, number>;
    expect(Array.from(map)).toEqual([["a", 1]]);
    expect(omittedCount(map)).toBe(2);

    const set = roundTripWithin(new Set(["a", big, `${big}!`]), 1000);
    expect(Array.from(set as Set<string>)).toEqual(["a"]);
    expect(omittedCount(set)).toBe(2);

    // A Map value can be truncated in place: it is addressed by position.
    const values = roundTripWithin(
      new Map<string, unknown>([
        ["k", big],
        ["l", 1],
      ]),
      1000,
    );
    expect(Array.from(values as Map<string, unknown>)).toEqual([
      ["k", TRUNCATED],
      ["l", 1],
    ]);
  });

  it("decodes the same through structured clone as through JSON", () => {
    const value = { list: doublyLinkedList(50), meta: new Map([[1, "x"]]) };
    const { value: wire } = encodeForWire(value, 2000);
    expect(decodeBigInts(structuredClone(wire))).toEqual(
      decodeBigInts(JSON.parse(JSON.stringify(wire))),
    );
  });

  it("treats a tail marker that is not the last item as a truncated value", () => {
    const decoded = decodeBigInts([
      { __tqcd_type: "truncated", omitted: 3 },
      1,
    ]);
    expect(decoded).toEqual([TRUNCATED, 1]);
    expect(omittedCount(decoded)).toBe(0);
  });

  it("never sends more than the budget, whatever gets cut", () => {
    const value = {
      graph: completeGraph(6),
      deep: binaryDag(12),
      text: "日本語のテキスト".repeat(50),
      map: new Map([[{ id: 1 }, doublyLinkedList(20)]]),
    };
    for (const budget of [256, 500, 1000, 5000, 20_000]) {
      const result = encodeForWire(value, budget);
      expect(result.truncated).toBe(true);
      expect(jsonUtf8Bytes(result.value)).toBe(result.utf8Bytes);
      expect(result.utf8Bytes).toBeLessThanOrEqual(budget);
    }
  });
});

describe("size estimate", () => {
  const shapes: [string, unknown][] = [
    ["ASCII", { a: "plain", b: 1.5, c: true, d: null, e: [1, 2, 3] }],
    [
      "escapes",
      ['q"uote', "back\\slash", "\n\t\r\b\f", "\u0001\u001f", "\u007f"],
    ],
    ["two-byte", { clé: "Zürich", ключ: "значение" }],
    ["three-byte", ["日本語", "漢字", "€"]],
    ["four-byte", ["😀", "𝄞", { "🔑": "🌍" }]],
    ["lone surrogates", ["\ud800", "x\udc00", "\udbff\udfff\ud800"]],
    [
      "sentinels",
      [
        undefined,
        Number.NaN,
        -0,
        Number.NEGATIVE_INFINITY,
        123n,
        -(2n ** 80n),
        Symbol("ünïcode"),
        () => 1,
        new Date(0),
        new Date("nope"),
      ],
    ],
    [
      "containers",
      {
        map: new Map<unknown, unknown>([
          [{ k: "ключ" }, new Set(["a", 1])],
          ["b", []],
        ]),
        error: Object.assign(new TypeError("ошибка", { cause: "原因" }), {
          code: 7,
        }),
        nested: [[[{}]]],
      },
    ],
    ["__proto__ key", JSON.parse('{"__proto__":{"a":1},"b":2}')],
    ["numbers", [0, 1e21, 1e-7, Number.MAX_VALUE, Number.MIN_VALUE, -42.5]],
  ];

  it.each(shapes)("is exact for %s", (_, value) => {
    const result = encodeForWire(value);
    expect(result.truncated).toBe(false);
    expect(result.utf8Bytes).toBe(jsonUtf8Bytes(result.value));
  });

  it("is exact for cut non-ASCII data", () => {
    const value = {
      words: Array.from({ length: 500 }, (_, i) => `слово-${i}-漢字-😀`),
      blob: "日本語".repeat(10_000),
    };
    for (const budget of [300, 1000, 4000, 50_000]) {
      const result = encodeForWire(value, budget);
      expect(result.truncated).toBe(true);
      expect(result.utf8Bytes).toBe(jsonUtf8Bytes(result.value));
      expect(result.utf8Bytes).toBeLessThanOrEqual(budget);
    }
  });

  it("is exact for a string over the budget", () => {
    // 3 bytes per character: within the budget in characters, not in bytes.
    const blob = "漢".repeat(FIELD_BUDGET_BYTES / 2);
    const result = encodeForWire(blob);
    expect(result.value).toEqual({ __tqcd_type: "truncated" });
    expect(result.utf8Bytes).toBe(jsonUtf8Bytes(result.value));
  });
});

describe("viewer helpers on truncated values", () => {
  const cutArray = decodeBigInts([
    1,
    2,
    { __tqcd_type: "truncated", omitted: 5 },
  ]);
  const cutObject = decodeBigInts({
    __tqcd_type: "truncated",
    omitted: 3,
    props: { a: 1 },
  });
  const cutMap = decodeBigInts({
    __tqcd_type: "map",
    entries: [["k", 1]],
    omitted: 2,
  });
  const emptyCut = decodeBigInts({
    __tqcd_type: "truncated",
    omitted: 4,
    props: {},
  });

  it("writes cut containers as valid literals ending in a comment", () => {
    expect(serializeToJsLiteral(cutArray)).toBe(
      "[\n  1,\n  2,\n  /* 5 more truncated */\n]",
    );
    expect(serializeToJsLiteral(cutObject)).toBe(
      "{\n  a: 1,\n  /* 3 more truncated */\n}",
    );
    expect(serializeToJsLiteral(cutMap)).toBe(
      'new Map([\n  ["k", 1],\n  /* 2 more truncated */\n])',
    );
    expect(serializeToJsLiteral(emptyCut)).toBe(
      "{\n  /* 4 more truncated */\n}",
    );
    expect(serializeToJsLiteral({ v: TRUNCATED })).toBe(
      '{\n  v: "[Truncated]",\n}',
    );
  });

  it("labels truncated values and cut containers", () => {
    expect(stringifyWithBigInt(["k", TRUNCATED, CIRCULAR])).toBe(
      '["k","[Truncated]","[Circular]"]',
    );
    expect(stringifyWithBigInt(cutArray)).toBe('[1,2,"[5 more truncated]"]');
    expect(stringifyWithBigInt(cutObject)).toBe(
      '{"a":1,"…":"[3 more truncated]"}',
    );
    expect(formatMapKey(TRUNCATED)).toBe("[Truncated]");
    expect(formatMapKey(CIRCULAR)).toBe("[Circular]");
  });
});

// === Entity encoding ===

describe("entity encoding", () => {
  const big = "x".repeat(FIELD_BUDGET_BYTES + 1);
  const baseState = makeQuery("q").state;

  /**
   * A query whose every user-data field is over budget. The graph-shaped
   * fields are the costly ones to encode, so they are only built on request;
   * otherwise those fields are just a string over budget.
   */
  function oversizedQuery({ graphs = false } = {}) {
    return makeQuery('["q",1]', {
      queryKey: ["q", big],
      observerCount: 2,
      status: "stale",
      dataUpdatedAt: 1234,
      isActive: true,
      meta: graphs ? { graph: completeGraph(10) } : { big },
      state: {
        ...baseState,
        data: graphs ? doublyLinkedList(3000) : big,
        dataUpdatedAt: 1234,
        error: new Error(big),
        fetchFailureReason: graphs ? binaryDag(30) : big,
        fetchMeta: {
          __previousQueryOptions: true,
          pad: "x".repeat(FIELD_BUDGET_BYTES - 150),
          ...Object.fromEntries(
            Array.from({ length: 100 }, (_, i) => [`k${i}`, i]),
          ),
        },
        status: "error",
        fetchStatus: "fetching",
      },
    });
  }

  function oversizedMutation({ graphs = false } = {}) {
    const mutation = makeMutation(7, { status: "pending", submittedAt: 99 });
    return {
      ...mutation,
      mutationKey: ["save", big],
      state: {
        ...mutation.state,
        variables: graphs ? d3Hierarchy(3000) : big,
        context: { big },
        data: big,
        error: new Error(big),
        failureReason: [big],
      },
    };
  }

  it("keeps the entry structure guard-valid when every user field is cut", () => {
    const query = oversizedQuery({ graphs: true });
    const mutation = oversizedMutation({ graphs: true });
    const encodedQuery = encodeQueryEntry(query);
    const encodedMutation = encodeMutationEntry(mutation);
    expect(encodedQuery.truncated).toBe(true);
    expect(encodedMutation.truncated).toBe(true);
    expect(jsonUtf8Bytes(encodedQuery.value)).toBe(encodedQuery.utf8Bytes);
    expect(jsonUtf8Bytes(encodedMutation.value)).toBe(
      encodedMutation.utf8Bytes,
    );

    const message = parseBridgeMessage(
      JSON.parse(
        JSON.stringify({
          source: BRIDGE_SOURCE,
          type: "SYNC_SNAPSHOT",
          payload: {
            snapshotId: 1,
            chunkIndex: 0,
            chunkCount: 1,
            queries: [encodedQuery.value],
            mutations: [encodedMutation.value],
          },
        }),
      ),
    );
    expect(message?.type).toBe("SYNC_SNAPSHOT");
    if (message?.type !== "SYNC_SNAPSHOT") return;

    const decodedQuery = decodeBigInts(message.payload.queries[0]) as Rec &
      typeof query;
    expect(decodedQuery).toMatchObject({
      queryHash: query.queryHash,
      observerCount: 2,
      status: "stale",
      dataUpdatedAt: 1234,
      isActive: true,
      isDisabled: false,
      state: { status: "error", fetchStatus: "fetching", dataUpdatedAt: 1234 },
    });
    expect(decodedQuery.queryKey).toEqual(["q", TRUNCATED]);
    expect(decodedQuery.state.error).toBe(TRUNCATED);
    expect(omittedCount(decodedQuery.state.data)).toBeGreaterThan(0);
    // `fetchMeta` itself is cut: it stays a record and keeps the marker the
    // action buttons read.
    const fetchMeta = decodedQuery.state.fetchMeta;
    expect(fetchMeta?.__previousQueryOptions).toBe(true);
    expect(omittedCount(fetchMeta)).toBeGreaterThan(0);

    const decodedMutation = decodeBigInts(
      message.payload.mutations[0],
    ) as typeof mutation;
    expect(decodedMutation).toMatchObject({
      mutationId: 7,
      status: "pending",
      timestamp: 99,
      state: { status: "pending", submittedAt: 99 },
    });
    expect(decodedMutation.mutationKey).toEqual(["save", TRUNCATED]);
    expect(decodedMutation.state.data).toBe(TRUNCATED);
  });

  it("gives every field a budget of its own", () => {
    // Unlimited repeats: these graphs repeat far more than a pass allows,
    // and what is under test here is the field budgets alone.
    const encoded = encodeQueryEntry(
      oversizedQuery({ graphs: true }),
      FIELD_BUDGET_BYTES,
      new EncodePass(Number.POSITIVE_INFINITY),
    );
    const wire = encoded.value as unknown as Rec & { state: Rec };
    // `meta` spent its whole budget, and `data` and `fetchFailureReason`,
    // encoded after it, still got theirs (minus the work charged for
    // opening containers, which is most of a tiny-object graph's cost).
    for (const field of [
      wire.meta,
      wire.state.data,
      wire.state.fetchFailureReason,
    ]) {
      const bytes = jsonUtf8Bytes(field);
      expect(bytes).toBeGreaterThan(FIELD_BUDGET_BYTES / 4);
      expect(bytes).toBeLessThanOrEqual(FIELD_BUDGET_BYTES);
    }
  });

  it("encodes an entry that fits exactly like a plain encoding", () => {
    const query = makeQuery("q", {
      meta: { tag: 1n },
      state: { ...baseState, data: { items: [1, 2], when: new Date(0) } },
    });
    const encoded = encodeQueryEntry(query);
    expect(encoded.truncated).toBe(false);
    expect(JSON.stringify(encoded.value)).toBe(
      JSON.stringify(encodeForWire(query, Number.POSITIVE_INFINITY).value),
    );
    expect(encoded.utf8Bytes).toBe(jsonUtf8Bytes(encoded.value));
    expect(decodeBigInts(encoded.value)).toEqual(query);
  });

  it("encodes every kind of change into a valid SYNC_UPDATE", () => {
    const changes: ChangeEvent[] = [
      {
        entityType: "query",
        changeType: "updated",
        queryHash: oversizedQuery().queryHash,
        entry: oversizedQuery(),
      },
      { entityType: "query", changeType: "removed", queryHash: "gone" },
      {
        entityType: "query",
        changeType: "observers",
        queryHash: "q",
        patch: {
          observerCount: 1,
          status: "fresh",
          isActive: true,
          isDisabled: false,
        },
      },
      {
        entityType: "mutation",
        changeType: "added",
        mutationId: 7,
        entry: oversizedMutation(),
      },
      { entityType: "mutation", changeType: "removed", mutationId: 8 },
    ];
    const encoded = changes.map((change) => encodeChange(change));
    for (const { value, utf8Bytes } of encoded) {
      expect(jsonUtf8Bytes(value)).toBe(utf8Bytes);
    }
    expect(encoded.map(({ truncated }) => truncated)).toEqual([
      true,
      false,
      false,
      true,
      false,
    ]);
    const message = parseBridgeMessage(
      JSON.parse(
        JSON.stringify({
          source: BRIDGE_SOURCE,
          type: "SYNC_UPDATE",
          payload: { changes: encoded.map(({ value }) => value) },
        }),
      ),
    );
    expect(message?.type).toBe("SYNC_UPDATE");
    expect(encoded[2]?.value).toEqual(changes[2]);
  });
});

// === Repeats within a pass ===

/** A query whose `state.data` is `data`. */
function queryWithData(i: number, data: unknown): QueryEntry {
  const query = makeQuery(`["item",${String(i)}]`);
  return { ...query, state: { ...query.state, data } };
}

/** Encodes the entries one after the other in one pass, as a snapshot does. */
function encodeInOnePass(
  entries: readonly QueryEntry[],
  pass = new EncodePass(),
) {
  const start = performance.now();
  const encoded = entries.map(
    (entry) => encodeQueryEntryForMessage(entry, pass)!,
  );
  return {
    encoded,
    bytes: encoded.reduce((sum, { utf8Bytes }) => sum + utf8Bytes, 0),
    elapsedMs: performance.now() - start,
  };
}

/** The JSON of each entry encoded on its own, as every entry was before. */
function jsonEachAlone(entries: readonly QueryEntry[]): string[] {
  return entries.map((entry) =>
    JSON.stringify(encodeQueryEntryForMessage(entry)!.value),
  );
}

/** Generous bound on the structure of one encoded entry. */
const STRUCTURE_BYTES = 1024;

describe("repeats within a pass", () => {
  it("sends values that many entries share in full within the allowance", () => {
    // Normalized users referenced by the posts of 200 queries, and a large
    // table that two queries hold.
    const users = Array.from({ length: 50 }, (_, u) => ({
      id: u,
      name: `user ${u}`,
      avatar: `https://example.com/avatars/${u}.png`,
    }));
    const entries = Array.from({ length: 200 }, (_, i) =>
      queryWithData(i, {
        posts: Array.from({ length: 50 }, (_, p) => ({
          id: p,
          author: users[(i + p) % users.length],
        })),
      }),
    );
    const rows = tableRows(20_000);
    entries.push(queryWithData(200, rows), queryWithData(201, rows));

    const { encoded } = encodeInOnePass(entries);
    expect(encoded.some(({ truncated }) => truncated)).toBe(false);
    expect(encoded.map(({ value }) => JSON.stringify(value))).toEqual(
      jsonEachAlone(entries),
    );
  });

  it("bounds a snapshot whose entries all reach one graph", () => {
    // Each entry alone writes a full field budget of the store, which is
    // reachable along many paths: 100 × 8 MiB in seconds.
    const store = { nodes: doublyLinkedList(5000) };
    const entries = Array.from({ length: 100 }, (_, i) =>
      queryWithData(i, { id: i, store }),
    );

    const { encoded, bytes, elapsedMs } = encodeInOnePass(entries);
    // The first occurrence, the allowance, one field past it, and structure
    expect(bytes).toBeLessThanOrEqual(
      2 * FIELD_BUDGET_BYTES +
        REPEAT_ALLOWANCE_BYTES +
        entries.length * STRUCTURE_BYTES,
    );
    // Some 100 ms locally; the bound only leaves room for slow CI.
    expect(elapsedMs).toBeLessThan(1000);

    // The first entry is sent as on its own: a first occurrence is free
    expect(JSON.stringify(encoded[0]!.value)).toBe(
      jsonEachAlone(entries.slice(0, 1))[0],
    );
    // Every entry keeps its structure and its own data around the store;
    // the last ones get the store cut in place.
    const decoded = encoded.map(
      ({ value }) =>
        decodeBigInts(JSON.parse(JSON.stringify(value))) as QueryEntry,
    );
    decoded.forEach((entry, i) => {
      expect(entry.queryHash).toBe(entries[i]!.queryHash);
      expect((entry.state.data as Rec).id).toBe(i);
    });
    expect((decoded.at(-1)!.state.data as Rec).store).toBe(TRUNCATED);

    // The same order gives the same result
    const json = encoded.map(({ value }) => JSON.stringify(value));
    expect(
      encodeInOnePass(entries).encoded.map(({ value }) =>
        JSON.stringify(value),
      ),
    ).toEqual(json);
  });

  it("bounds a snapshot whose entries each reach a graph of their own", () => {
    // Nothing is shared between entries, but each store is reachable along
    // many paths within its field: 40 × 8 MiB on their own.
    const stores = Array.from({ length: 40 }, () => ({
      nodes: doublyLinkedList(5000),
    }));
    const entries = stores.map((store, i) =>
      queryWithData(i, { id: i, store }),
    );

    const { bytes, elapsedMs } = encodeInOnePass(entries);
    // What one store takes written out with no repeat at all
    const distinct = encodeForWire(
      stores[0],
      FIELD_BUDGET_BYTES,
      new EncodePass(0),
    ).utf8Bytes;
    expect(bytes).toBeLessThanOrEqual(
      entries.length * (distinct + STRUCTURE_BYTES) +
        REPEAT_ALLOWANCE_BYTES +
        FIELD_BUDGET_BYTES,
    );
    expect(bytes).toBeLessThan(entries.length * FIELD_BUDGET_BYTES * 0.2);
    // Some 250 ms locally.
    expect(elapsedMs).toBeLessThan(2000);
  });

  it("never charges the first occurrence of a value", () => {
    // No repeat allowed at all: values met for the first time still go whole
    const pass = new EncodePass(0);
    const entries = [
      queryWithData(0, tableRows(1000)),
      queryWithData(1, { rows: tableRows(1000), tags: new Set(["a"]) }),
    ];
    const { encoded } = encodeInOnePass(entries, pass);
    expect(encoded.map(({ value }) => JSON.stringify(value))).toEqual(
      jsonEachAlone(entries),
    );

    // A repeat is caught, and cut in place
    const repeat = encodeQueryEntryForMessage(
      queryWithData(2, { again: entries[0]!.state.data }),
      pass,
    );
    expect((decodeBigInts(repeat!.value) as QueryEntry).state.data).toEqual({
      again: TRUNCATED,
    });
  });

  it("checks for a cycle before a repeat", () => {
    // Every container already opened in the attempt is a repeat, its
    // ancestors included, yet a reference to an ancestor is a cycle.
    const parent: Rec = { name: "parent" };
    parent.child = { parent, siblings: [parent] };
    const encoded = encodeQueryEntryForMessage(
      queryWithData(0, parent),
      new EncodePass(0),
    );
    expect((decodeBigInts(encoded!.value) as QueryEntry).state.data).toEqual({
      name: "parent",
      child: { parent: CIRCULAR, siblings: [CIRCULAR] },
    });
  });

  it("cuts a Map or Set at a repeated key or member past the allowance", () => {
    const shared = { id: 1 };
    const pass = new EncodePass(0);
    encodeForWire(shared, FIELD_BUDGET_BYTES, pass);
    pass.commit();

    const value = {
      keys: new Map<unknown, unknown>([
        ["a", 1],
        [shared, 2],
        ["b", 3],
      ]),
      members: new Set<unknown>(["a", shared, "b"]),
      values: new Map([["k", shared]]),
    };
    const { value: wire } = encodeForWire(value, FIELD_BUDGET_BYTES, pass);
    const decoded = decodeBigInts(JSON.parse(JSON.stringify(wire))) as {
      keys: Map<unknown, unknown>;
      members: Set<unknown>;
      values: Map<unknown, unknown>;
    };
    // A cut key or member would merge with another: its owner stops there
    expect(Array.from(decoded.keys)).toEqual([["a", 1]]);
    expect(omittedCount(decoded.keys)).toBe(2);
    expect(Array.from(decoded.members)).toEqual(["a"]);
    expect(omittedCount(decoded.members)).toBe(2);
    // A Map value is addressed by position, so it is cut in place
    expect(Array.from(decoded.values)).toEqual([["k", TRUNCATED]]);

    // Within the allowance, the same value goes whole
    expect(roundTrip(value)).toEqual(value);
  });

  it("cuts a repeat past the allowance without listing its children", () => {
    const wide = Object.fromEntries(
      Array.from({ length: 200_000 }, (_, i) => [`key${i}`, i]),
    );
    const pass = new EncodePass(0);
    encodeForWire(wide, FIELD_BUDGET_BYTES, pass);
    pass.commit();

    const start = performance.now();
    const { value } = encodeForWire(
      Array.from({ length: 1000 }, () => wide),
      FIELD_BUDGET_BYTES,
      pass,
    );
    const elapsedMs = performance.now() - start;
    expect(value).toEqual(
      Array.from({ length: 1000 }, () => ({ __tqcd_type: "truncated" })),
    );
    // Listing the keys alone takes milliseconds each time.
    expect(elapsedMs).toBeLessThan(100);
  });
});

// === Typed arrays ===

describe("typed arrays", () => {
  it("encodes a typed array as an object of its elements, as before", () => {
    const value = {
      bytes: new Uint8Array([1, 2, 3]),
      big: new BigInt64Array([5n]),
      floats: new Float32Array([Number.NaN]),
      view: new DataView(new ArrayBuffer(4)),
      buffer: new ArrayBuffer(4),
    };
    expect(encodeForWire(value).value).toEqual({
      bytes: { 0: 1, 1: 2, 2: 3 },
      big: { 0: { __tqcd_type: "bigint", value: "5" } },
      floats: { 0: { __tqcd_type: "number", value: "NaN" } },
      view: {},
      buffer: {},
    });
    expect(JSON.stringify(encodeForWire(value.bytes).value)).toBe(
      '{"0":1,"1":2,"2":3}',
    );
    expect(roundTrip(value)).toEqual({
      bytes: { 0: 1, 1: 2, 2: 3 },
      big: { 0: 5n },
      floats: { 0: Number.NaN },
      view: {},
      buffer: {},
    });
  });

  it("sends the elements of a typed array only, as many as it really has", () => {
    const tagged = Object.assign(new Uint8Array([7, 8]), { tag: "x" });
    expect(encodeForWire(tagged).value).toEqual({ 0: 7, 1: 8 });

    const lying = new Uint8Array([1, 2]);
    Object.defineProperty(lying, "length", { value: 1e9 });
    expect(encodeForWire(lying).value).toEqual({ 0: 1, 1: 2 });
  });

  it("cuts a typed array like an object, keeping the elements sent", () => {
    const bytes = new Uint8Array(100).map((_, i) => i);
    const decoded = roundTripWithin(bytes, 300) as Rec;
    const keys = Object.keys(decoded);
    expect(keys.length).toBeGreaterThan(0);
    expect(keys).toEqual(keys.map((_, i) => String(i)));
    expect(Object.values(decoded)).toEqual(
      Array.from(bytes.subarray(0, keys.length)),
    );
    expect(keys.length + omittedCount(decoded)).toBe(bytes.length);
  });

  it("bounds the cost of a huge typed array", () => {
    const file = new Uint8Array(30_000_000);
    const result = timedEncode({ file });
    expect(result.truncated).toBe(true);
    expect(result.utf8Bytes).toBeLessThanOrEqual(FIELD_BUDGET_BYTES);
    expect(jsonUtf8Bytes(result.value)).toBe(result.utf8Bytes);
    // Listing its keys up front took about 2 s and over 1 GB.
    expect(result.elapsedMs).toBeLessThan(1000);
    const decoded = (decodeBigInts(result.value) as { file: Rec }).file;
    expect(Object.keys(decoded).length + omittedCount(decoded)).toBe(
      file.length,
    );
  });

  it("counts a typed array that many entries share as a repeat", () => {
    const bytes = new Uint8Array(5_000_000);
    const entries = Array.from({ length: 10 }, (_, i) =>
      queryWithData(i, { id: i, bytes }),
    );
    const { bytes: total, elapsedMs } = encodeInOnePass(entries);
    expect(total).toBeLessThanOrEqual(
      2 * FIELD_BUDGET_BYTES +
        REPEAT_ALLOWANCE_BYTES +
        entries.length * STRUCTURE_BYTES,
    );
    expect(elapsedMs).toBeLessThan(2000);
  });
});

// === Colliding keys and members ===

describe("decoded Map keys and Set members", () => {
  it("stay at their page position when two members are cycles", () => {
    const parent: Rec = { name: "parent" };
    const child: Rec = { name: "child" };
    parent.child = child;
    child.links = new Set([{ name: "first" }, parent, child, { name: "leaf" }]);
    const page = { root: parent };

    const decoded = roundTrip(page) as {
      root: { child: { links: Set<unknown> } };
    };
    // Both cycles decode to CIRCULAR: the second one would merge with the
    // first and move "leaf" to the position of `child` on the page.
    const links = decoded.root.child.links;
    expect(Array.from(links)).toEqual([{ name: "first" }, CIRCULAR]);
    expect(omittedCount(links)).toBe(2);

    // The path the viewer builds for a member it shows edits that member
    const edited = setAtPath(
      page,
      ["root", "child", "links", "0", "name"],
      "edited",
    ) as { root: { child: { links: Set<Rec> } } };
    expect(Array.from(edited.root.child.links, (m) => m.name)).toEqual([
      "edited",
      "parent",
      "child",
      "leaf",
    ]);
  });

  it("stay at their page position when two keys are cycles", () => {
    const owner: Rec = { name: "owner" };
    const map = new Map<unknown, unknown>();
    owner.map = map;
    map.set("before", 0);
    map.set(owner, "v-owner");
    map.set(map, "v-map");
    map.set("k", "v-k");

    const decoded = (
      roundTrip({ owner }) as { owner: { map: Map<unknown, unknown> } }
    ).owner.map;
    expect(Array.from(decoded)).toEqual([
      ["before", 0],
      [CIRCULAR, "v-owner"],
    ]);
    expect(omittedCount(decoded)).toBe(2);
  });

  it("stay at their page position next to a page object shaped like a sentinel", () => {
    const set = roundTrip(
      new Set<unknown>([{ __tqcd_type: "undefined" }, undefined, "after"]),
    ) as Set<unknown>;
    expect(Array.from(set)).toEqual([undefined]);
    expect(omittedCount(set)).toBe(2);

    const map = roundTrip(
      new Map<unknown, unknown>([
        [1n, "real"],
        [{ __tqcd_type: "bigint", value: "1" }, "spoof"],
        ["k", "v"],
      ]),
    ) as Map<unknown, unknown>;
    expect(Array.from(map)).toEqual([[1n, "real"]]);
    expect(omittedCount(map)).toBe(2);
  });

  it("keep a single cycle and add what they drop to what the page left out", () => {
    const node: Rec = { id: 0 };
    node.links = new Set([node, { id: 1 }]);
    const links = (roundTrip(node) as { links: Set<unknown> }).links;
    expect(Array.from(links)).toEqual([CIRCULAR, { id: 1 }]);
    expect(omittedCount(links)).toBe(0);

    const cut = decodeBigInts({
      __tqcd_type: "set",
      entries: [{ __tqcd_type: "circular" }, { __tqcd_type: "circular" }, 1],
      omitted: 4,
    });
    expect(Array.from(cut as Set<unknown>)).toEqual([CIRCULAR]);
    expect(omittedCount(cut)).toBe(6);
  });
});
