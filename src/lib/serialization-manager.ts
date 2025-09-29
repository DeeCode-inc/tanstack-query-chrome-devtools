// Enhanced serialization system for complex data structures
import { safeSerialize, safeDeserialize } from "../utils/serialization";
import { z } from "zod";

// Serialized payload wrapper
export interface SerializedPayload {
  serialized: string;
  usedSuperjson: boolean;
  isSerializedPayload: true;
}

// Validation schema for serialized data
export const SerializedPayloadSchema = z.object({
  serialized: z.string(),
  usedSuperjson: z.boolean(),
  isSerializedPayload: z.literal(true),
});

// Type guard for serialized payloads
export function isSerializedPayload(data: unknown): data is SerializedPayload {
  return SerializedPayloadSchema.safeParse(data).success;
}

// Safe structured clone for simple data
export function safeStructuredClone<T>(data: T): T {
  try {
    return structuredClone(data);
  } catch {
    // Fallback for non-cloneable data
    return JSON.parse(JSON.stringify(data));
  }
}

// Enhanced serialization handler
export class SerializationManager {
  // Serialize data for transmission
  static serialize<T>(data: T): T | SerializedPayload {
    try {
      // First try structured clone to check if data is cloneable
      structuredClone(data);
      return data; // Data is cloneable, no need to serialize
    } catch {
      // Data contains non-cloneable elements, serialize it
      try {
        const serialized = safeSerialize(data);
        return {
          serialized,
          usedSuperjson: true,
          isSerializedPayload: true,
        };
      } catch (error) {
        console.warn("Failed to serialize data:", error);
        // Return safe fallback
        return JSON.parse(JSON.stringify(data));
      }
    }
  }

  // Deserialize data if needed
  static deserialize<T>(data: T | SerializedPayload): T {
    if (isSerializedPayload(data)) {
      try {
        return safeDeserialize(data.serialized) as T;
      } catch (error) {
        console.error("Failed to deserialize data:", error);
        // Return empty array as safe fallback for most cases
        return [] as T;
      }
    }
    return data;
  }

  // Batch process array items that may be serialized
  static deserializeArray<T>(data: T[] | SerializedPayload): T[] {
    if (isSerializedPayload(data)) {
      try {
        const deserialized = safeDeserialize(data.serialized);
        return Array.isArray(deserialized) ? deserialized : [];
      } catch (error) {
        console.error("Failed to deserialize array:", error);
        return [];
      }
    }

    if (!Array.isArray(data)) {
      console.warn("Expected array but got:", typeof data);
      return [];
    }

    return data;
  }

  // Process payload with mixed serialized/non-serialized fields
  static processPayload<T extends Record<string, unknown>>(payload: T): T {
    const processed = { ...payload } as T;

    for (const [key, value] of Object.entries(processed)) {
      if (isSerializedPayload(value)) {
        try {
          (processed as Record<string, unknown>)[key] = safeDeserialize(
            value.serialized,
          );
        } catch (error) {
          console.error(`Failed to deserialize field '${key}':`, error);
          // Keep original value or use safe fallback
          if (key === "queries" || key === "mutations") {
            (processed as Record<string, unknown>)[key] = [];
          }
        }
      }
    }

    return processed;
  }
}

// Message serialization utilities
export class MessageSerializer {
  // Prepare message for postMessage transmission
  static prepareForPostMessage<T extends Record<string, unknown>>(
    message: T,
  ): T {
    const prepared = { ...message } as T;

    // Serialize complex fields that might contain functions or symbols
    for (const [key, value] of Object.entries(prepared)) {
      if (key === "payload" && value && typeof value === "object") {
        (prepared as Record<string, unknown>)[key] =
          SerializationManager.serialize(value);
      }
    }

    return prepared;
  }

  // Process received message from postMessage
  static processFromPostMessage<T extends Record<string, unknown>>(
    message: T,
  ): T {
    const processed = { ...message } as T;

    // Deserialize complex fields
    for (const [key, value] of Object.entries(processed)) {
      if (key === "payload" && (value || isSerializedPayload(value))) {
        (processed as Record<string, unknown>)[key] =
          SerializationManager.deserialize(value);
      }
    }

    return processed;
  }
}

// Chrome storage serialization (usually not needed as Chrome handles it)
export class StorageSerializer {
  // Prepare data for Chrome storage
  static prepareForStorage<T>(data: T): T {
    // Chrome storage handles JSON serialization automatically
    // Only serialize if data contains non-JSON types
    try {
      JSON.stringify(data);
      return data; // Data is JSON-serializable
    } catch {
      // Contains non-JSON types, use our serializer
      return SerializationManager.serialize(data) as T;
    }
  }

  // Process data from Chrome storage
  static processFromStorage<T>(data: T): T {
    return SerializationManager.deserialize(data);
  }
}

// Validation utilities for deserialized data
export class DataValidator {
  // Validate that deserialized data is an array
  static ensureArray<T>(data: unknown, fallback: T[] = []): T[] {
    if (Array.isArray(data)) {
      return data;
    }

    console.warn("Expected array but got:", typeof data, data);
    return fallback;
  }

  // Validate that deserialized data is an object
  static ensureObject<T extends Record<string, unknown>>(
    data: unknown,
    fallback: T,
  ): T {
    if (data && typeof data === "object" && !Array.isArray(data)) {
      return data as T;
    }

    console.warn("Expected object but got:", typeof data, data);
    return fallback;
  }

  // Validate boolean value
  static ensureBoolean(data: unknown, fallback = false): boolean {
    if (typeof data === "boolean") {
      return data;
    }

    return fallback;
  }
}
