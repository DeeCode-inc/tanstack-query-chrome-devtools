import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  BRIDGE_SOURCE,
  type ChangeEvent,
  type SnapshotChunkFields,
} from "@/types/messages";
import type { QueryEntry } from "@/types/ui";
import {
  addChunk,
  type ChunkResult,
  jsonUtf8Bytes,
  MAX_ITEM_BYTES,
  MAX_MESSAGE_BYTES,
  type PartialSnapshot,
  packBySize,
  type Sized,
  type SnapshotChunk,
  type SnapshotPart,
  snapshotChunkMessages,
  splitSnapshot,
  TARGET_MESSAGE_BYTES,
  utf8ByteLength,
} from "@/utils/chunking";
import {
  isBackgroundToViewerMessage,
  isContentToBackgroundMessage,
  parseBridgeMessage,
} from "@/utils/guards";
import {
  createResyncScheduler,
  RESYNC_MAX_DELAY_MS,
  RESYNC_MIN_DELAY_MS,
} from "@/utils/resync";
import { decodeBigInts, EncodePass, TRUNCATED } from "@/utils/serialization";
import {
  encodeChangeForMessage,
  encodeMutationEntryForMessage,
  encodeQueryEntry,
  encodeQueryEntryForMessage,
  FALLBACK_FIELD_BUDGET_BYTES,
  MAX_QUERY_HASH_BYTES,
} from "@/utils/wire-entities";
import { makeMutation, makeQuery } from "./fixtures";

const MiB = 1024 * 1024;

/** An item of a given JSON size, for packing. */
function sized<T>(value: T, utf8Bytes: number): Sized<T> {
  return { value, utf8Bytes };
}

/** A wire-encoded query entry with its exact size. */
function wireQuery(queryHash: string, data?: unknown): Sized<QueryEntry> {
  return encodeQueryEntry(
    makeQuery(queryHash, { state: { ...makeQuery(queryHash).state, data } }),
  );
}

/** What a port carries: the JSON of the message, as the receiver parses it. */
function overPort<T>(value: T): unknown {
  return JSON.parse(JSON.stringify(value));
}

describe("utf8ByteLength", () => {
  it.each([
    ["ASCII", 'plain {"json": [1, 2]}'],
    ["two-byte", "Zürich ключ"],
    ["three-byte", "日本語 €"],
    ["four-byte", "😀 𝄞"],
    ["lone surrogates", "\ud800 x \udc00 \udbff"],
    ["empty", ""],
  ])("matches the encoder for %s", (_, s) => {
    expect(utf8ByteLength(s)).toBe(new TextEncoder().encode(s).length);
  });

  it("measures JSON, escapes included", () => {
    const value = { k: 'q"uote\n', ü: ["😀"] };
    expect(jsonUtf8Bytes(value)).toBe(
      new TextEncoder().encode(JSON.stringify(value)).length,
    );
  });
});

describe("packBySize", () => {
  it("keeps the order and every group within the target", () => {
    const items = [5, 3, 4, 1, 6, 2].map((n) => sized(n, n * 10));
    const groups = packBySize(items, 100);
    expect(groups.flat()).toEqual([5, 3, 4, 1, 6, 2]);
    for (const group of groups) {
      // Items plus a comma between each two
      const bytes =
        group.reduce((sum, n) => sum + n * 10, 0) + group.length - 1;
      expect(bytes).toBeLessThanOrEqual(100);
    }
    expect(groups).toEqual([
      [5, 3],
      [4, 1],
      [6, 2],
    ]);
  });

  it("counts the commas between items", () => {
    // 4 items of 25 bytes are 103 bytes as a list
    const groups = packBySize(
      [1, 2, 3, 4].map((n) => sized(n, 25)),
      100,
    );
    expect(groups).toEqual([[1, 2, 3], [4]]);
  });

  it("gives an item over the target a group of its own", () => {
    const groups = packBySize(
      [sized("a", 10), sized("big", 500), sized("b", 10)],
      100,
    );
    expect(groups).toEqual([["a"], ["big"], ["b"]]);
  });

  it("makes no group of no items", () => {
    expect(packBySize([], 100)).toEqual([]);
  });
});

describe("splitSnapshot", () => {
  it("makes one empty part of an empty snapshot", () => {
    expect(splitSnapshot([], [])).toEqual([{ queries: [], mutations: [] }]);
  });

  it("splits by size, queries first, and loses nothing", () => {
    const queries = Array.from({ length: 7 }, (_, i) =>
      wireQuery(`q${i}`, "x".repeat(300)),
    );
    const mutations = Array.from({ length: 3 }, (_, i) =>
      sized(makeMutation(i), 400),
    );
    const parts = splitSnapshot(queries, mutations, 1500);
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.flatMap((p) => p.queries)).toEqual(
      queries.map((q) => q.value),
    );
    expect(parts.flatMap((p) => p.mutations)).toEqual(
      mutations.map((m) => m.value),
    );
    for (const part of parts) {
      // Two lists, so one comma fewer than counted
      expect(
        jsonUtf8Bytes(part.queries) + jsonUtf8Bytes(part.mutations) - 4,
      ).toBeLessThanOrEqual(1500);
    }
  });
});

// === Reassembly ===

function chunk(
  fields: SnapshotChunkFields,
  queryHashes: readonly string[] = [],
): SnapshotChunk {
  return {
    ...fields,
    queries: queryHashes.map((h) => makeQuery(h)),
    mutations: [],
  };
}

/** Feeds chunks to `addChunk` the way the background and viewers do. */
function assemble(chunks: readonly SnapshotChunk[]) {
  let partial: PartialSnapshot | null = null;
  const outcomes: string[] = [];
  let complete: readonly string[] | null = null;
  for (const c of chunks) {
    const result: ChunkResult<SnapshotChunk> = addChunk(partial, c);
    outcomes.push(result.kind);
    partial = result.kind === "partial" ? result.partial : null;
    if (result.kind === "complete") {
      complete = result.queries.map((q) => q.queryHash);
    }
  }
  return { outcomes, complete, partial };
}

describe("addChunk", () => {
  it("completes a snapshot of one chunk at once", () => {
    const result = assemble([
      chunk({ snapshotId: 1, chunkIndex: 0, chunkCount: 1 }, ["a"]),
    ]);
    expect(result).toEqual({
      outcomes: ["complete"],
      complete: ["a"],
      partial: null,
    });
  });

  it("joins the chunks of a snapshot in order", () => {
    const result = assemble([
      chunk({ snapshotId: 1, chunkIndex: 0, chunkCount: 3 }, ["a", "b"]),
      chunk({ snapshotId: 1, chunkIndex: 1, chunkCount: 3 }, ["c"]),
      chunk({ snapshotId: 1, chunkIndex: 2, chunkCount: 3 }, ["d"]),
    ]);
    expect(result.outcomes).toEqual(["partial", "partial", "complete"]);
    expect(result.complete).toEqual(["a", "b", "c", "d"]);
  });

  it("lets a new snapshot supersede an unfinished one, whose rest is ignored", () => {
    const result = assemble([
      chunk({ snapshotId: 1, chunkIndex: 0, chunkCount: 3 }, ["old1"]),
      chunk({ snapshotId: 1, chunkIndex: 1, chunkCount: 3 }, ["old2"]),
      chunk({ snapshotId: 2, chunkIndex: 0, chunkCount: 2 }, ["new1"]),
      chunk({ snapshotId: 2, chunkIndex: 1, chunkCount: 2 }, ["new2"]),
      chunk({ snapshotId: 1, chunkIndex: 2, chunkCount: 3 }, ["old3"]),
    ]);
    expect(result.outcomes).toEqual([
      "partial",
      "partial",
      "partial",
      "complete",
      "stray",
    ]);
    expect(result.complete).toEqual(["new1", "new2"]);
  });

  it.each<[string, SnapshotChunkFields]>([
    ["a skipped chunk", { snapshotId: 1, chunkIndex: 2, chunkCount: 3 }],
    ["another snapshot", { snapshotId: 2, chunkIndex: 1, chunkCount: 3 }],
    ["another count", { snapshotId: 1, chunkIndex: 1, chunkCount: 4 }],
  ])("abandons an unfinished snapshot on %s", (_, fields) => {
    const result = assemble([
      chunk({ snapshotId: 1, chunkIndex: 0, chunkCount: 3 }, ["a"]),
      chunk(fields, ["b"]),
      // The rest of either snapshot is then ignored
      chunk({ ...fields, chunkIndex: fields.chunkIndex + 1 }, ["c"]),
    ]);
    expect(result.outcomes).toEqual(["partial", "broken", "stray"]);
    expect(result.complete).toBeNull();
  });
});

// === Background → late viewer ===

describe("snapshotChunkMessages", () => {
  /** Entries the background got from the page, as it holds them. */
  function cachedEntries() {
    const queries = Array.from(
      { length: 40 },
      (_, i) =>
        overPort(
          wireQuery(`["q",${i}]`, "x".repeat(MiB / 2)).value,
        ) as QueryEntry,
    );
    // One entry over the target travels alone
    queries.splice(
      5,
      0,
      overPort(
        wireQuery('["big"]', "y".repeat(TARGET_MESSAGE_BYTES + 100)).value,
      ) as QueryEntry,
    );
    const mutations = Array.from({ length: 3 }, (_, i) => makeMutation(i));
    return { queries, mutations };
  }

  it("splits a cache into chunks within the cap that reassemble to it", () => {
    const { queries, mutations } = cachedEntries();
    const messages = snapshotChunkMessages(queries, mutations, 9);
    expect(messages.length).toBeGreaterThan(2);

    let partial: PartialSnapshot | null = null;
    let complete: SnapshotPart | null = null;
    for (const [i, message] of messages.entries()) {
      expect(message).toMatchObject({
        type: "SYNC_SNAPSHOT",
        snapshotId: 9,
        chunkIndex: i,
        chunkCount: messages.length,
      });
      const bytes = jsonUtf8Bytes(message);
      expect(bytes).toBeLessThanOrEqual(MAX_MESSAGE_BYTES);
      if (message.queries.length + message.mutations.length > 1) {
        expect(bytes).toBeLessThanOrEqual(TARGET_MESSAGE_BYTES + 1024);
      }
      // What the viewer receives passes its guard
      const received = overPort(message);
      expect(isBackgroundToViewerMessage(received)).toBe(true);
      const result: ChunkResult<SnapshotChunk> = addChunk(
        partial,
        received as SnapshotChunk,
      );
      partial = result.kind === "partial" ? result.partial : null;
      if (result.kind === "complete") complete = result;
    }
    expect(complete).toEqual({ kind: "complete", queries, mutations });
  });

  it("sends an empty cache as one empty chunk", () => {
    expect(snapshotChunkMessages([], [], 1)).toEqual([
      {
        type: "SYNC_SNAPSHOT",
        snapshotId: 1,
        chunkIndex: 0,
        chunkCount: 1,
        queries: [],
        mutations: [],
      },
    ]);
  });
});

// === Guards ===

describe("guards without a list cap", () => {
  const count = 12_000;
  const queries = Array.from(
    { length: count },
    (_, i) => encodeQueryEntry(makeQuery(`["q",${i}]`)).value,
  );
  const mutations = Array.from({ length: count }, (_, i) => makeMutation(i));
  const fields = { snapshotId: 1, chunkIndex: 0, chunkCount: 1 };

  it("accepts more than 10 000 entries on every hop", () => {
    const bridge = parseBridgeMessage(
      overPort({
        source: BRIDGE_SOURCE,
        type: "SYNC_SNAPSHOT",
        payload: { ...fields, queries, mutations },
      }),
    );
    expect(bridge?.type).toBe("SYNC_SNAPSHOT");
    if (bridge?.type !== "SYNC_SNAPSHOT") return;
    expect(bridge.payload.queries).toHaveLength(count);
    expect(bridge.payload.mutations).toHaveLength(count);

    const port = overPort({ type: "SYNC_SNAPSHOT", ...bridge.payload });
    expect(isContentToBackgroundMessage(port)).toBe(true);
    expect(isBackgroundToViewerMessage(port)).toBe(true);
  });

  it("accepts more than 10 000 changes in an update", () => {
    const changes: ChangeEvent[] = Array.from({ length: count }, (_, i) => ({
      entityType: "query",
      changeType: "removed",
      queryHash: `["q",${i}]`,
    }));
    expect(
      parseBridgeMessage({
        source: BRIDGE_SOURCE,
        type: "SYNC_UPDATE",
        payload: { changes },
      })?.type,
    ).toBe("SYNC_UPDATE");
    expect(isBackgroundToViewerMessage({ type: "SYNC_UPDATE", changes })).toBe(
      true,
    );
  });

  it("keeps only the checked chunk fields of a bridge snapshot", () => {
    const bridge = parseBridgeMessage({
      source: BRIDGE_SOURCE,
      type: "SYNC_SNAPSHOT",
      payload: { ...fields, queries: [], mutations: [], extra: 1 },
    });
    expect(bridge?.payload).toEqual({ ...fields, queries: [], mutations: [] });
  });

  it.each<[string, Record<string, unknown>]>([
    ["missing fields", {}],
    ["an index past the count", { ...fields, chunkIndex: 1 }],
    ["a count of zero", { ...fields, chunkCount: 0 }],
    ["a negative id", { ...fields, snapshotId: -1 }],
    ["a fractional index", { ...fields, chunkIndex: 0.5, chunkCount: 2 }],
    ["an unsafe id", { ...fields, snapshotId: 2 ** 53 }],
    ["a string count", { ...fields, chunkCount: "1" }],
  ])("rejects a snapshot chunk with %s", (_, chunkFields) => {
    const payload = { queries: [], mutations: [], ...chunkFields };
    expect(
      parseBridgeMessage({
        source: BRIDGE_SOURCE,
        type: "SYNC_SNAPSHOT",
        payload,
      }),
    ).toBeNull();
    expect(
      isContentToBackgroundMessage({ type: "SYNC_SNAPSHOT", ...payload }),
    ).toBe(false);
    expect(
      isBackgroundToViewerMessage({ type: "SYNC_SNAPSHOT", ...payload }),
    ).toBe(false);
  });

  it("accepts SYNC_SNAPSHOT_FAILED on the ports only, never from the page", () => {
    const failed = { type: "SYNC_SNAPSHOT_FAILED" };
    expect(isContentToBackgroundMessage(failed)).toBe(true);
    expect(isBackgroundToViewerMessage(failed)).toBe(true);
    expect(
      parseBridgeMessage({ source: BRIDGE_SOURCE, ...failed, payload: {} }),
    ).toBeNull();
  });
});

// === One item per message ===

describe("encoding an item for one message", () => {
  /** Under the default field budget each, over the item limit together. */
  const field = "x".repeat(7 * MiB);
  const baseState = makeQuery("q").state;

  function oversizedQuery(queryHash = '["big"]'): QueryEntry {
    return makeQuery(queryHash, {
      queryKey: ["big"],
      meta: { field },
      state: {
        ...baseState,
        data: field,
        error: field,
        fetchFailureReason: field,
        fetchMeta: { field },
      },
    });
  }

  it("encodes an entry that fits exactly as before", () => {
    const query = makeQuery("q", {
      state: { ...baseState, data: { rows: [1, 2, 3] } },
    });
    expect(encodeQueryEntryForMessage(query)).toEqual(encodeQueryEntry(query));
  });

  it("re-encodes an entry over the item limit with smaller field budgets", () => {
    const query = oversizedQuery();
    expect(encodeQueryEntry(query).utf8Bytes).toBeGreaterThan(MAX_ITEM_BYTES);

    const encoded = encodeQueryEntryForMessage(query);
    expect(encoded).not.toBeNull();
    if (!encoded) return;
    expect(encoded.truncated).toBe(true);
    expect(encoded.utf8Bytes).toBe(jsonUtf8Bytes(encoded.value));
    expect(encoded.utf8Bytes).toBeLessThanOrEqual(MAX_ITEM_BYTES);

    // Its structure is whole, and a field under the smaller budget is too
    const message = parseBridgeMessage(
      overPort({
        source: BRIDGE_SOURCE,
        type: "SYNC_SNAPSHOT",
        payload: {
          snapshotId: 1,
          chunkIndex: 0,
          chunkCount: 1,
          queries: [encoded.value],
          mutations: [],
        },
      }),
    );
    expect(message?.type).toBe("SYNC_SNAPSHOT");
    if (message?.type !== "SYNC_SNAPSHOT") return;
    const decoded = decodeBigInts(message.payload.queries[0]) as QueryEntry;
    expect(decoded.queryHash).toBe(query.queryHash);
    expect(decoded.queryKey).toEqual(["big"]);
    expect(decoded.state.data).toBe(TRUNCATED);
  });

  it("fits a mutation with every field over the item limit", () => {
    const mutation = makeMutation(1);
    const encoded = encodeMutationEntryForMessage({
      ...mutation,
      mutationKey: [field],
      state: {
        ...mutation.state,
        variables: field,
        context: field,
        data: field,
        error: field,
        failureReason: field,
      },
    });
    expect(encoded?.utf8Bytes).toBeLessThanOrEqual(MAX_ITEM_BYTES);
    expect(encoded?.truncated).toBe(true);
  });

  it("fits a change of an oversized query with the longest hash sent", () => {
    // The hash appears twice in a change, once in the entry
    const queryHash = "h".repeat(MAX_QUERY_HASH_BYTES - 2);
    const encoded = encodeChangeForMessage({
      entityType: "query",
      changeType: "updated",
      queryHash,
      entry: oversizedQuery(queryHash),
    });
    expect(encoded).not.toBeNull();
    expect(encoded?.utf8Bytes).toBeLessThanOrEqual(MAX_ITEM_BYTES);
    expect(FALLBACK_FIELD_BUDGET_BYTES).toBeGreaterThan(2 * MiB);
  });

  it("sends nothing of a query whose hash is over the limit", () => {
    // Escapes count: a quote takes two bytes of JSON
    const queryHash = '"'.repeat(MAX_QUERY_HASH_BYTES / 2);
    const entry = makeQuery(queryHash);
    expect(encodeQueryEntryForMessage(entry)).toBeNull();
    const changes: ChangeEvent[] = [
      { entityType: "query", changeType: "added", queryHash, entry },
      { entityType: "query", changeType: "removed", queryHash },
      {
        entityType: "query",
        changeType: "observers",
        queryHash,
        patch: {
          observerCount: 1,
          status: "fresh",
          isActive: true,
          isDisabled: false,
        },
      },
    ];
    for (const change of changes) {
      expect(encodeChangeForMessage(change)).toBeNull();
    }
  });

  it("does not take the first attempt at an item for repeats in the next", () => {
    // No repeats allowed at all: had the first attempt been kept, every
    // container it opened would be a repeat, cut in place, in the second.
    const pass = new EncodePass(0);
    const query = oversizedQuery();
    expect(encodeQueryEntry(query).utf8Bytes).toBeGreaterThan(MAX_ITEM_BYTES);

    const encoded = encodeQueryEntryForMessage(query, pass);
    expect(encoded?.utf8Bytes).toBeLessThanOrEqual(MAX_ITEM_BYTES);
    const decoded = decodeBigInts(overPort(encoded?.value)) as QueryEntry;
    // Only the strings over the smaller budget are cut, as without a pass
    expect(decoded.meta).toEqual({ field: TRUNCATED });
    expect(decoded.state.fetchMeta).toEqual({ field: TRUNCATED });
    expect(overPort(encoded?.value)).toEqual(
      overPort(encodeQueryEntryForMessage(query)?.value),
    );

    // The attempt that was sent is kept: a later item repeats its values
    const later = encodeQueryEntryForMessage(
      makeQuery("later", { meta: query.meta }),
      pass,
    );
    expect((decodeBigInts(overPort(later?.value)) as QueryEntry).meta).toBe(
      TRUNCATED,
    );
  });

  it("rolls back an item whose encoding throws", () => {
    const shared = { rows: [1, 2, 3] };
    const failing = { first: shared, again: shared };
    Object.defineProperty(failing, "boom", {
      enumerable: true,
      get() {
        throw new Error("boom");
      },
    });
    // Room for one repeat of `shared`, which the failing item spends before
    // it throws.
    const pass = new EncodePass(40);
    const withData = (queryHash: string, data: unknown) =>
      makeQuery(queryHash, { state: { ...baseState, data } });
    expect(() =>
      encodeQueryEntryForMessage(withData("failing", failing), pass),
    ).toThrow("boom");

    // Neither what it opened nor what it spent counts: `x` is a first
    // occurrence, and `y` still has the whole allowance.
    const encoded = encodeQueryEntryForMessage(
      withData("next", { x: shared, y: shared }),
      pass,
    );
    expect(
      (decodeBigInts(overPort(encoded?.value)) as QueryEntry).state.data,
    ).toEqual({ x: shared, y: shared });
  });
});

// === Resync rate limit ===

describe("createResyncScheduler", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("folds requests into one resync after the minimum delay", () => {
    const resync = vi.fn();
    const scheduler = createResyncScheduler(resync);
    scheduler.request();
    scheduler.request();
    vi.advanceTimersByTime(RESYNC_MIN_DELAY_MS - 1);
    scheduler.request();
    expect(resync).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(resync).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(10 * RESYNC_MAX_DELAY_MS);
    expect(resync).toHaveBeenCalledTimes(1);
  });

  it("doubles the delay while drops recur, up to the maximum", () => {
    const resync = vi.fn();
    const scheduler = createResyncScheduler(resync);
    const delays: number[] = [];
    let last = Date.now();
    for (let i = 0; i < 9; i++) {
      scheduler.request();
      while (resync.mock.calls.length === i) vi.advanceTimersByTime(100);
      delays.push(Date.now() - last);
      last = Date.now();
    }
    expect(delays).toEqual([
      1000, 2000, 4000, 8000, 16_000, 32_000, 60_000, 60_000, 60_000,
    ]);
  });

  it("starts over from the minimum after a quiet period", () => {
    const resync = vi.fn();
    const scheduler = createResyncScheduler(resync);
    for (let i = 0; i < 3; i++) {
      scheduler.request();
      vi.runOnlyPendingTimers();
    }
    vi.advanceTimersByTime(RESYNC_MAX_DELAY_MS);
    scheduler.request();
    vi.advanceTimersByTime(RESYNC_MIN_DELAY_MS);
    expect(resync).toHaveBeenCalledTimes(4);
  });

  it("drops a scheduled resync on cancel but keeps the backoff", () => {
    const resync = vi.fn();
    const scheduler = createResyncScheduler(resync);
    scheduler.request();
    vi.runOnlyPendingTimers();
    scheduler.request();
    scheduler.cancel();
    vi.advanceTimersByTime(RESYNC_MAX_DELAY_MS - 1);
    expect(resync).toHaveBeenCalledTimes(1);
    scheduler.request();
    vi.advanceTimersByTime(RESYNC_MIN_DELAY_MS);
    expect(resync).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(RESYNC_MIN_DELAY_MS);
    expect(resync).toHaveBeenCalledTimes(2);
  });
});
