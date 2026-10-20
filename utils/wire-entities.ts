import type { ChangeEvent } from "@/types/messages";
import type { MutationEntry, QueryEntry } from "@/types/ui";
import { jsonUtf8Bytes, MAX_ITEM_BYTES } from "@/utils/chunking";
import {
  encodeForWire,
  FIELD_BUDGET_BYTES,
  type WireEncoding,
  withFieldBudget,
} from "@/utils/serialization";

/**
 * Wire encoding of the entities the page streams, one entity per call.
 *
 * An entry is encoded with an unbounded budget, so its structure (hashes, ids,
 * statuses, counts, timestamps) always arrives whole and keeps passing the
 * guards in `utils/guards.ts`. Each user-data field gets a budget of its own
 * (`FIELD_BUDGET_BYTES` unless given), so a field that would blow up is cut
 * on its own without touching the structure or its sibling fields. A cut
 * field keeps its root type: `queryKey` and `mutationKey` stay arrays and
 * `fetchMeta` a record (see `encodeForWire`).
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

/** User-data fields of a query entry, and of a mutation entry. */
const USER_DATA_FIELDS = 6;

/** The entry with every user-data field marked for a budget of its own. */
function querySkeleton(entry: QueryEntry, fieldBudgetBytes: number): unknown {
  const { state } = entry;
  // Spreads keep the key order, so an uncut entry encodes as it always did.
  return {
    ...entry,
    queryKey: withFieldBudget(entry.queryKey, fieldBudgetBytes),
    meta: withFieldBudget(entry.meta, fieldBudgetBytes),
    state: {
      ...state,
      data: withFieldBudget(state.data, fieldBudgetBytes),
      error: withFieldBudget(state.error, fieldBudgetBytes),
      fetchFailureReason: withFieldBudget(
        state.fetchFailureReason,
        fieldBudgetBytes,
      ),
      fetchMeta: withFieldBudget(state.fetchMeta, fieldBudgetBytes),
    },
  };
}

function mutationSkeleton(
  entry: MutationEntry,
  fieldBudgetBytes: number,
): unknown {
  const { state } = entry;
  return {
    ...entry,
    mutationKey: withFieldBudget(entry.mutationKey, fieldBudgetBytes),
    state: {
      ...state,
      variables: withFieldBudget(state.variables, fieldBudgetBytes),
      context: withFieldBudget(state.context, fieldBudgetBytes),
      data: withFieldBudget(state.data, fieldBudgetBytes),
      error: withFieldBudget(state.error, fieldBudgetBytes),
      failureReason: withFieldBudget(state.failureReason, fieldBudgetBytes),
    },
  };
}

export function encodeQueryEntry(
  entry: QueryEntry,
  fieldBudgetBytes: number = FIELD_BUDGET_BYTES,
): WireEncoding<QueryEntry> {
  return encodeEntity(querySkeleton(entry, fieldBudgetBytes));
}

export function encodeMutationEntry(
  entry: MutationEntry,
  fieldBudgetBytes: number = FIELD_BUDGET_BYTES,
): WireEncoding<MutationEntry> {
  return encodeEntity(mutationSkeleton(entry, fieldBudgetBytes));
}

/**
 * A change carries user data only in the entry of an "added" or "updated"
 * change; removals and observer patches are structure only.
 */
export function encodeChange(
  change: ChangeEvent,
  fieldBudgetBytes: number = FIELD_BUDGET_BYTES,
): WireEncoding<ChangeEvent> {
  if (change.changeType === "added" || change.changeType === "updated") {
    return encodeEntity(
      change.entityType === "query"
        ? { ...change, entry: querySkeleton(change.entry, fieldBudgetBytes) }
        : {
            ...change,
            entry: mutationSkeleton(change.entry, fieldBudgetBytes),
          },
    );
  }
  return encodeEntity(change);
}

// === Fitting one message ===

/**
 * Longest `queryHash` sent, in UTF-8 bytes of JSON. The hash is the JSON of
 * the query key and identifies the query in every change and edit request,
 * so it is never cut. A query with a longer hash is not sent at all, neither
 * in a snapshot nor in any change, so the extension never holds a part of
 * its history.
 */
export const MAX_QUERY_HASH_BYTES = 8 * 1024 * 1024;

/**
 * Bound on the JSON of an entity's or change's structure besides the query
 * hash and the user-data fields: keys, statuses, counts and timestamps, well
 * under 1 KiB.
 */
const STRUCTURE_BYTES = 4 * 1024;

/**
 * Field budget of the second encoding of an item that does not fit in one
 * message (`MAX_ITEM_BYTES`) with the default budgets: six fields at up to
 * 8 MiB each make about 48 MiB. A change carries the query hash twice (on the
 * change and on its entry), so with a hash within `MAX_QUERY_HASH_BYTES`
 * every item encoded with this budget fits. About 2.7 MiB.
 */
export const FALLBACK_FIELD_BUDGET_BYTES = Math.floor(
  (MAX_ITEM_BYTES - 2 * MAX_QUERY_HASH_BYTES - STRUCTURE_BYTES) /
    USER_DATA_FIELDS,
);

/** A JSON string takes at most 6 bytes per UTF-16 code unit (`\u001f`). */
const MAX_JSON_BYTES_PER_CODE_UNIT = 6;

function isSendableQueryHash(queryHash: string): boolean {
  // Measuring is only needed for a hash long enough to possibly be over.
  if (
    queryHash.length * MAX_JSON_BYTES_PER_CODE_UNIT + 2 <=
    MAX_QUERY_HASH_BYTES
  )
    return true;
  return jsonUtf8Bytes(queryHash) <= MAX_QUERY_HASH_BYTES;
}

function fitToMessage<T>(
  encode: (fieldBudgetBytes: number) => WireEncoding<T>,
): WireEncoding<T> | null {
  const full = encode(FIELD_BUDGET_BYTES);
  if (full.utf8Bytes <= MAX_ITEM_BYTES) return full;
  const reduced = encode(FALLBACK_FIELD_BUDGET_BYTES);
  // Always fits (see FALLBACK_FIELD_BUDGET_BYTES); checked anyway, so that a
  // wrong bound costs this one item rather than the message carrying it.
  return reduced.utf8Bytes <= MAX_ITEM_BYTES ? reduced : null;
}

/**
 * Encodes an entry so that it fits in one message on its own: with the
 * default field budgets when it fits, otherwise once more with
 * `FALLBACK_FIELD_BUDGET_BYTES` per field. `null` for a query whose hash is
 * over `MAX_QUERY_HASH_BYTES`, which is never sent.
 */
export function encodeQueryEntryForMessage(
  entry: QueryEntry,
): WireEncoding<QueryEntry> | null {
  if (!isSendableQueryHash(entry.queryHash)) return null;
  return fitToMessage((budget) => encodeQueryEntry(entry, budget));
}

/** `encodeQueryEntryForMessage` for a mutation, whose structure is bounded. */
export function encodeMutationEntryForMessage(
  entry: MutationEntry,
): WireEncoding<MutationEntry> | null {
  return fitToMessage((budget) => encodeMutationEntry(entry, budget));
}

/**
 * `encodeQueryEntryForMessage` for a change. Every change of a query whose
 * hash is not sent is dropped too, the removal included: the receivers never
 * had the query.
 */
export function encodeChangeForMessage(
  change: ChangeEvent,
): WireEncoding<ChangeEvent> | null {
  if (change.entityType === "query" && !isSendableQueryHash(change.queryHash))
    return null;
  return fitToMessage((budget) => encodeChange(change, budget));
}
