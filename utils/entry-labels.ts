import type { MutationEntry, QueryEntry } from "@/types/ui";
import { stringifyWithBigInt } from "@/utils/serialization";

/** Display label and its lowercase form used by the filter. */
interface CachedLabel {
  readonly label: string;
  readonly search: string;
}

// Entries are replaced, never mutated, when the page reports a change, so an
// entry object's label never goes stale and is computed once per object.
const queryLabels = new WeakMap<QueryEntry, CachedLabel>();
const mutationLabels = new WeakMap<MutationEntry, CachedLabel>();

function cachedQueryLabel(query: QueryEntry): CachedLabel {
  let cached = queryLabels.get(query);
  if (cached === undefined) {
    // The hash, not a re-serialized key, as in the official devtools: it is
    // TanStack's own identity for the query and honors a custom
    // `queryKeyHashFn`, which can name what the key alone cannot (functions).
    const label = query.queryHash;
    cached = { label, search: label.toLowerCase() };
    queryLabels.set(query, cached);
  }
  return cached;
}

function cachedMutationLabel(mutation: MutationEntry): CachedLabel {
  let cached = mutationLabels.get(mutation);
  if (cached === undefined) {
    const label = mutation.mutationKey
      ? stringifyWithBigInt(mutation.mutationKey)
      : `Mutation #${String(mutation.mutationId)}`;
    cached = { label, search: label.toLowerCase() };
    mutationLabels.set(mutation, cached);
  }
  return cached;
}

/** Text shown for a query in the list: its `queryHash`. */
export function getQueryLabel(query: QueryEntry): string {
  return cachedQueryLabel(query).label;
}

/** Lowercase query label, matched by the filter. */
export function getQuerySearchText(query: QueryEntry): string {
  return cachedQueryLabel(query).search;
}

/**
 * Text shown for a mutation in the list. Unkeyed mutations are named by their
 * id, so the label does not change with the sort order.
 */
export function getMutationLabel(mutation: MutationEntry): string {
  return cachedMutationLabel(mutation).label;
}

/** Lowercase mutation label, matched by the filter. */
export function getMutationSearchText(mutation: MutationEntry): string {
  return cachedMutationLabel(mutation).search;
}
