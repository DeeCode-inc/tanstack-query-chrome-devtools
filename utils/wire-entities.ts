import type { ChangeEvent } from "@/types/messages";
import type { MutationEntry, QueryEntry } from "@/types/ui";
import {
  encodeForWire,
  type WireEncoding,
  withFieldBudget,
} from "@/utils/serialization";

/**
 * Wire encoding of the entities the page streams, one entity per call.
 *
 * An entry is encoded with an unbounded budget, so its structure (hashes, ids,
 * statuses, counts, timestamps) always arrives whole and keeps passing the
 * guards in `utils/guards.ts`. Each user-data field gets a budget of its own
 * (`FIELD_BUDGET_BYTES`), so a field that would blow up is cut on its own
 * without touching the structure or its sibling fields. A cut field keeps its
 * root type: `queryKey` and `mutationKey` stay arrays and `fetchMeta` a
 * record (see `encodeForWire`).
 *
 * The returned `utf8Bytes` is the exact JSON size of the encoded entity in
 * UTF-8, for sizing messages.
 *
 * The encoded value keeps the entity's decoded type: `decodeBigInts` on the
 * viewer side reverses every sentinel the encoder writes, the truncation ones
 * included. This is the only cast on encoder output.
 */
function encodeEntity<T>(skeleton: unknown): WireEncoding<T> {
  return encodeForWire(skeleton, Number.POSITIVE_INFINITY) as WireEncoding<T>;
}

/** The entry with every user-data field marked for a budget of its own. */
function querySkeleton(entry: QueryEntry): unknown {
  const { state } = entry;
  // Spreads keep the key order, so an uncut entry encodes as it always did.
  return {
    ...entry,
    queryKey: withFieldBudget(entry.queryKey),
    meta: withFieldBudget(entry.meta),
    state: {
      ...state,
      data: withFieldBudget(state.data),
      error: withFieldBudget(state.error),
      fetchFailureReason: withFieldBudget(state.fetchFailureReason),
      fetchMeta: withFieldBudget(state.fetchMeta),
    },
  };
}

function mutationSkeleton(entry: MutationEntry): unknown {
  const { state } = entry;
  return {
    ...entry,
    mutationKey: withFieldBudget(entry.mutationKey),
    state: {
      ...state,
      variables: withFieldBudget(state.variables),
      context: withFieldBudget(state.context),
      data: withFieldBudget(state.data),
      error: withFieldBudget(state.error),
      failureReason: withFieldBudget(state.failureReason),
    },
  };
}

export function encodeQueryEntry(entry: QueryEntry): WireEncoding<QueryEntry> {
  return encodeEntity(querySkeleton(entry));
}

export function encodeMutationEntry(
  entry: MutationEntry,
): WireEncoding<MutationEntry> {
  return encodeEntity(mutationSkeleton(entry));
}

/**
 * A change carries user data only in the entry of an "added" or "updated"
 * change; removals and observer patches are structure only.
 */
export function encodeChange(change: ChangeEvent): WireEncoding<ChangeEvent> {
  if (change.changeType === "added" || change.changeType === "updated") {
    return encodeEntity(
      change.entityType === "query"
        ? { ...change, entry: querySkeleton(change.entry) }
        : { ...change, entry: mutationSkeleton(change.entry) },
    );
  }
  return encodeEntity(change);
}
