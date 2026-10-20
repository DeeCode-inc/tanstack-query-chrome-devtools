import { describe, expect, it, vi } from "vitest";
import type { MutationEntry, QueryEntry } from "@/types/ui";
import { sortMutations, sortQueries } from "@/utils/sorting";
import { makeMutation, makeQuery } from "./fixtures";

const hashes = (entries: readonly QueryEntry[]) =>
  entries.map((q) => q.queryHash);
const ids = (entries: readonly MutationEntry[]) =>
  entries.map((m) => m.mutationId);

/**
 * Runs `sort` and returns the comparator it handed to `Array#sort`, so the
 * comparator's raw return values can be checked (`Array#sort` itself turns a
 * NaN result into 0 and hides it).
 */
function captureComparator<T>(sort: () => void): (a: T, b: T) => number {
  const sortSpy = vi.spyOn(Array.prototype, "sort");
  try {
    sort();
    const compare: unknown = sortSpy.mock.calls[0]?.[0];
    if (typeof compare !== "function") throw new Error("no comparator");
    return compare as (a: T, b: T) => number;
  } finally {
    sortSpy.mockRestore();
  }
}

describe("sortQueries", () => {
  it("orders never-updated queries of one status by queryHash", () => {
    const queries = [makeQuery("c"), makeQuery("a"), makeQuery("b")];
    expect(
      hashes(sortQueries(queries, { term: "status", direction: "asc" })),
    ).toEqual(["a", "b", "c"]);
    expect(
      hashes(sortQueries(queries, { term: "status", direction: "desc" })),
    ).toEqual(["c", "b", "a"]);
  });

  it("sorts by status rank first", () => {
    const queries = [
      makeQuery("inactive", { status: "inactive", dataUpdatedAt: 5 }),
      makeQuery("fetching", { status: "fetching", dataUpdatedAt: 1 }),
      makeQuery("stale", { status: "stale", dataUpdatedAt: 3 }),
      makeQuery("fresh", { status: "fresh", dataUpdatedAt: 2 }),
    ];
    expect(
      hashes(sortQueries(queries, { term: "status", direction: "asc" })),
    ).toEqual(["fetching", "fresh", "stale", "inactive"]);
  });

  it("puts the most recent first within a status and never-updated last", () => {
    const queries = [
      makeQuery("old", { dataUpdatedAt: 100 }),
      makeQuery("never", { dataUpdatedAt: 0 }),
      makeQuery("new", { dataUpdatedAt: 200 }),
    ];
    expect(
      hashes(sortQueries(queries, { term: "status", direction: "asc" })),
    ).toEqual(["new", "old", "never"]);
    expect(
      hashes(sortQueries(queries, { term: "status", direction: "desc" })),
    ).toEqual(["never", "old", "new"]);
  });

  it("sorts by queryHash", () => {
    const queries = [makeQuery("b"), makeQuery("c"), makeQuery("a")];
    expect(
      hashes(sortQueries(queries, { term: "queryHash", direction: "asc" })),
    ).toEqual(["a", "b", "c"]);
    expect(
      hashes(sortQueries(queries, { term: "queryHash", direction: "desc" })),
    ).toEqual(["c", "b", "a"]);
  });

  it("sorts by last updated, never-updated as oldest", () => {
    const queries = [
      makeQuery("b", { dataUpdatedAt: 200 }),
      makeQuery("never", { dataUpdatedAt: 0 }),
      makeQuery("a", { dataUpdatedAt: 100 }),
    ];
    expect(
      hashes(sortQueries(queries, { term: "lastUpdated", direction: "asc" })),
    ).toEqual(["never", "a", "b"]);
    expect(
      hashes(sortQueries(queries, { term: "lastUpdated", direction: "desc" })),
    ).toEqual(["b", "a", "never"]);
  });

  it("returns a new array and leaves the input order alone", () => {
    const queries = [makeQuery("b"), makeQuery("a")];
    const sorted = sortQueries(queries, {
      term: "queryHash",
      direction: "asc",
    });
    expect(sorted).not.toBe(queries);
    expect(hashes(queries)).toEqual(["b", "a"]);
  });

  it.each(["status", "lastUpdated"] as const)(
    "%s comparator is never NaN and antisymmetric",
    (term) => {
      const queries = [
        makeQuery("never-1"),
        makeQuery("never-2"),
        makeQuery("old", { dataUpdatedAt: 100 }),
        makeQuery("new", { dataUpdatedAt: 200 }),
      ];
      const compare = captureComparator<QueryEntry>(() =>
        sortQueries(queries, { term, direction: "asc" }),
      );
      for (const a of queries) {
        for (const b of queries) {
          const ab = compare(a, b);
          expect(Number.isNaN(ab)).toBe(false);
          expect(Math.sign(ab) === -Math.sign(compare(b, a))).toBe(true);
        }
      }
    },
  );
});

describe("sortMutations", () => {
  it("orders never-submitted mutations of one status by mutationId", () => {
    const mutations = [makeMutation(3), makeMutation(1), makeMutation(2)];
    expect(
      ids(sortMutations(mutations, { term: "status", direction: "asc" })),
    ).toEqual([1, 2, 3]);
    expect(
      ids(sortMutations(mutations, { term: "status", direction: "desc" })),
    ).toEqual([3, 2, 1]);
  });

  it("sorts by status rank, then most recent submission first", () => {
    const mutations = [
      makeMutation(1, { status: "idle", submittedAt: 0 }),
      makeMutation(2, { status: "error", submittedAt: 10 }),
      makeMutation(3, { status: "success", submittedAt: 10 }),
      makeMutation(4, { status: "pending", submittedAt: 10 }),
      makeMutation(5, { status: "success", submittedAt: 20 }),
    ];
    expect(
      ids(sortMutations(mutations, { term: "status", direction: "asc" })),
    ).toEqual([4, 5, 3, 2, 1]);
  });

  it("sorts by last updated, never-submitted as oldest", () => {
    const mutations = [
      makeMutation(1, { submittedAt: 200 }),
      makeMutation(2, { submittedAt: 0 }),
      makeMutation(3, { submittedAt: 100 }),
    ];
    expect(
      ids(sortMutations(mutations, { term: "lastUpdated", direction: "asc" })),
    ).toEqual([2, 3, 1]);
    expect(
      ids(sortMutations(mutations, { term: "lastUpdated", direction: "desc" })),
    ).toEqual([1, 3, 2]);
  });

  it.each(["status", "lastUpdated"] as const)(
    "%s comparator is never NaN and antisymmetric",
    (term) => {
      const mutations = [
        makeMutation(1),
        makeMutation(2),
        makeMutation(3, { submittedAt: 100 }),
        makeMutation(4, { submittedAt: 200 }),
      ];
      const compare = captureComparator<MutationEntry>(() =>
        sortMutations(mutations, { term, direction: "asc" }),
      );
      for (const a of mutations) {
        for (const b of mutations) {
          const ab = compare(a, b);
          expect(Number.isNaN(ab)).toBe(false);
          expect(Math.sign(ab) === -Math.sign(compare(b, a))).toBe(true);
        }
      }
    },
  );
});
