import type {
  BackgroundToContentMessage,
  BackgroundToViewerMessage,
  BridgeMessage,
  ChangeEvent,
  ContentToBackgroundMessage,
  ForwardedRequest,
  PageRequest,
  PageRequestEnvelope,
  PathSegment,
  QueryObserversPatch,
  SyncSnapshotPayload,
  SyncUpdatePayload,
  ViewerToBackgroundMessage,
} from "@/types/messages";
import {
  BRIDGE_SOURCE,
  BRIDGE_SOURCE_ACTION,
  isActionType,
} from "@/types/messages";
import type {
  MutationEntry,
  MutationStatus,
  QueryDisplayStatus,
  QueryEntry,
  QueryState,
} from "@/types/ui";

/**
 * Runtime checks for every message that crosses a trust boundary: page →
 * relay (any script on the page can post to the window), relay → page, and
 * the extension ports. They check the structure the receiving code relies on;
 * encoded user data (`data`, `error`, `meta`, the contents of keys) is not
 * walked, because decoding it is total and never throws.
 */

/** Largest JSON size of one snapshot or update the relay forwards. */
export const MAX_PAYLOAD_CHARS = 32 * 1024 * 1024;
/** Most entries or changes a single message may carry. */
export const MAX_ENTRIES = 10_000;
/** Most segments an edit path may have. */
export const MAX_PATH_LENGTH = 256;

const QUERY_DISPLAY_STATUSES: Readonly<Record<QueryDisplayStatus, true>> = {
  fresh: true,
  fetching: true,
  paused: true,
  stale: true,
  inactive: true,
};

const QUERY_STATUSES: Readonly<Record<QueryState["status"], true>> = {
  pending: true,
  error: true,
  success: true,
};

const FETCH_STATUSES: Readonly<Record<QueryState["fetchStatus"], true>> = {
  fetching: true,
  paused: true,
  idle: true,
};

const MUTATION_STATUSES: Readonly<Record<MutationStatus, true>> = {
  idle: true,
  pending: true,
  success: true,
  error: true,
};

const OBSERVERS_PATCH_KEYS: Readonly<Record<keyof QueryObserversPatch, true>> =
  {
    observerCount: true,
    status: true,
    isActive: true,
    isDisabled: true,
  };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * A record the receiving code reads fields from (an entry, its state, a change
 * event). Wire sentinels are records too, and decoding would replace one with
 * a different value, so a structural record must not look like a sentinel.
 */
function isStructRecord(value: unknown): value is Record<string, unknown> {
  return isRecord(value) && !Object.hasOwn(value, "__tqcd_type");
}

function isOneOf<K extends string>(
  value: unknown,
  allowed: Readonly<Record<K, true>>,
): value is K {
  return typeof value === "string" && Object.hasOwn(allowed, value);
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

/**
 * Checks length and every item by index: arrays posted through the window
 * keep their holes, which `Array.prototype.every` would skip.
 */
function isListOf<T>(
  value: unknown,
  isItem: (item: unknown) => item is T,
): value is readonly T[] {
  if (!Array.isArray(value) || value.length > MAX_ENTRIES) return false;
  for (let i = 0; i < value.length; i++) {
    if (!isItem(value[i])) return false;
  }
  return true;
}

function isQueryState(value: unknown): value is QueryState {
  return (
    isStructRecord(value) &&
    isOneOf(value.status, QUERY_STATUSES) &&
    isOneOf(value.fetchStatus, FETCH_STATUSES) &&
    (value.fetchMeta === null || isRecord(value.fetchMeta))
  );
}

function isQueryEntry(value: unknown): value is QueryEntry {
  return (
    isStructRecord(value) &&
    typeof value.queryHash === "string" &&
    Array.isArray(value.queryKey) &&
    isNonNegativeInteger(value.observerCount) &&
    isOneOf(value.status, QUERY_DISPLAY_STATUSES) &&
    isFiniteNumber(value.dataUpdatedAt) &&
    typeof value.isActive === "boolean" &&
    typeof value.isDisabled === "boolean" &&
    isQueryState(value.state)
  );
}

function isMutationEntry(value: unknown): value is MutationEntry {
  return (
    isStructRecord(value) &&
    Number.isInteger(value.mutationId) &&
    (value.mutationKey === null || Array.isArray(value.mutationKey)) &&
    isOneOf(value.status, MUTATION_STATUSES) &&
    isFiniteNumber(value.timestamp) &&
    isStructRecord(value.state) &&
    isOneOf(value.state.status, MUTATION_STATUSES)
  );
}

/**
 * Exactly the four patch fields: the patch is spread over the stored entry,
 * so any other key would overwrite an unrelated field of it.
 */
function isObserversPatch(value: unknown): value is QueryObserversPatch {
  return (
    isStructRecord(value) &&
    Object.keys(value).every((key) =>
      Object.hasOwn(OBSERVERS_PATCH_KEYS, key),
    ) &&
    isNonNegativeInteger(value.observerCount) &&
    isOneOf(value.status, QUERY_DISPLAY_STATUSES) &&
    typeof value.isActive === "boolean" &&
    typeof value.isDisabled === "boolean"
  );
}

function isChangeEvent(value: unknown): value is ChangeEvent {
  if (!isStructRecord(value)) return false;
  if (value.entityType === "query") {
    const { queryHash, entry } = value;
    if (typeof queryHash !== "string") return false;
    switch (value.changeType) {
      case "added":
      case "updated":
        return isQueryEntry(entry) && entry.queryHash === queryHash;
      case "removed":
        return true;
      case "observers":
        return isObserversPatch(value.patch);
      default:
        return false;
    }
  }
  if (value.entityType === "mutation") {
    const { mutationId, entry } = value;
    if (!Number.isInteger(mutationId)) return false;
    switch (value.changeType) {
      case "added":
      case "updated":
        return isMutationEntry(entry) && entry.mutationId === mutationId;
      case "removed":
        return true;
      default:
        return false;
    }
  }
  return false;
}

function isSnapshotFields(
  value: Record<string, unknown>,
): value is Record<string, unknown> & SyncSnapshotPayload {
  return (
    isListOf(value.queries, isQueryEntry) &&
    isListOf(value.mutations, isMutationEntry)
  );
}

function isUpdateFields(
  value: Record<string, unknown>,
): value is Record<string, unknown> & SyncUpdatePayload {
  return isListOf(value.changes, isChangeEvent);
}

function isPathSegment(value: unknown): value is PathSegment {
  return (
    typeof value === "string" ||
    (isRecord(value) && isNonNegativeInteger(value.mapIndex))
  );
}

/** An edit path: at most `MAX_PATH_LENGTH` strings and `{ mapIndex }` segments. */
export function isPath(value: unknown): value is readonly PathSegment[] {
  if (!Array.isArray(value) || value.length > MAX_PATH_LENGTH) return false;
  for (let i = 0; i < value.length; i++) {
    if (!isPathSegment(value[i])) return false;
  }
  return true;
}

function isSetDataValue(value: unknown): value is string | number | boolean {
  return (
    typeof value === "string" ||
    typeof value === "boolean" ||
    isFiniteNumber(value)
  );
}

function isForwardedRequestMessage(value: unknown): value is ForwardedRequest {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "ACTION_REQUEST":
      return isActionType(value.action) && typeof value.queryHash === "string";
    case "SET_DATA_REQUEST":
      return (
        typeof value.queryHash === "string" &&
        isPath(value.path) &&
        isSetDataValue(value.value)
      );
    case "DELETE_DATA_REQUEST":
    case "CLEAR_ARRAY_REQUEST":
      return typeof value.queryHash === "string" && isPath(value.path);
    case "REMOVE_ALL_QUERIES_REQUEST":
    case "CLEAR_MUTATION_CACHE_REQUEST":
      return true;
    default:
      return false;
  }
}

/**
 * Validates a message the page posted on the window and returns it as a
 * fresh envelope that carries only the checked fields, or `null` when it is
 * not a well-formed bridge message.
 */
export function parseBridgeMessage(data: unknown): BridgeMessage | null {
  if (!isRecord(data) || data.source !== BRIDGE_SOURCE) return null;
  const { payload } = data;
  switch (data.type) {
    case "SYNC_SNAPSHOT":
      if (!isRecord(payload) || !isSnapshotFields(payload)) return null;
      return {
        source: BRIDGE_SOURCE,
        type: "SYNC_SNAPSHOT",
        payload: { queries: payload.queries, mutations: payload.mutations },
      };
    case "SYNC_UPDATE":
      if (!isRecord(payload) || !isUpdateFields(payload)) return null;
      return {
        source: BRIDGE_SOURCE,
        type: "SYNC_UPDATE",
        payload: { changes: payload.changes },
      };
    case "SYNC_DISCONNECTED":
      return { source: BRIDGE_SOURCE, type: "SYNC_DISCONNECTED", payload: {} };
    case "CLIENT_READY":
      return { source: BRIDGE_SOURCE, type: "CLIENT_READY", payload: {} };
    default:
      return null;
  }
}

/** sync-relay → background port messages. */
export function isContentToBackgroundMessage(
  value: unknown,
): value is ContentToBackgroundMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "SYNC_SNAPSHOT":
      return isSnapshotFields(value);
    case "SYNC_UPDATE":
      return isUpdateFields(value);
    case "SYNC_DISCONNECTED":
    case "CLIENT_READY":
      return true;
    default:
      return false;
  }
}

/** background → sync-relay port messages. */
export function isBackgroundToContentMessage(
  value: unknown,
): value is BackgroundToContentMessage {
  if (!isRecord(value)) return false;
  if (value.type === "START_SYNC" || value.type === "STOP_SYNC") return true;
  return isForwardedRequestMessage(value);
}

/** panel / popup → background port messages. */
export function isViewerToBackgroundMessage(
  value: unknown,
): value is ViewerToBackgroundMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "PANEL_CONNECT":
      return isNonNegativeInteger(value.tabId);
    case "POPUP_CONNECT":
      return true;
    default:
      return isForwardedRequestMessage(value);
  }
}

/** background → panel / popup port messages, checked before decoding. */
export function isBackgroundToViewerMessage(
  value: unknown,
): value is BackgroundToViewerMessage {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "SYNC_SNAPSHOT":
      return isSnapshotFields(value);
    case "SYNC_UPDATE":
      return isUpdateFields(value);
    case "SYNC_DISCONNECTED":
    case "SYNC_CLEAR":
    case "CONNECT_ACK":
      return true;
    default:
      return false;
  }
}

function isPageRequest(value: unknown): value is PageRequest {
  if (!isRecord(value)) return false;
  switch (value.type) {
    case "START_SYNC":
    case "STOP_SYNC":
    case "CLIENT_STATUS_REQUEST":
      return true;
    default:
      return isForwardedRequestMessage(value);
  }
}

/** relay → page requests, as received by the page's window listener. */
export function isPageRequestEnvelope(
  value: unknown,
): value is PageRequestEnvelope {
  return (
    isRecord(value) &&
    value.source === BRIDGE_SOURCE_ACTION &&
    isPageRequest(value.request)
  );
}
