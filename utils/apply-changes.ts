import type { ChangeEvent } from "@/types/messages";
import type { MutationEntry, QueryEntry } from "@/types/ui";

/** Which of the two maps `applyChanges` actually modified. */
interface AppliedChanges {
  readonly queriesChanged: boolean;
  readonly mutationsChanged: boolean;
}

/**
 * Applies a batch of change events to entry maps keyed by `queryHash` and
 * `mutationId`, mutating both maps in place. Shared by the background tab
 * cache and the viewer reducer so both stay in step with the page.
 *
 * An `observers` patch only refreshes an entry that is already known; a patch
 * for an unknown query is ignored because it carries no data to show.
 *
 * Returns which maps were modified, so a caller holding copies can keep the
 * original of an untouched map.
 */
export function applyChanges(
  queries: Map<string, QueryEntry>,
  mutations: Map<number, MutationEntry>,
  changes: readonly ChangeEvent[],
): AppliedChanges {
  let queriesChanged = false;
  let mutationsChanged = false;
  for (const change of changes) {
    if (change.entityType === "query") {
      switch (change.changeType) {
        case "added":
        case "updated":
          queries.set(change.queryHash, change.entry);
          queriesChanged = true;
          break;
        case "removed":
          if (queries.delete(change.queryHash)) queriesChanged = true;
          break;
        case "observers": {
          const existing = queries.get(change.queryHash);
          if (existing) {
            queries.set(change.queryHash, { ...existing, ...change.patch });
            queriesChanged = true;
          }
          break;
        }
        default:
          change satisfies never;
      }
    } else {
      switch (change.changeType) {
        case "added":
        case "updated":
          mutations.set(change.mutationId, change.entry);
          mutationsChanged = true;
          break;
        case "removed":
          if (mutations.delete(change.mutationId)) mutationsChanged = true;
          break;
        default:
          change satisfies never;
      }
    }
  }
  return { queriesChanged, mutationsChanged };
}
