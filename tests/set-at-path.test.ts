import { describe, expect, it } from "vitest";
import type { PathSegment } from "@/types/messages";
import { clearAtPath, deleteAtPath, setAtPath } from "@/utils/set-at-path";

type Rec = Record<string, unknown>;

class Point {
  x: number;
  y: number;

  constructor(x: number, y: number) {
    this.x = x;
    this.y = y;
  }

  sum(): number {
    return this.x + this.y;
  }
}

describe("setAtPath", () => {
  it("returns the value itself for an empty path", () => {
    expect(setAtPath({ a: 1 }, [], 5)).toBe(5);
  });

  it("copies only the containers on the path", () => {
    const sibling = { deep: [1] };
    const keep = { z: 1 };
    const root = { a: { b: 1, keep }, sibling };

    const next = setAtPath(root, ["a", "b"], 2) as typeof root;

    expect(next.a.b).toBe(2);
    expect(next).not.toBe(root);
    expect(next.a).not.toBe(root.a);
    expect(next.sibling).toBe(sibling);
    expect(next.a.keep).toBe(keep);
    expect(root.a.b).toBe(1);
  });

  it("keeps the prototype of a class instance on the path", () => {
    const point = new Point(1, 2);
    const root = { point };

    const next = setAtPath(root, ["point", "x"], 100) as typeof root;

    expect(next.point).toBeInstanceOf(Point);
    expect(next.point).not.toBe(point);
    expect(next.point.sum()).toBe(102);
    expect(point.x).toBe(1);
  });

  it("edits a frozen input without touching it", () => {
    const root = Object.freeze({
      a: Object.freeze({ b: 1 }),
      list: Object.freeze([1, 2]),
    });

    const nextA = setAtPath(root, ["a", "b"], 2) as typeof root;
    const nextList = setAtPath(root, ["list", "0"], 9) as typeof root;

    expect(nextA.a.b).toBe(2);
    expect(nextList.list).toEqual([9, 2]);
    expect(root.a.b).toBe(1);
    expect(root.list).toEqual([1, 2]);
  });

  it("does not invoke getters and keeps property descriptors", () => {
    let getterCalls = 0;
    const root: Rec = { x: 1 };
    Object.defineProperty(root, "computed", {
      get() {
        getterCalls++;
        return 42;
      },
      enumerable: true,
      configurable: true,
    });
    Object.defineProperty(root, "hidden", {
      value: 1,
      enumerable: false,
      writable: true,
      configurable: true,
    });

    const next = setAtPath(root, ["x"], 2) as Rec;
    const nextHidden = setAtPath(root, ["hidden"], 2) as Rec;

    expect(getterCalls).toBe(0);
    expect(next.x).toBe(2);
    expect(typeof Object.getOwnPropertyDescriptor(next, "computed")?.get).toBe(
      "function",
    );
    expect(Object.getOwnPropertyDescriptor(nextHidden, "hidden")).toEqual({
      value: 2,
      enumerable: false,
      writable: true,
      configurable: true,
    });
  });

  it("returns the root when the value does not change", () => {
    const root = { a: 1, n: Number.NaN };
    expect(setAtPath(root, ["a"], 1)).toBe(root);
    expect(setAtPath(root, ["n"], Number.NaN)).toBe(root);
  });

  it("replaces an array item", () => {
    const root = { list: [1, 2, 3] };
    const next = setAtPath(root, ["list", "1"], 9) as typeof root;
    expect(next.list).toEqual([1, 9, 3]);
    expect(root.list).toEqual([1, 2, 3]);
  });

  it("edits a Map value by entry index and keeps keys, size and order", () => {
    const map = new Map<number, string>([
      [7, "seven"],
      [8, "eight"],
    ]);
    const root = { map };

    const next = setAtPath(root, ["map", { mapIndex: 0 }], "SEVEN") as {
      map: Map<number, string>;
    };

    expect(next.map).toBeInstanceOf(Map);
    expect(next.map).not.toBe(map);
    expect(next.map.size).toBe(2);
    expect(Array.from(next.map.keys())).toEqual([7, 8]);
    expect(next.map.get(7)).toBe("SEVEN");
    expect(map.get(7)).toBe("seven");
  });

  it("descends into a Map entry whose key is an object", () => {
    const key = { id: 1 };
    const map = new Map([[key, { v: 1 }]]);

    const next = setAtPath(map, [{ mapIndex: 0 }, "v"], 2) as typeof map;

    expect(next.get(key)).toEqual({ v: 2 });
    expect(map.get(key)).toEqual({ v: 1 });
  });

  it("replaces a Set member by index and keeps the order", () => {
    const set = new Set(["a", "b", "c"]);
    const next = setAtPath(set, ["1"], "B") as Set<string>;
    expect(next).toBeInstanceOf(Set);
    expect(Array.from(next)).toEqual(["a", "B", "c"]);
    expect(Array.from(set)).toEqual(["a", "b", "c"]);
  });

  it("descends into a Set member", () => {
    const member = { n: 1 };
    const set = new Set([member]);
    const next = setAtPath(set, ["0", "n"], 2) as Set<unknown>;
    expect(Array.from(next)).toEqual([{ n: 2 }]);
    expect(member.n).toBe(1);
  });

  it("copies a typed array as a real instance with its own buffer", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const root = { bytes };

    const next = setAtPath(root, ["bytes", "1"], 9) as typeof root;

    expect(next.bytes).toBeInstanceOf(Uint8Array);
    expect(Array.from(next.bytes)).toEqual([1, 9, 3]);
    expect(next.bytes.buffer).not.toBe(bytes.buffer);
    expect(Array.from(bytes)).toEqual([1, 2, 3]);
  });

  it("ignores a typed array write of the wrong element type", () => {
    const big = new BigInt64Array([1n, 2n]);
    const floats = new Float64Array([1.5]);

    expect(setAtPath(big, ["0"], 5)).toBe(big);
    expect(setAtPath(floats, ["0"], "x")).toBe(floats);

    const next = setAtPath(big, ["0"], 5n) as BigInt64Array;
    expect(next).toBeInstanceOf(BigInt64Array);
    expect(Array.from(next)).toEqual([5n, 2n]);
  });

  it("ignores edits below a DataView or an ArrayBuffer", () => {
    const view = new DataView(new ArrayBuffer(4));
    const buffer = new ArrayBuffer(4);
    expect(setAtPath(view, ["0"], 1)).toBe(view);
    expect(setAtPath(view, ["byteLength"], 1)).toBe(view);
    expect(setAtPath(buffer, ["0"], 1)).toBe(buffer);
  });
});

describe("paths that cannot be applied return the same reference", () => {
  const sparse: unknown[] = [1];
  sparse[2] = 3;
  const root = {
    a: { b: 1 },
    list: [1, 2],
    sparse,
    map: new Map([[1, "x"]]),
    set: new Set(["s"]),
  };

  const paths: { label: string; path: readonly PathSegment[] }[] = [
    { label: "missing key", path: ["missing"] },
    { label: "missing nested key", path: ["a", "missing"] },
    { label: "key below a primitive", path: ["a", "b", "c"] },
    { label: "array index out of range", path: ["list", "5"] },
    { label: "negative array index", path: ["list", "-1"] },
    { label: "non-canonical array index", path: ["list", "01"] },
    { label: "array length", path: ["list", "length"] },
    { label: "array hole", path: ["sparse", "1"] },
    { label: "mapIndex out of range", path: ["map", { mapIndex: 3 }] },
    { label: "negative mapIndex", path: ["map", { mapIndex: -1 }] },
    { label: "fractional mapIndex", path: ["map", { mapIndex: 0.5 }] },
    { label: "string segment on a Map", path: ["map", "1"] },
    { label: "Set index out of range", path: ["set", "3"] },
    { label: "mapIndex on an object", path: ["a", { mapIndex: 0 }] },
    { label: "inherited key", path: ["toString"] },
    { label: "nested inherited key", path: ["a", "hasOwnProperty"] },
  ];

  it.each(paths)("$label", ({ path }) => {
    expect(setAtPath(root, path, 9)).toBe(root);
    expect(deleteAtPath(root, path)).toBe(root);
    expect(clearAtPath(root, path)).toBe(root);
  });
});

describe("forbidden keys", () => {
  const paths: { label: string; path: readonly PathSegment[] }[] = [
    { label: "__proto__.x", path: ["__proto__", "x"] },
    {
      label: "constructor.prototype.x",
      path: ["constructor", "prototype", "x"],
    },
    { label: "prototype", path: ["prototype"] },
    { label: "nested __proto__", path: ["a", "__proto__", "x"] },
    { label: "nested constructor", path: ["a", "constructor"] },
  ];

  it.each(paths)("$label is a no-op", ({ path }) => {
    const root = { a: {} };

    expect(setAtPath(root, path, "polluted")).toBe(root);
    expect(deleteAtPath(root, path)).toBe(root);
    expect(clearAtPath(root, path)).toBe(root);
    expect(({} as Rec).x).toBeUndefined();
    expect(Object.hasOwn(Object.prototype, "x")).toBe(false);
  });

  it("refuses an own data property with a forbidden name too", () => {
    const withProto = JSON.parse('{"__proto__":{"x":1}}') as Rec;
    const withConstructor = { constructor: 1 };
    const withPrototype = { prototype: { x: 1 } };
    const nested = { a: withProto };

    expect(setAtPath(withProto, ["__proto__", "x"], 2)).toBe(withProto);
    expect(deleteAtPath(withProto, ["__proto__"])).toBe(withProto);
    expect(setAtPath(withConstructor, ["constructor"], 2)).toBe(
      withConstructor,
    );
    expect(setAtPath(withPrototype, ["prototype", "x"], 2)).toBe(withPrototype);
    expect(clearAtPath(nested, ["a", "__proto__"])).toBe(nested);
  });
});

describe("deleteAtPath", () => {
  it("is a no-op for an empty path", () => {
    const root = { a: 1 };
    expect(deleteAtPath(root, [])).toBe(root);
  });

  it("removes an object key and shares the untouched siblings", () => {
    const root = { a: 1, b: { c: 2 } };
    const next = deleteAtPath(root, ["a"]) as Rec;
    expect(next).toEqual({ b: { c: 2 } });
    expect(next.b).toBe(root.b);
    expect(root.a).toBe(1);
  });

  it("keeps the prototype of a class instance", () => {
    const next = deleteAtPath(new Point(1, 2), ["y"]) as Point;
    expect(next).toBeInstanceOf(Point);
    expect(Object.hasOwn(next, "y")).toBe(false);
  });

  it("removes an array item", () => {
    const list = [1, 2, 3];
    expect(deleteAtPath(list, ["1"])).toEqual([1, 3]);
    expect(list).toEqual([1, 2, 3]);
  });

  it("removes a Map entry by entry index", () => {
    const map = new Map([
      [1, "a"],
      [2, "b"],
    ]);
    const next = deleteAtPath(map, [{ mapIndex: 0 }]) as typeof map;
    expect(Array.from(next.entries())).toEqual([[2, "b"]]);
    expect(map.size).toBe(2);
  });

  it("removes a Set member by index and keeps the order", () => {
    const set = new Set(["a", "b", "c"]);
    const next = deleteAtPath(set, ["1"]) as Set<string>;
    expect(Array.from(next)).toEqual(["a", "c"]);
    expect(set.size).toBe(3);
  });

  it("removes a typed array element", () => {
    const bytes = new Uint8Array([1, 2, 3]);
    const next = deleteAtPath(bytes, ["1"]) as Uint8Array;
    expect(next).toBeInstanceOf(Uint8Array);
    expect(Array.from(next)).toEqual([1, 3]);
  });
});

describe("clearAtPath", () => {
  it("replaces an array with an empty one", () => {
    const other = {};
    const root = { list: [1, 2], other };
    const next = clearAtPath(root, ["list"]) as typeof root;
    expect(next.list).toEqual([]);
    expect(next.other).toBe(other);
    expect(root.list).toEqual([1, 2]);
  });

  it("replaces a Set with an empty Set", () => {
    const root = { tags: new Set([1, 2]) };
    const next = clearAtPath(root, ["tags"]) as typeof root;
    expect(next.tags).toBeInstanceOf(Set);
    expect(next.tags.size).toBe(0);
    expect(root.tags.size).toBe(2);
  });

  it("clears the root for an empty path", () => {
    expect(clearAtPath([1, 2], [])).toEqual([]);
    expect(clearAtPath(new Set([1]), [])).toEqual(new Set());
  });

  it("clears an array stored as a Map value", () => {
    const map = new Map([["k", [1, 2]]]);
    const next = clearAtPath(map, [{ mapIndex: 0 }]) as typeof map;
    expect(next.get("k")).toEqual([]);
  });

  it("returns the root when the target is already empty", () => {
    const root = { list: [], tags: new Set() };
    expect(clearAtPath(root, ["list"])).toBe(root);
    expect(clearAtPath(root, ["tags"])).toBe(root);
  });

  it("leaves anything that is not an array or a Set alone", () => {
    const root = { obj: { b: 1 }, n: 5, map: new Map([[1, 1]]) };
    expect(clearAtPath(root, ["obj"])).toBe(root);
    expect(clearAtPath(root, ["n"])).toBe(root);
    expect(clearAtPath(root, ["map"])).toBe(root);
    expect(clearAtPath("text", [])).toBe("text");
  });
});
