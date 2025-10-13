// Message validation system with runtime type checking
import { z } from "zod";
import type {
  BulkQueryActionMessage,
  QueryActionMessage,
  TanStackQueryEvent,
  UpdateMessage,
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
