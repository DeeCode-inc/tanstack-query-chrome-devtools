import type { QueryEntry, MutationEntry } from "./ui";

export interface MapKeySegment { readonly mapKey: string }
export type PathSegment = string | MapKeySegment;

// === Bridge (MAIN ↔ ISOLATED) ===

export const BRIDGE_SOURCE = "tq-devtools-bridge" as const;
export const BRIDGE_SOURCE_ACTION = "tq-devtools-action" as const;

export type BridgeMessageType =
  | "SYNC_SNAPSHOT"
  | "SYNC_UPDATE"
  | "SYNC_DISCONNECTED";

export interface SyncSnapshotPayload {
  readonly queries: readonly QueryEntry[];
  readonly mutations: readonly MutationEntry[];
}

export interface SyncUpdatePayload {
  readonly changes: readonly ChangeEvent[];
}

export interface BridgePayloadMap {
  SYNC_SNAPSHOT: SyncSnapshotPayload;
  SYNC_UPDATE: SyncUpdatePayload;
  SYNC_DISCONNECTED: Record<string, never>;
}

export interface BridgeMessage<
  T extends BridgeMessageType = BridgeMessageType,
> {
  readonly source: typeof BRIDGE_SOURCE;
  readonly type: T;
  readonly payload: BridgePayloadMap[T];
}

export function isBridgeMessage(
  event: MessageEvent,
): event is MessageEvent<BridgeMessage> {
  return (
    event.source === window &&
    (event.data as Record<string, unknown>)?.source === BRIDGE_SOURCE
  );
}

// === Change Events ===

export type ChangeEvent = QueryChangeEvent | MutationChangeEvent;

export interface QueryChangeEvent {
  readonly entityType: "query";
  readonly changeType: "added" | "updated" | "removed";
  readonly queryHash: string;
  readonly entry: QueryEntry | undefined;
}

export interface MutationChangeEvent {
  readonly entityType: "mutation";
  readonly changeType: "added" | "updated" | "removed";
  readonly mutationId: number;
  readonly entry: MutationEntry | undefined;
}

// === Port Messages ===

export type PortMessage =
  | SyncSnapshotPortMessage
  | SyncUpdatePortMessage
  | SyncDisconnectedPortMessage
  | SyncClearPortMessage
  | PanelConnectPortMessage
  | PopupConnectPortMessage
  | ActionRequestPortMessage
  | SetDataRequestPortMessage
  | DeleteDataRequestPortMessage
  | RemoveAllQueriesRequestPortMessage
  | ClearArrayRequestPortMessage
  | ClearMutationCacheRequestPortMessage
  | ResyncRequestPortMessage;

export interface SyncSnapshotPortMessage {
  readonly type: "SYNC_SNAPSHOT";
  readonly queries: readonly QueryEntry[];
  readonly mutations: readonly MutationEntry[];
}

export interface SyncUpdatePortMessage {
  readonly type: "SYNC_UPDATE";
  readonly changes: readonly ChangeEvent[];
}

export interface SyncDisconnectedPortMessage {
  readonly type: "SYNC_DISCONNECTED";
}

export interface SyncClearPortMessage {
  readonly type: "SYNC_CLEAR";
}

export interface PanelConnectPortMessage {
  readonly type: "PANEL_CONNECT";
  readonly tabId: number;
}

export interface PopupConnectPortMessage {
  readonly type: "POPUP_CONNECT";
}

export type ActionType =
  | "invalidate"
  | "refetch"
  | "reset"
  | "remove"
  | "triggerLoading"
  | "restoreLoading"
  | "triggerError"
  | "restoreError";

export interface ActionRequestPortMessage {
  readonly type: "ACTION_REQUEST";
  readonly action: ActionType;
  readonly queryHash: string;
}

export interface SetDataRequestPortMessage {
  readonly type: "SET_DATA_REQUEST";
  readonly queryHash: string;
  readonly path: readonly PathSegment[];
  readonly value: string | number | boolean;
}

export interface DeleteDataRequestPortMessage {
  readonly type: "DELETE_DATA_REQUEST";
  readonly queryHash: string;
  readonly path: readonly PathSegment[];
}

export interface RemoveAllQueriesRequestPortMessage {
  readonly type: "REMOVE_ALL_QUERIES_REQUEST";
}

export interface ClearArrayRequestPortMessage {
  readonly type: "CLEAR_ARRAY_REQUEST";
  readonly queryHash: string;
  readonly path: readonly PathSegment[];
}

export interface ClearMutationCacheRequestPortMessage {
  readonly type: "CLEAR_MUTATION_CACHE_REQUEST";
}

export interface ResyncRequestPortMessage {
  readonly type: "RESYNC_REQUEST";
}
