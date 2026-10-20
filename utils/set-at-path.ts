import type { MapEntrySegment, PathSegment } from "@/types/messages";

/**
 * Path edits copy only the containers on the path to the edited value; every
 * subtree off the path is kept by reference. Prototypes and property
 * descriptors of copied objects are preserved. An edit that cannot be applied
 * (missing entry or own property, out-of-range index, segment that does not
 * fit the container, a forbidden key anywhere on the path) or that would not
 * change anything returns the input root by identity.
 */

/** A child position inside one container, with copy-on-write operations. */
interface Slot {
  /** The child currently stored at this position. */
  readonly value: unknown;
  /** Returns a copy of the container with this child replaced by `next`. */
  readonly replace: (next: unknown) => unknown;
  /** Returns a copy of the container without this child. */
  readonly remove: () => unknown;
}

/** Returned by a leaf update to delete the addressed child. */
const REMOVE: unique symbol = Symbol("remove");

/**
 * Keys that reach an object's prototype chain instead of its own data. A path
 * through any of them is ignored, so an edit request can never modify
 * `Object.prototype` or a constructor shared by the whole page.
 */
const FORBIDDEN_KEYS: ReadonlySet<string> = new Set([
  "__proto__",
  "constructor",
  "prototype",
]);

function hasForbiddenSegment(path: readonly PathSegment[]): boolean {
  return path.some(
    (segment) => typeof segment === "string" && FORBIDDEN_KEYS.has(segment),
  );
}

function isMapEntrySegment(segment: PathSegment): segment is MapEntrySegment {
  return (
    typeof segment === "object" && segment !== null && "mapIndex" in segment
  );
}

/** Parses a canonical decimal index (`"0"`, `"12"`) that is below `length`. */
function parseIndex(segment: string, length: number): number | undefined {
  const index = Number(segment);
  return Number.isInteger(index) &&
    index >= 0 &&
    index < length &&
    String(index) === segment
    ? index
    : undefined;
}

function mapEntrySlot(
  map: Map<unknown, unknown>,
  segment: MapEntrySegment,
): Slot | undefined {
  const index = segment.mapIndex;
  if (!Number.isInteger(index) || index < 0 || index >= map.size) {
    return undefined;
  }
  const key = Array.from(map.keys())[index];
  return {
    value: map.get(key),
    // Map#set on an existing key keeps the entry at its original position.
    replace: (next) => new Map(map).set(key, next),
    remove: () => {
      const copy = new Map(map);
      copy.delete(key);
      return copy;
    },
  };
}

function setMemberSlot(set: Set<unknown>, segment: string): Slot | undefined {
  const index = parseIndex(segment, set.size);
  if (index === undefined) return undefined;
  const members = Array.from(set);
  return {
    value: members[index],
    replace: (next) =>
      new Set(members.map((member, i) => (i === index ? next : member))),
    remove: () => new Set(members.filter((_, i) => i !== index)),
  };
}

function arrayItemSlot(
  array: readonly unknown[],
  segment: string,
): Slot | undefined {
  const index = parseIndex(segment, array.length);
  // A hole is not an own index, so it is not addressable either
  if (index === undefined || !Object.hasOwn(array, segment)) return undefined;
  return {
    value: array[index],
    replace: (next) => {
      const copy = array.slice();
      copy[index] = next;
      return copy;
    },
    remove: () => {
      const copy = array.slice();
      copy.splice(index, 1);
      return copy;
    },
  };
}

type TypedArray =
  | Int8Array
  | Uint8Array
  | Uint8ClampedArray
  | Int16Array
  | Uint16Array
  | Int32Array
  | Uint32Array
  | Float32Array
  | Float64Array
  | BigInt64Array
  | BigUint64Array;

/**
 * Typed arrays keep their elements in internal storage that a descriptor copy
 * would not carry over, so they are copied with their own `slice` / `filter`,
 * which return a real instance of the same constructor. A replacement whose
 * type differs from the element type (number, or bigint for the 64-bit
 * integer arrays) is ignored rather than coerced or thrown on.
 */
function typedArrayItemSlot(
  array: TypedArray,
  segment: string,
): Slot | undefined {
  const index = parseIndex(segment, array.length);
  if (index === undefined) return undefined;
  const value: unknown = array[index];
  return {
    value,
    replace: (next) => {
      if (typeof next !== typeof value) return array;
      const copy = array.slice();
      copy[index] = next as never;
      return copy;
    },
    remove: () => array.filter((_, i) => i !== index),
  };
}

/**
 * Objects are copied from their own property descriptors onto a new object
 * with the same prototype: class instances keep their methods, getters are not
 * invoked, and frozen inputs can still be copied.
 */
function objectPropertySlot(object: object, key: string): Slot {
  return {
    value: (object as Record<string, unknown>)[key],
    replace: (next) =>
      // The computed key defines an own property even for `__proto__`,
      // where a plain assignment would invoke the prototype setter instead.
      Object.create(Object.getPrototypeOf(object), {
        ...Object.getOwnPropertyDescriptors(object),
        [key]: {
          value: next,
          writable: true,
          enumerable:
            Object.getOwnPropertyDescriptor(object, key)?.enumerable ?? true,
          configurable: true,
        },
      }),
    remove: () => {
      if (!Object.hasOwn(object, key)) return object;
      const descriptors = Object.getOwnPropertyDescriptors(object);
      delete descriptors[key];
      return Object.create(Object.getPrototypeOf(object), descriptors);
    },
  };
}

function resolveSlot(node: unknown, segment: PathSegment): Slot | undefined {
  if (typeof node !== "object" || node === null) return undefined;
  if (isMapEntrySegment(segment)) {
    return node instanceof Map ? mapEntrySlot(node, segment) : undefined;
  }
  // Segments arrive over the wire; anything that is not a string is ignored.
  if (typeof segment !== "string" || node instanceof Map) return undefined;
  if (node instanceof Set) return setMemberSlot(node, segment);
  if (Array.isArray(node)) return arrayItemSlot(node, segment);
  if (ArrayBuffer.isView(node)) {
    // A DataView has no indexed children, and copying it from descriptors
    // would drop its buffer, so edits below it are ignored.
    return node instanceof DataView
      ? undefined
      : typedArrayItemSlot(node as TypedArray, segment);
  }
  // Same for a raw buffer: its bytes are not reachable as properties.
  if (node instanceof ArrayBuffer) return undefined;
  // Only own properties are addressable: an inherited key would read from,
  // or shadow, the prototype chain.
  if (!Object.hasOwn(node, segment)) return undefined;
  return objectPropertySlot(node, segment);
}

/**
 * Applies `update` to the value at `path[index…]` below `node`. Returns `node`
 * itself when nothing changed, otherwise a copy of `node` that shares every
 * unchanged child.
 */
function updateIn(
  node: unknown,
  path: readonly PathSegment[],
  index: number,
  update: (current: unknown) => unknown,
): unknown {
  const segment = path[index];
  const slot = segment === undefined ? undefined : resolveSlot(node, segment);
  if (!slot) return node;
  const next =
    index === path.length - 1
      ? update(slot.value)
      : updateIn(slot.value, path, index + 1, update);
  if (next === REMOVE) return slot.remove();
  return Object.is(next, slot.value) ? node : slot.replace(next);
}

/** Returns `root` with the value at `path` replaced by `value`. */
export function setAtPath(
  root: unknown,
  path: readonly PathSegment[],
  value: unknown,
): unknown {
  if (path.length === 0) return value;
  if (hasForbiddenSegment(path)) return root;
  return updateIn(root, path, 0, () => value);
}

/** Returns `root` without the entry at `path`. An empty path is a no-op. */
export function deleteAtPath(
  root: unknown,
  path: readonly PathSegment[],
): unknown {
  if (path.length === 0 || hasForbiddenSegment(path)) return root;
  return updateIn(root, path, 0, () => REMOVE);
}

function emptied(target: unknown): unknown {
  if (target instanceof Set) return target.size === 0 ? target : new Set();
  if (Array.isArray(target)) return target.length === 0 ? target : [];
  return target;
}

/**
 * Returns `root` with the Set or array at `path` replaced by an empty one of
 * the same kind. Any other target is a no-op.
 */
export function clearAtPath(
  root: unknown,
  path: readonly PathSegment[],
): unknown {
  if (path.length === 0) return emptied(root);
  if (hasForbiddenSegment(path)) return root;
  return updateIn(root, path, 0, emptied);
}
