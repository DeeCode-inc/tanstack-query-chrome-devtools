// Message validation system with runtime type checking
import { z } from "zod";
import type {
  TanStackQueryEvent,
  QueryActionMessage,
  BulkQueryActionMessage,
  UpdateMessage,
  IconUpdateMessage,
  RequestImmediateUpdateMessage,
  ClearArtificialStatesMessage,
} from "../types/messages";

// Schema definitions for runtime validation
const QueryActionMessageSchema = z.object({
  type: z.literal("QUERY_ACTION"),
  action: z.enum([
    "INVALIDATE",
    "REFETCH",
    "REMOVE",
    "RESET",
    "TRIGGER_LOADING",
    "TRIGGER_ERROR",
    "CANCEL_LOADING",
    "CANCEL_ERROR",
    "SET_QUERY_DATA",
  ]),
  queryHash: z.string(),
  newData: z.unknown().optional(),
});

const BulkQueryActionMessageSchema = z.object({
  type: z.literal("BULK_QUERY_ACTION"),
  action: z.literal("REMOVE_ALL_QUERIES"),
});

const TanStackQueryEventSchema = z.object({
  type: z.literal("QEVENT"),
  subtype: z.enum([
    "QUERY_CLIENT_DETECTED",
    "QUERY_CLIENT_NOT_FOUND",
    "QUERY_STATE_UPDATE",
    "QUERY_DATA_UPDATE",
    "MUTATION_DATA_UPDATE",
  ]),
  payload: z.array(z.unknown()).optional(),
});

const UpdateMessageSchema = z.object({
  type: z.literal("UPDATE_QUERY_STATE"),
  payload: z.object({
    queries: z.array(z.unknown()).optional(),
    mutations: z.array(z.unknown()).optional(),
    tanStackQueryDetected: z.boolean().optional(),
  }),
});

const IconUpdateMessageSchema = z.object({
  type: z.literal("ICON_UPDATE"),
  tanStackQueryDetected: z.boolean(),
  tabId: z.number(),
});

const RequestImmediateUpdateMessageSchema = z.object({
  type: z.literal("REQUEST_IMMEDIATE_UPDATE"),
  preserveArtificialStates: z.boolean().optional(),
});

const ClearArtificialStatesMessageSchema = z.object({
  type: z.literal("CLEAR_ARTIFICIAL_STATES"),
});

// Type guards with runtime validation
export function isQueryActionMessage(
  message: unknown,
): message is QueryActionMessage {
  return QueryActionMessageSchema.safeParse(message).success;
}

export function isBulkQueryActionMessage(
  message: unknown,
): message is BulkQueryActionMessage {
  return BulkQueryActionMessageSchema.safeParse(message).success;
}

export function isTanStackQueryEvent(
  message: unknown,
): message is TanStackQueryEvent {
  return TanStackQueryEventSchema.safeParse(message).success;
}

export function isUpdateMessage(message: unknown): message is UpdateMessage {
  return UpdateMessageSchema.safeParse(message).success;
}

export function isIconUpdateMessage(
  message: unknown,
): message is IconUpdateMessage {
  return IconUpdateMessageSchema.safeParse(message).success;
}

export function isRequestImmediateUpdateMessage(
  message: unknown,
): message is RequestImmediateUpdateMessage {
  return RequestImmediateUpdateMessageSchema.safeParse(message).success;
}

export function isClearArtificialStatesMessage(
  message: unknown,
): message is ClearArtificialStatesMessage {
  return ClearArtificialStatesMessageSchema.safeParse(message).success;
}

// Message validation helper
export function validateMessage<T>(
  message: unknown,
  validator: (msg: unknown) => msg is T,
  context?: string,
): T | null {
  try {
    if (validator(message)) {
      return message;
    }

    if (context) {
      console.warn(`Invalid message format in ${context}:`, message);
    }
    return null;
  } catch (error) {
    if (context) {
      console.error(`Message validation error in ${context}:`, error);
    }
    return null;
  }
}

// Origin validation for postMessage events
export function isValidOrigin(
  event: MessageEvent,
  expectedOrigin?: string,
): boolean {
  const origin = expectedOrigin || window.location.origin;
  return event.origin === origin;
}

// Source validation for extension messages
export function isFromInjectedScript(data: unknown): boolean {
  return (
    (data as { source?: string })?.source === "tanstack-query-devtools-injected"
  );
}

export function isFromContentScript(data: unknown): boolean {
  return (
    (data as { source?: string })?.source === "tanstack-query-devtools-content"
  );
}

// Combined validation for postMessage events
export function validatePostMessage<T>(
  event: MessageEvent,
  validator: (msg: unknown) => msg is T,
  options: {
    requireInjectedSource?: boolean;
    requireContentSource?: boolean;
    expectedOrigin?: string;
  } = {},
): T | null {
  // Origin validation
  if (!isValidOrigin(event, options.expectedOrigin)) {
    return null;
  }

  // Source validation
  if (options.requireInjectedSource && !isFromInjectedScript(event.data)) {
    return null;
  }

  if (options.requireContentSource && !isFromContentScript(event.data)) {
    return null;
  }

  // Message validation
  return validateMessage(event.data, validator, "postMessage");
}
