import superjson from "superjson";

/**
 * Safely serialize data using superjson
 * Falls back to regular JSON if superjson fails
 */
export function safeSerialize(data: unknown): string {
  try {
    return superjson.stringify(data);
  } catch (error) {
    console.warn(
      "Superjson serialization failed, falling back to JSON:",
      error,
    );
    try {
      return JSON.stringify(data, (_key, value) => {
        // Handle special cases that JSON.stringify can't handle
        if (typeof value === "function") {
          return `[Function: ${value.name || "anonymous"}]`;
        }
        if (typeof value === "bigint") {
          return `[BigInt: ${value.toString()}]`;
        }
        if (value instanceof Date) {
          return `[Date: ${value.toISOString()}]`;
        }
        if (typeof value === "symbol") {
          return `[Symbol: ${value.toString()}]`;
        }
        // Handle circular references
        if (typeof value === "object" && value !== null) {
          if (visited.has(value)) {
            return "[Circular Reference]";
          }
          visited.add(value);
        }
        return value;
      });
    } catch (jsonError) {
      console.error("Both superjson and JSON serialization failed:", jsonError);
      return JSON.stringify({
        error: "Serialization failed",
        originalError: error instanceof Error ? error.message : String(error),
        jsonError:
          jsonError instanceof Error ? jsonError.message : String(jsonError),
      });
    }
  }
}

/**
 * Safely deserialize data using superjson
 * Falls back to regular JSON if superjson fails
 */
export function safeDeserialize<T = unknown>(serializedData: string): T {
  try {
    return superjson.parse(serializedData);
  } catch (error) {
    console.warn(
      "Superjson deserialization failed, falling back to JSON:",
      error,
    );
    try {
      return JSON.parse(serializedData);
    } catch (jsonError) {
      console.error(
        "Both superjson and JSON deserialization failed:",
        jsonError,
      );
      // Return a safe fallback
      return {
        error: "Deserialization failed",
        originalData: serializedData,
        superJsonError: error instanceof Error ? error.message : String(error),
        jsonError:
          jsonError instanceof Error ? jsonError.message : String(jsonError),
      } as T;
    }
  }
}

// Circular reference detection for JSON fallback
const visited = new WeakSet();
