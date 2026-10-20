import type { ChangeEvent } from "@/types/messages";
import type { MutationEntry, QueryEntry, SyncStatus } from "@/types/ui";
import { applyChanges } from "@/utils/apply-changes";
import {
  addChunk,
  type PartialSnapshot,
  type SnapshotChunk,
} from "@/utils/chunking";
import { isBackgroundToViewerMessage } from "@/utils/guards";
import { decodeBigInts } from "@/utils/serialization";

/**
 * Viewer side of the stream: the state a panel or popup shows, and how the
 * messages of its port change it. Kept apart from the hook so it can be
 * tested without React.
 */

/**
 * Reverses the wire encoding of a payload that passed the viewer guard.
 * `decodeBigInts` reverses exactly the sentinels the page's encoder writes,
 * so the payload keeps its static type. This is the only cast on decoder
 * output.
 */
function decodeWire<T>(value: T): T {
  return decodeBigInts(value) as T;
}

export interface SyncState {
  readonly queries: Map<string, QueryEntry>;
  readonly mutations: Map<number, MutationEntry>;
  readonly status: SyncStatus;
}

export type SyncAction =
  /** A complete snapshot, which replaces the state. */
  | {
      readonly type: "SNAPSHOT";
      readonly queries: readonly QueryEntry[];
      readonly mutations: readonly MutationEntry[];
    }
  /** Chunks of a snapshot that is not complete yet. */
  | {
      readonly type: "SNAPSHOT_PROGRESS";
      readonly received: number;
      readonly total: number;
    }
  | { readonly type: "SNAPSHOT_FAILED" }
  | { readonly type: "UPDATE"; readonly changes: readonly ChangeEvent[] }
  | { readonly type: "DISCONNECTED" }
  | { readonly type: "CLEAR" };

const DISCONNECTED: SyncStatus = { kind: "disconnected" };
const CONNECTED: SyncStatus = { kind: "connected" };
const FAILED: SyncStatus = { kind: "failed" };

export const initialSyncState: SyncState = {
  queries: new Map(),
  mutations: new Map(),
  status: DISCONNECTED,
};

export function syncReducer(state: SyncState, action: SyncAction): SyncState {
  switch (action.type) {
    case "SNAPSHOT": {
      const queries = new Map<string, QueryEntry>();
      for (const q of action.queries) queries.set(q.queryHash, q);
      const mutations = new Map<number, MutationEntry>();
      for (const m of action.mutations) mutations.set(m.mutationId, m);
      return { queries, mutations, status: CONNECTED };
    }
    case "SNAPSHOT_PROGRESS":
      // A viewer with a snapshot keeps showing it until the next one is
      // complete, rather than a mix of the two or the loading screen.
      if (state.status.kind === "connected") return state;
      return {
        ...state,
        status: {
          kind: "loading",
          received: action.received,
          total: action.total,
        },
      };
    case "UPDATE": {
      // Changes only apply on top of a snapshot; before one (or after a
      // disconnect or a failure) there is nothing consistent to patch.
      if (state.status.kind !== "connected") return state;
      // Copy only a map the batch can touch; an untouched map keeps its
      // identity so the memoized list built from it is reused.
      const queries = action.changes.some((c) => c.entityType === "query")
        ? new Map(state.queries)
        : state.queries;
      const mutations = action.changes.some((c) => c.entityType === "mutation")
        ? new Map(state.mutations)
        : state.mutations;
      const { queriesChanged, mutationsChanged } = applyChanges(
        queries,
        mutations,
        action.changes,
      );
      if (!queriesChanged && !mutationsChanged) return state;
      return {
        queries: queriesChanged ? queries : state.queries,
        mutations: mutationsChanged ? mutations : state.mutations,
        status: CONNECTED,
      };
    }
    case "SNAPSHOT_FAILED":
      return { queries: new Map(), mutations: new Map(), status: FAILED };
    case "DISCONNECTED":
    case "CLEAR":
      return { queries: new Map(), mutations: new Map(), status: DISCONNECTED };
  }
}

function warn(text: string): void {
  console.warn(`[tanstack-query-devtools] ${text}`);
}

/** The `type` an unchecked message claims, if it has one. */
function claimedType(message: unknown): unknown {
  if (typeof message !== "object" || message === null) return undefined;
  return "type" in message ? message.type : undefined;
}

/**
 * Returns the message handler of one viewer port, which turns what the
 * background sends into `SyncAction`s. One per port: a new port starts with
 * no snapshot in progress, and its updates apply only once a snapshot has
 * completed on it, since updates follow the snapshot they were made on.
 */
export function createViewerStream(
  dispatch: (action: SyncAction) => void,
): (message: unknown) => void {
  let partial: PartialSnapshot | null = null;
  /** A snapshot completed on this port and none failed since. */
  let synced = false;

  function fail(reason: string): void {
    warn(reason);
    partial = null;
    synced = false;
    dispatch({ type: "SNAPSHOT_FAILED" });
  }

  function onChunk(chunk: SnapshotChunk): void {
    const result = addChunk(partial, chunk);
    switch (result.kind) {
      case "partial":
        partial = result.partial;
        dispatch({
          type: "SNAPSHOT_PROGRESS",
          received: result.partial.chunks.length,
          total: result.partial.chunkCount,
        });
        return;
      case "complete":
        partial = null;
        synced = true;
        dispatch({
          type: "SNAPSHOT",
          queries: result.queries,
          mutations: result.mutations,
        });
        return;
      case "broken":
        fail("a snapshot arrived incomplete");
        return;
      case "stray":
        return;
    }
  }

  return (message) => {
    // Checked on the encoded form; decoding never throws and keeps the
    // checked structure
    if (!isBackgroundToViewerMessage(message)) {
      // Losing a snapshot chunk, or an update to what is shown, leaves the
      // state behind the page
      const type = claimedType(message);
      if (
        type === "SYNC_SNAPSHOT" ||
        (type === "SYNC_UPDATE" && (synced || partial !== null))
      ) {
        fail(`dropped a malformed ${type} message`);
      } else {
        warn("ignored a malformed message from the background");
      }
      return;
    }
    switch (message.type) {
      case "SYNC_SNAPSHOT":
        // Decoded chunk by chunk, so the work is spread like the transfer
        onChunk({
          ...message,
          queries: decodeWire(message.queries),
          mutations: decodeWire(message.mutations),
        });
        return;
      case "SYNC_UPDATE":
        if (partial !== null) {
          // A snapshot's chunks are sent back to back
          fail("a snapshot arrived incomplete");
          return;
        }
        if (!synced) return;
        dispatch({ type: "UPDATE", changes: decodeWire(message.changes) });
        return;
      case "SYNC_SNAPSHOT_FAILED":
        partial = null;
        synced = false;
        dispatch({ type: "SNAPSHOT_FAILED" });
        return;
      case "SYNC_DISCONNECTED":
        partial = null;
        synced = false;
        dispatch({ type: "DISCONNECTED" });
        return;
      case "SYNC_CLEAR":
        partial = null;
        synced = false;
        dispatch({ type: "CLEAR" });
        return;
      case "CONNECT_ACK":
        // Carries no state
        return;
    }
  };
}
