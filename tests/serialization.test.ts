import { describe, expect, it } from "vitest";
import {
  CIRCULAR,
  decodeBigInts,
  encodeBigInts,
  formatMapKey,
  serializeToJsLiteral,
  stringifyWithBigInt,
} from "@/utils/serialization";

type Rec = Record<string, unknown>;

/**
 * The trip a value takes from the inspected page to a viewer: encoded in the
 * page, carried as JSON (how a Chrome extension port transfers a message), and
 * decoded in the viewer.
 */
function roundTrip(value: unknown): unknown {
  return decodeBigInts(JSON.parse(JSON.stringify(encodeBigInts(value))));
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
