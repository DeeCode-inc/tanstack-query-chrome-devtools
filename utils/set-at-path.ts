import type { PathSegment } from "@/types/messages";

function isMapKeySegment(segment: PathSegment): segment is { readonly mapKey: string } {
  return typeof segment === "object" && "mapKey" in segment;
}

function navigateSegment(current: unknown, segment: PathSegment): unknown {
  if (current == null || typeof current !== "object") return undefined;
  if (isMapKeySegment(segment)) {
    if (current instanceof Map) return current.get(segment.mapKey);
    return undefined;
  }
  if (current instanceof Set) {
    const index = Number(segment);
    if (Number.isInteger(index) && index >= 0) {
      return Array.from(current)[index];
    }
    return undefined;
  }
  return (current as Record<string, unknown>)[segment];
}

function deepClone(value: unknown, seen = new Map<object, object>()): unknown {
  if (value === null || typeof value !== "object") return value;

  if (seen.has(value)) return seen.get(value);

  if (value instanceof Date) return new Date(value.getTime());

  if (value instanceof RegExp) return new RegExp(value.source, value.flags);

  if (value instanceof Map) {
    const clone = new Map();
    seen.set(value, clone);
    for (const [k, v] of value.entries()) {
      clone.set(deepClone(k, seen), deepClone(v, seen));
    }
    return clone;
  }

  if (value instanceof Set) {
    const clone = new Set();
    seen.set(value, clone);
    for (const v of value.values()) {
      clone.add(deepClone(v, seen));
    }
    return clone;
  }

  if (Array.isArray(value)) {
    const clone: unknown[] = [];
    seen.set(value, clone);
    for (let i = 0; i < value.length; i++) {
      clone[i] = deepClone(value[i], seen);
    }
    return clone;
  }

  const clone: Record<string, unknown> = {};
  seen.set(value, clone);
  for (const key of Object.keys(value)) {
    clone[key] = deepClone((value as Record<string, unknown>)[key], seen);
  }
  return clone;
}

export function setAtPath(obj: unknown, path: readonly PathSegment[], value: unknown): unknown {
  const clone = deepClone(obj);
  if (path.length === 0) return value;

  let current: unknown = clone;
  for (let i = 0; i < path.length - 1; i++) {
    current = navigateSegment(current, path[i]);
    if (current === undefined) return clone;
  }

  const lastSegment = path[path.length - 1];
  if (current == null || typeof current !== "object" || lastSegment === undefined) return clone;

  if (isMapKeySegment(lastSegment)) {
    if (current instanceof Map) {
      current.set(lastSegment.mapKey, value);
    }
  } else if (current instanceof Set) {
    const index = Number(lastSegment);
    if (Number.isInteger(index) && index >= 0) {
      const arr = Array.from(current);
      if (index < arr.length) {
        arr[index] = value;
        current.clear();
        for (const item of arr) current.add(item);
      }
    }
  } else {
    (current as Record<string, unknown>)[lastSegment] = value;
  }

  return clone;
}

export function deleteAtPath(obj: unknown, path: readonly PathSegment[]): unknown {
  const clone = deepClone(obj);
  if (path.length === 0) return clone;

  let current: unknown = clone;
  for (let i = 0; i < path.length - 1; i++) {
    current = navigateSegment(current, path[i]);
    if (current === undefined) return clone;
  }

  const lastSegment = path[path.length - 1];
  if (current == null || typeof current !== "object" || lastSegment === undefined) return clone;

  if (isMapKeySegment(lastSegment)) {
    if (current instanceof Map) {
      current.delete(lastSegment.mapKey);
    }
  } else if (current instanceof Set) {
    const index = Number(lastSegment);
    if (Number.isInteger(index) && index >= 0) {
      const arr = Array.from(current);
      if (index < arr.length) {
        arr.splice(index, 1);
        current.clear();
        for (const item of arr) current.add(item);
      }
    }
  } else if (Array.isArray(current)) {
    const index = Number(lastSegment);
    if (Number.isInteger(index) && index >= 0 && index < current.length) {
      current.splice(index, 1);
    }
  } else {
    delete (current as Record<string, unknown>)[lastSegment];
  }

  return clone;
}
