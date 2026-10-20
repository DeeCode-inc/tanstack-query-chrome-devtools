import type { MutationEntry, QueryEntry } from "./ui";

/**
 * Addresses the value of the `mapIndex`-th entry of a Map, in insertion order.
 * Map keys can be any value, so they are addressed by position rather than by
 * a stringified key that could not be mapped back to the real key.
 */
export interface MapEntrySegment {
  readonly mapIndex: number;
}

/**
 * A string addresses an own key of an object, or a decimal index into an
 * array or into a Set's members (insertion order).
 */
export type PathSegment = string | MapEntrySegment;

// === Bridge (MAIN ↔ ISOLATED) ===

export const BRIDGE_SOURCE = "tq-devtools-bridge" as const;
export const BRIDGE_SOURCE_ACTION = "tq-devtools-action" as const;

export type BridgeMessageType =
  | "SYNC_SNAPSHOT"
  | "SYNC_UPDATE"
  | "SYNC_DISCONNECTED"
  | "CLIENT_READY";

/**
 * Places one SYNC_SNAPSHOT message within its snapshot. A snapshot is sent as
 * `chunkCount` messages with `chunkIndex` 0, 1, ... in order, so that no
 * message outgrows the port size limit (see `utils/chunking.ts`); the
 * receiver replaces its state only once the last one is in. The chunks of a
 * snapshot are posted back to back, with nothing else of the stream between
 * them. Chunk 0 starts a new snapshot and supersedes any unfinished one.
 */
export interface SnapshotChunkFields {
  /** Tells the chunks of one snapshot from those of another. */
  readonly snapshotId: number;
  readonly chunkIndex: number;
  readonly chunkCount: number;
}

export interface SyncSnapshotPayload extends SnapshotChunkFields {
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
  /** The page has a QueryClient; posted on detection, not tied to streaming. */
  CLIENT_READY: Record<string, never>;
}

/**
 * Correlated union: every member pairs one `type` with its own payload, so a
 * `switch (message.type)` narrows `message.payload` without casts.
 */
export type BridgeMessage = {
  [K in BridgeMessageType]: {
    readonly source: typeof BRIDGE_SOURCE;
    readonly type: K;
    readonly payload: BridgePayloadMap[K];
  };
}[BridgeMessageType];

/** Wire shape of a request posted by the relay (ISOLATED) to the page (MAIN). */
export interface PageRequestEnvelope {
  readonly source: typeof BRIDGE_SOURCE_ACTION;
  readonly request: PageRequest;
}

// === Change Events ===

/**
 * The fields of a query entry that change when observers mount or unmount.
 * Sent instead of the full entry so observer churn does not re-serialize data.
 */
export type QueryObserversPatch = Pick<
  QueryEntry,
  "observerCount" | "status" | "isActive" | "isDisabled"
>;

export interface QueryEntryChangeEvent {
  readonly entityType: "query";
  readonly changeType: "added" | "updated";
  readonly queryHash: string;
  readonly entry: QueryEntry;
}

export interface QueryRemovedChangeEvent {
  readonly entityType: "query";
  readonly changeType: "removed";
  readonly queryHash: string;
}

export interface QueryObserversChangeEvent {
  readonly entityType: "query";
  readonly changeType: "observers";
  readonly queryHash: string;
  readonly patch: QueryObserversPatch;
}

export interface MutationEntryChangeEvent {
  readonly entityType: "mutation";
  readonly changeType: "added" | "updated";
  readonly mutationId: number;
  readonly entry: MutationEntry;
}

export interface MutationRemovedChangeEvent {
  readonly entityType: "mutation";
  readonly changeType: "removed";
  readonly mutationId: number;
}

export type ChangeEvent =
  | QueryEntryChangeEvent
  | QueryRemovedChangeEvent
  | QueryObserversChangeEvent
  | MutationEntryChangeEvent
  | MutationRemovedChangeEvent;

// === Port Messages ===

export type PortMessage =
  | SyncSnapshotPortMessage
  | SyncUpdatePortMessage
  | SyncSnapshotFailedPortMessage
  | SyncDisconnectedPortMessage
  | SyncClearPortMessage
  | ConnectAckPortMessage
  | ClientReadyPortMessage
  | StartSyncPortMessage
  | StopSyncPortMessage
  | PanelConnectPortMessage
  | PopupConnectPortMessage
  | ActionRequestPortMessage
  | SetDataRequestPortMessage
  | DeleteDataRequestPortMessage
  | RemoveAllQueriesRequestPortMessage
  | ClearArrayRequestPortMessage
  | ClearMutationCacheRequestPortMessage;

/** One chunk of a snapshot (see `SnapshotChunkFields`). */
export interface SyncSnapshotPortMessage extends SnapshotChunkFields {
  readonly type: "SYNC_SNAPSHOT";
  readonly queries: readonly QueryEntry[];
  readonly mutations: readonly MutationEntry[];
}

export interface SyncUpdatePortMessage {
  readonly type: "SYNC_UPDATE";
  readonly changes: readonly ChangeEvent[];
}

/**
 * sync-relay → background → panel / popup: the snapshot being sent could not
 * be delivered (a chunk was refused or lost on the way). The receiver drops
 * its state and any unfinished snapshot, and ignores updates until the next
 * snapshot, because they only apply on top of the one that was lost. Not
 * answered with a resync: the page would build the same snapshot again.
 */
export interface SyncSnapshotFailedPortMessage {
  readonly type: "SYNC_SNAPSHOT_FAILED";
}

export interface SyncDisconnectedPortMessage {
  readonly type: "SYNC_DISCONNECTED";
}

export interface SyncClearPortMessage {
  readonly type: "SYNC_CLEAR";
}

/**
 * background → panel / popup: the background registered the viewer's connect
 * message. Sent before any cached snapshot so the viewer knows its port works
 * even when the page has nothing to send yet.
 */
export interface ConnectAckPortMessage {
  readonly type: "CONNECT_ACK";
}

/** sync-relay → background: the page has a QueryClient. */
export interface ClientReadyPortMessage {
  readonly type: "CLIENT_READY";
}

/**
 * background → page: a viewer is connected. The page subscribes to its
 * QueryClient and always answers with a fresh snapshot. The relay also sends
 * it to the page on its own, to resync after an update it could not forward.
 */
export interface StartSyncPortMessage {
  readonly type: "START_SYNC";
}

/** background → page: no viewer is connected; stop streaming changes. */
export interface StopSyncPortMessage {
  readonly type: "STOP_SYNC";
}

export interface PanelConnectPortMessage {
  readonly type: "PANEL_CONNECT";
  readonly tabId: number;
}

export interface PopupConnectPortMessage {
  readonly type: "POPUP_CONNECT";
}

export const ACTION_TYPES = [
  "invalidate",
  "refetch",
  "reset",
  "remove",
  "triggerLoading",
  "restoreLoading",
  "triggerError",
  "restoreError",
] as const;

export type ActionType = (typeof ACTION_TYPES)[number];

export function isActionType(value: unknown): value is ActionType {
  return ACTION_TYPES.some((type) => type === value);
}

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

// === Routing ===

/**
 * The single allow-list of viewer requests that the background forwards to
 * the content script and the relay forwards to the page.
 */
export const FORWARDED_REQUEST_TYPES = [
  "ACTION_REQUEST",
  "SET_DATA_REQUEST",
  "DELETE_DATA_REQUEST",
  "REMOVE_ALL_QUERIES_REQUEST",
  "CLEAR_ARRAY_REQUEST",
  "CLEAR_MUTATION_CACHE_REQUEST",
] as const;

export type ForwardedRequestType = (typeof FORWARDED_REQUEST_TYPES)[number];

export type ForwardedRequest = Extract<
  PortMessage,
  { type: ForwardedRequestType }
>;

export function isForwardedRequest(msg: PortMessage): msg is ForwardedRequest {
  return FORWARDED_REQUEST_TYPES.some((type) => type === msg.type);
}

/** sync-relay → background */
export type ContentToBackgroundMessage =
  | SyncSnapshotPortMessage
  | SyncUpdatePortMessage
  | SyncSnapshotFailedPortMessage
  | SyncDisconnectedPortMessage
  | ClientReadyPortMessage;

/** background → sync-relay */
export type BackgroundToContentMessage =
  | ForwardedRequest
  | StartSyncPortMessage
  | StopSyncPortMessage;

/** panel / popup → background */
export type ViewerToBackgroundMessage =
  | PanelConnectPortMessage
  | PopupConnectPortMessage
  | ForwardedRequest;

/** background → panel / popup */
export type BackgroundToViewerMessage =
  | SyncSnapshotPortMessage
  | SyncUpdatePortMessage
  | SyncSnapshotFailedPortMessage
  | SyncDisconnectedPortMessage
  | SyncClearPortMessage
  | ConnectAckPortMessage;

/**
 * sync-relay → page, posted once when the relay starts: the page answers with
 * CLIENT_READY if it already has a QueryClient. Not a port message.
 */
export interface ClientStatusRequest {
  readonly type: "CLIENT_STATUS_REQUEST";
}

/** Requests the relay hands to the page inside a `PageRequestEnvelope`. */
export type PageRequest =
  | ForwardedRequest
  | StartSyncPortMessage
  | StopSyncPortMessage
  | ClientStatusRequest;

// === Viewer actions ===

/** Request senders the panel and popup expose to their UI. */
export interface DevtoolsActions {
  readonly sendAction: (action: ActionType, queryHash: string) => void;
  readonly sendSetData: (
    queryHash: string,
    path: readonly PathSegment[],
    value: string | number | boolean,
  ) => void;
  readonly sendDeleteData: (
    queryHash: string,
    path: readonly PathSegment[],
  ) => void;
  readonly sendRemoveAllQueries: () => void;
  readonly sendClearArray: (
    queryHash: string,
    path: readonly PathSegment[],
  ) => void;
  readonly sendClearMutationCache: () => void;
}
