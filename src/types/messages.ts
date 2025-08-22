// Centralized message type definitions using discriminated unions
import type { QueryData, MutationData } from "./query";

// Query Action Types - Discriminated unions instead of string literals
export type QueryAction = { queryHash: string } & (
  | { type: "INVALIDATE" }
  | { type: "REFETCH" }
  | { type: "REMOVE" }
  | { type: "RESET" }
  | { type: "TRIGGER_LOADING" }
  | { type: "TRIGGER_ERROR" }
  | { type: "CANCEL_LOADING" }
  | { type: "CANCEL_ERROR" }
  | { type: "SET_QUERY_DATA"; newData: unknown }
);

// Bulk Query Action Types - For operations affecting all queries
export type BulkQueryAction = { type: "REMOVE_ALL_QUERIES" };

// Base interface for action results
interface BaseQueryActionResult {
  type: "QUERY_ACTION_RESULT";
  queryHash: string;
  success: boolean;
  error?: string;
}

// Union of all action result types
export type QueryActionResult = BaseQueryActionResult &
  (
    | { action: "INVALIDATE" }
    | { action: "REFETCH" }
    | { action: "REMOVE" }
    | { action: "RESET" }
    | { action: "TRIGGER_LOADING" }
    | { action: "TRIGGER_ERROR" }
    | { action: "CANCEL_LOADING" }
    | { action: "CANCEL_ERROR" }
    | { action: "SET_QUERY_DATA"; newData?: unknown }
  );

// Bulk action result type
export interface BulkQueryActionResult {
  type: "BULK_QUERY_ACTION_RESULT";
  action: BulkQueryAction["type"];
  success: boolean;
  error?: string;
  affectedCount?: number;
}

// TanStack Query Event Types - Discriminated unions
export type TanStackQueryEvent = { type: "QEVENT" } & (
  | { subtype: "QUERY_CLIENT_DETECTED" }
  | { subtype: "QUERY_CLIENT_NOT_FOUND" }
  | { subtype: "QUERY_STATE_UPDATE" }
  | { subtype: "QUERY_DATA_UPDATE"; payload: QueryData[] }
  | { subtype: "MUTATION_DATA_UPDATE"; payload: MutationData[] }
);

// Update Message Types - More flexible for background script handling
export interface UpdateMessage {
  type: "UPDATE_QUERY_STATE";
  payload: {
    queries?: QueryData[];
    mutations?: MutationData[];
    tanStackQueryDetected?: boolean;
  };
}

// Query Action Message Type
export interface QueryActionMessage {
  type: "QUERY_ACTION";
  action: QueryAction["type"];
  queryHash: string;
  newData?: unknown;
}

// Bulk Query Action Message Type
export interface BulkQueryActionMessage {
  type: "BULK_QUERY_ACTION";
  action: BulkQueryAction["type"];
}

// Request Immediate Update Message Type
export interface RequestImmediateUpdateMessage {
  type: "REQUEST_IMMEDIATE_UPDATE";
  preserveArtificialStates?: boolean;
}

// Clear Artificial States Message Type
export interface ClearArtificialStatesMessage {
  type: "CLEAR_ARTIFICIAL_STATES";
}
