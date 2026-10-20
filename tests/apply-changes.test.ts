import { describe, expect, it } from "vitest";
import type { ChangeEvent, QueryObserversPatch } from "@/types/messages";
import type { MutationEntry, QueryEntry } from "@/types/ui";
import { applyChanges } from "@/utils/apply-changes";
import { makeMutation, makeQuery } from "./fixtures";

function emptyMaps() {
  return {
    queries: new Map<string, QueryEntry>(),
    mutations: new Map<number, MutationEntry>(),
  };
}

const observersPatch: QueryObserversPatch = {
  observerCount: 2,
  status: "fetching",
  isActive: true,
  isDisabled: false,
};

describe("applyChanges — queries", () => {
  it("stores the entry of an added or updated query", () => {
    const { queries, mutations } = emptyMaps();
    const added = makeQuery("q1", { dataUpdatedAt: 1 });
    const updated = makeQuery("q1", { dataUpdatedAt: 2 });

    expect(
      applyChanges(queries, mutations, [
        {
          entityType: "query",
          changeType: "added",
          queryHash: "q1",
          entry: added,
        },
      ]),
    ).toEqual({ queriesChanged: true, mutationsChanged: false });
    expect(queries.get("q1")).toBe(added);

    applyChanges(queries, mutations, [
      {
        entityType: "query",
        changeType: "updated",
        queryHash: "q1",
        entry: updated,
      },
    ]);
    expect(queries.get("q1")).toBe(updated);
    expect(queries.size).toBe(1);
  });

  it("deletes a removed query and reports no change for an unknown one", () => {
    const { queries, mutations } = emptyMaps();
    queries.set("q1", makeQuery("q1"));

    expect(
      applyChanges(queries, mutations, [
        { entityType: "query", changeType: "removed", queryHash: "missing" },
      ]),
    ).toEqual({ queriesChanged: false, mutationsChanged: false });
    expect(queries.size).toBe(1);

    expect(
      applyChanges(queries, mutations, [
        { entityType: "query", changeType: "removed", queryHash: "q1" },
      ]),
    ).toEqual({ queriesChanged: true, mutationsChanged: false });
    expect(queries.has("q1")).toBe(false);
  });

  it("merges an observers patch onto the known entry and keeps the rest", () => {
    const { queries, mutations } = emptyMaps();
    const existing = makeQuery("q1", {
      observerCount: 0,
      status: "inactive",
      dataUpdatedAt: 5,
    });
    queries.set("q1", existing);

    const result = applyChanges(queries, mutations, [
      {
        entityType: "query",
        changeType: "observers",
        queryHash: "q1",
        patch: observersPatch,
      },
    ]);

    expect(result).toEqual({ queriesChanged: true, mutationsChanged: false });
    const merged = queries.get("q1");
    expect(merged).toEqual({ ...existing, ...observersPatch });
    // A new entry object; unpatched fields are shared, the old entry untouched
    expect(merged).not.toBe(existing);
    expect(merged?.state).toBe(existing.state);
    expect(merged?.queryKey).toBe(existing.queryKey);
    expect(existing.observerCount).toBe(0);
  });

  it("ignores an observers patch for an unknown query", () => {
    const { queries, mutations } = emptyMaps();
    const result = applyChanges(queries, mutations, [
      {
        entityType: "query",
        changeType: "observers",
        queryHash: "q1",
        patch: observersPatch,
      },
    ]);
    expect(result).toEqual({ queriesChanged: false, mutationsChanged: false });
    expect(queries.size).toBe(0);
  });

  it("applies the changes of one batch in order", () => {
    const { queries, mutations } = emptyMaps();
    const entry = makeQuery("q1");
    const removedThenAdded: ChangeEvent[] = [
      { entityType: "query", changeType: "removed", queryHash: "q1" },
      { entityType: "query", changeType: "added", queryHash: "q1", entry },
      {
        entityType: "query",
        changeType: "observers",
        queryHash: "q1",
        patch: observersPatch,
      },
    ];
    applyChanges(queries, mutations, removedThenAdded);
    expect(queries.get("q1")).toEqual({ ...entry, ...observersPatch });

    applyChanges(queries, mutations, [
      { entityType: "query", changeType: "added", queryHash: "q2", entry },
      { entityType: "query", changeType: "removed", queryHash: "q2" },
    ]);
    expect(queries.has("q2")).toBe(false);
  });
});

describe("applyChanges — mutations", () => {
  it("stores added and updated mutations and deletes removed ones", () => {
    const { queries, mutations } = emptyMaps();
    const added = makeMutation(1, { status: "pending", submittedAt: 1 });
    const updated = makeMutation(1, { status: "success", submittedAt: 1 });

    expect(
      applyChanges(queries, mutations, [
        {
          entityType: "mutation",
          changeType: "added",
          mutationId: 1,
          entry: added,
        },
      ]),
    ).toEqual({ queriesChanged: false, mutationsChanged: true });
    expect(mutations.get(1)).toBe(added);

    applyChanges(queries, mutations, [
      {
        entityType: "mutation",
        changeType: "updated",
        mutationId: 1,
        entry: updated,
      },
    ]);
    expect(mutations.get(1)).toBe(updated);

    expect(
      applyChanges(queries, mutations, [
        { entityType: "mutation", changeType: "removed", mutationId: 2 },
      ]),
    ).toEqual({ queriesChanged: false, mutationsChanged: false });
    expect(
      applyChanges(queries, mutations, [
        { entityType: "mutation", changeType: "removed", mutationId: 1 },
      ]),
    ).toEqual({ queriesChanged: false, mutationsChanged: true });
    expect(mutations.size).toBe(0);
  });
});

describe("applyChanges — maps", () => {
  it("mutates the given maps in place and flags each one separately", () => {
    const { queries, mutations } = emptyMaps();
    const queryEntry = makeQuery("q1");
    const mutationEntry = makeMutation(7);

    const result = applyChanges(queries, mutations, [
      {
        entityType: "query",
        changeType: "added",
        queryHash: "q1",
        entry: queryEntry,
      },
      {
        entityType: "mutation",
        changeType: "added",
        mutationId: 7,
        entry: mutationEntry,
      },
    ]);

    expect(result).toEqual({ queriesChanged: true, mutationsChanged: true });
    expect(queries.get("q1")).toBe(queryEntry);
    expect(mutations.get(7)).toBe(mutationEntry);
  });

  it("reports nothing changed for an empty batch", () => {
    const { queries, mutations } = emptyMaps();
    expect(applyChanges(queries, mutations, [])).toEqual({
      queriesChanged: false,
      mutationsChanged: false,
    });
  });
});
