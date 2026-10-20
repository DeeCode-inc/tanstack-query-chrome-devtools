import { hashKey, QueryClient } from "@tanstack/query-core";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  type MockInstance,
  vi,
} from "vitest";
import {
  BRIDGE_SOURCE,
  type SyncSnapshotPortMessage,
  type SyncUpdatePortMessage,
} from "@/types/messages";
import { MAX_MESSAGE_BYTES, TARGET_MESSAGE_BYTES } from "@/utils/chunking";
import { RESYNC_MAX_DELAY_MS, RESYNC_MIN_DELAY_MS } from "@/utils/resync";
import {
  FIELD_BUDGET_BYTES,
  REPEAT_ALLOWANCE_BYTES,
} from "@/utils/serialization";
import {
  createViewerStream,
  initialSyncState,
  syncReducer,
} from "@/utils/viewer-sync";
import { encodeQueryEntry } from "@/utils/wire-entities";
import {
  type FakePort,
  removeWindow,
  settle,
  TestExtension,
  TestViewer,
} from "./extension-harness";
import { makeQuery } from "./fixtures";

/** Bytes a chunk of several entries may take: the target plus its envelope. */
const CHUNK_LIMIT_BYTES = TARGET_MESSAGE_BYTES + 1024;

let warn: MockInstance<typeof console.warn>;

beforeEach(() => {
  vi.useFakeTimers();
  warn = vi.spyOn(console, "warn").mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  removeWindow();
});

function warnedAbout(text: string): boolean {
  return warn.mock.calls.some((args) => String(args[0]).includes(text));
}

/** A client whose queries are never garbage collected while time is faked. */
function createClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { gcTime: Number.POSITIVE_INFINITY } },
  });
}

/** The page, the relay and the background, with the page's client found. */
async function startExtension(client: QueryClient): Promise<TestExtension> {
  const extension = new TestExtension();
  extension.startPage(client);
  extension.startRelay();
  await settle();
  return extension;
}

async function openViewer(extension: TestExtension): Promise<TestViewer> {
  const viewer = new TestViewer(extension);
  await settle();
  return viewer;
}

function snapshotChunks(port: FakePort) {
  return port.sentOf("SYNC_SNAPSHOT");
}

/** START_SYNC requests the relay made on its own, to resync. */
function resyncs(extension: TestExtension): number {
  const fromBackground = extension.relayPort().peer!.sentOf("START_SYNC");
  return extension.window.startSyncRequests() - fromBackground.length;
}

describe("page to viewer", () => {
  it("delivers more than 10 000 queries per message, in chunks within the size cap", async () => {
    const client = createClient();
    const text = "x".repeat(150);
    for (let i = 0; i < 30_000; i++) {
      client.setQueryData(["item", i], { id: i, text });
    }
    const extension = await startExtension(client);
    const viewer = await openViewer(extension);

    expect(viewer.state.status).toEqual({ kind: "connected" });
    expect(viewer.state.queries.size).toBe(30_000);
    expect(
      viewer.state.queries.get(hashKey(["item", 29_999]))?.state.data,
    ).toEqual({ id: 29_999, text });

    // The page split the snapshot by size; the relay forwarded every chunk
    const chunks = snapshotChunks(extension.relayPort());
    expect(chunks.length).toBeGreaterThan(1);
    expect(
      chunks.some(
        ({ message }) => (message.queries as unknown[]).length > 10_000,
      ),
    ).toBe(true);
    for (const { bytes } of chunks) {
      expect(bytes).toBeLessThanOrEqual(CHUNK_LIMIT_BYTES);
    }
    expect(snapshotChunks(viewer.backgroundEnd)).toHaveLength(chunks.length);

    // A viewer that comes later gets the background's cache, split the same way
    const late = await openViewer(extension);
    expect(late.state).toEqual(viewer.state);
    const lateChunks = snapshotChunks(late.backgroundEnd);
    expect(lateChunks.length).toBeGreaterThan(1);
    for (const { bytes } of lateChunks) {
      expect(bytes).toBeLessThanOrEqual(CHUNK_LIMIT_BYTES);
    }
  });

  it("streams changes after the snapshot, split by size", async () => {
    const client = createClient();
    const extension = await startExtension(client);
    const viewer = await openViewer(extension);
    expect(viewer.state.queries.size).toBe(0);

    const big = "y".repeat(3 * 1024 * 1024);
    for (let i = 0; i < 5; i++) client.setQueryData(["big", i], big);
    await vi.advanceTimersByTimeAsync(150);

    expect(viewer.state.queries.size).toBe(5);
    const updates = extension.relayPort().sentOf("SYNC_UPDATE");
    expect(updates.length).toBeGreaterThan(1);
    for (const { bytes } of updates) {
      expect(bytes).toBeLessThanOrEqual(CHUNK_LIMIT_BYTES);
    }
  });

  it("bounds the snapshot and the updates of queries that reach one graph", async () => {
    // A store of doubly linked nodes, reachable along many paths: each query
    // on its own would write a full field budget of it, 30 × 8 MiB.
    const nodes: Record<string, unknown>[] = Array.from(
      { length: 5000 },
      (_, i) => ({ id: i, name: `node ${i}` }),
    );
    nodes.forEach((node, i) => {
      node.prev = nodes[i - 1] ?? null;
      node.next = nodes[i + 1] ?? null;
    });
    const store = { nodes };
    const client = createClient();
    for (let i = 0; i < 30; i++) {
      client.setQueryData(["item", i], { id: i, store });
    }
    const extension = await startExtension(client);
    const viewer = await openViewer(extension);
    expect(viewer.state.queries.size).toBe(30);

    // One pass for all of them: the store once, plus the repeat allowance
    // and one field past it
    const bound = 2 * FIELD_BUDGET_BYTES + REPEAT_ALLOWANCE_BYTES + 30 * 1024;
    const total = (sent: readonly { bytes: number }[]) =>
      sent.reduce((sum, { bytes }) => sum + bytes, 0);
    expect(total(snapshotChunks(extension.relayPort()))).toBeLessThanOrEqual(
      bound,
    );

    // A batch of changes to all of them is one pass too
    for (let i = 0; i < 30; i++) {
      client.setQueryData(["item", i], { id: i, store, version: 2 });
    }
    await vi.advanceTimersByTimeAsync(150);
    expect(
      total(extension.relayPort().sentOf("SYNC_UPDATE")),
    ).toBeLessThanOrEqual(bound);
    for (let i = 0; i < 30; i++) {
      expect(
        viewer.state.queries.get(hashKey(["item", i]))?.state.data,
      ).toMatchObject({ id: i, version: 2 });
    }
  });
});

describe("a lost update", () => {
  it("is repaired by a fresh snapshot, rate-limited with backoff", async () => {
    const client = createClient();
    client.setQueryData(["a"], 1);
    const extension = await startExtension(client);
    const viewer = await openViewer(extension);
    // Chrome would refuse an update over its limit the same way
    extension.relayPort().refuse = ({ type }) => type === "SYNC_UPDATE";

    client.setQueryData(["a"], 2);
    await vi.advanceTimersByTimeAsync(150);
    expect(viewer.state.queries.get(hashKey(["a"]))?.state.data).toBe(1);
    expect(resyncs(extension)).toBe(0);

    await vi.advanceTimersByTimeAsync(RESYNC_MIN_DELAY_MS);
    expect(resyncs(extension)).toBe(1);
    expect(viewer.state.status).toEqual({ kind: "connected" });
    expect(viewer.state.queries.get(hashKey(["a"]))?.state.data).toBe(2);

    // Losing another one soon after waits twice as long
    client.setQueryData(["a"], 3);
    await vi.advanceTimersByTimeAsync(150 + RESYNC_MIN_DELAY_MS);
    expect(resyncs(extension)).toBe(1);
    await vi.advanceTimersByTimeAsync(RESYNC_MIN_DELAY_MS);
    expect(resyncs(extension)).toBe(2);
    expect(viewer.state.queries.get(hashKey(["a"]))?.state.data).toBe(3);
    expect(warnedAbout("could not forward SYNC_UPDATE")).toBe(true);
  });

  it("is not resynced when it was forged junk", async () => {
    const extension = await startExtension(createClient());
    await openViewer(extension);
    extension.window.postMessage({
      source: BRIDGE_SOURCE,
      type: "SYNC_UPDATE",
      payload: { changes: [{ entityType: "query", changeType: "nope" }] },
    });
    await vi.advanceTimersByTimeAsync(2 * RESYNC_MAX_DELAY_MS);
    expect(resyncs(extension)).toBe(0);
    expect(warnedAbout("dropped a malformed message from the page")).toBe(true);
  });
});

describe("a lost snapshot", () => {
  it("shows the viewers a failure and is never resynced", async () => {
    const client = createClient();
    client.setQueryData(["a"], 1);
    const extension = await startExtension(client);
    const relay = extension.relayPort();
    relay.refuse = ({ type }) => type === "SYNC_SNAPSHOT";

    const viewer = await openViewer(extension);
    expect(viewer.state.status).toEqual({ kind: "failed" });
    expect(relay.sentOf("SYNC_SNAPSHOT_FAILED")).toHaveLength(1);

    // Updates after it are ignored, and losing them does not resync either
    relay.refuse = ({ type }) => type !== "SYNC_SNAPSHOT_FAILED";
    client.setQueryData(["a"], 2);
    await vi.advanceTimersByTimeAsync(150 + 3 * RESYNC_MAX_DELAY_MS);
    relay.refuse = ({ type }) => type === "SYNC_SNAPSHOT";
    client.setQueryData(["a"], 3);
    await vi.advanceTimersByTimeAsync(150);
    expect(resyncs(extension)).toBe(0);
    expect(viewer.state.status).toEqual({ kind: "failed" });
    expect(viewer.state.queries.size).toBe(0);

    // A viewer that comes later is told too
    const late = await openViewer(extension);
    expect(late.state.status).toEqual({ kind: "failed" });

    // Reopening the viewers takes a new snapshot
    relay.refuse = null;
    viewer.close();
    late.close();
    await settle();
    const reopened = await openViewer(extension);
    expect(reopened.state.status).toEqual({ kind: "connected" });
    expect(reopened.state.queries.get(hashKey(["a"]))?.state.data).toBe(3);
  });

  it("is reported when a chunk is over the relay's cap", async () => {
    const client = createClient();
    client.setQueryData(["small"], 1);
    const extension = await startExtension(client);
    const viewer = await openViewer(extension);
    const relay = extension.relayPort();
    const before = snapshotChunks(relay).length;

    // A forged chunk can claim anything; the relay measures it itself
    extension.window.postMessage({
      source: BRIDGE_SOURCE,
      type: "SYNC_SNAPSHOT",
      payload: {
        snapshotId: 99,
        chunkIndex: 0,
        chunkCount: 1,
        queries: [
          encodeQueryEntry(
            makeQuery("q", {
              meta: { blob: "z".repeat(MAX_MESSAGE_BYTES) },
            }),
            Number.POSITIVE_INFINITY,
          ).value,
        ],
        mutations: [],
      },
    });
    await settle();
    expect(snapshotChunks(relay)).toHaveLength(before);
    expect(warnedAbout("over the")).toBe(true);
    expect(viewer.state.status).toEqual({ kind: "failed" });
    expect(resyncs(extension)).toBe(0);
  });
});

// === Background state machine, fed directly through a relay port ===

/** A chunk of `snapshotId` carrying queries with the given hashes. */
function chunk(
  snapshotId: number,
  chunkIndex: number,
  chunkCount: number,
  queryHashes: readonly string[],
  data?: unknown,
): SyncSnapshotPortMessage {
  return {
    type: "SYNC_SNAPSHOT",
    snapshotId,
    chunkIndex,
    chunkCount,
    queries: queryHashes.map(
      (queryHash) =>
        encodeQueryEntry(
          makeQuery(queryHash, {
            state: { ...makeQuery(queryHash).state, data },
          }),
        ).value,
    ),
    mutations: [],
  };
}

function removal(queryHash: string): SyncUpdatePortMessage {
  return {
    type: "SYNC_UPDATE",
    changes: [{ entityType: "query", changeType: "removed", queryHash }],
  };
}

function hashes(viewer: TestViewer): string[] {
  return [...viewer.state.queries.keys()];
}

async function backgroundWithViewer() {
  const extension = new TestExtension();
  const relay = extension.open("sync-relay");
  const viewer = await openViewer(extension);
  return { extension, relay, viewer };
}

describe("background", () => {
  it("replaces the state only once a snapshot is complete", async () => {
    const { relay, viewer } = await backgroundWithViewer();
    relay.postMessage(chunk(1, 0, 1, ["old"]));
    await settle();

    relay.postMessage(chunk(2, 0, 2, ["new1"]));
    await settle();
    // The old snapshot stays until the new one is whole
    expect(hashes(viewer)).toEqual(["old"]);
    expect(viewer.state.status).toEqual({ kind: "connected" });

    relay.postMessage(chunk(2, 1, 2, ["new2"]));
    await settle();
    expect(hashes(viewer)).toEqual(["new1", "new2"]);
  });

  it("ignores the rest of a superseded snapshot", async () => {
    const { extension, relay, viewer } = await backgroundWithViewer();
    relay.postMessage(chunk(1, 0, 3, ["a1"]));
    relay.postMessage(chunk(1, 1, 3, ["a2"]));
    // e.g. STOP_SYNC then START_SYNC: a new snapshot starts over
    relay.postMessage(chunk(2, 0, 2, ["b1"]));
    relay.postMessage(chunk(2, 1, 2, ["b2"]));
    relay.postMessage(chunk(1, 2, 3, ["a3"]));
    await settle();
    expect(hashes(viewer)).toEqual(["b1", "b2"]);
    expect(viewer.state.status).toEqual({ kind: "connected" });

    const late = await openViewer(extension);
    expect(hashes(late)).toEqual(["b1", "b2"]);
  });

  it("shows a loading state, not the setup screen, while the first snapshot arrives", async () => {
    const { relay, viewer } = await backgroundWithViewer();
    expect(viewer.state.status).toEqual({ kind: "disconnected" });
    relay.postMessage(chunk(1, 0, 3, ["a"]));
    await settle();
    expect(viewer.state.status).toEqual({
      kind: "loading",
      received: 1,
      total: 3,
    });
    expect(viewer.state.queries.size).toBe(0);
  });

  it("fails a snapshot that an update interrupts", async () => {
    const { extension, relay, viewer } = await backgroundWithViewer();
    relay.postMessage(chunk(1, 0, 1, ["old"]));
    relay.postMessage(chunk(2, 0, 2, ["new1"]));
    relay.postMessage(removal("old"));
    relay.postMessage(chunk(2, 1, 2, ["new2"]));
    await settle();
    expect(viewer.state.status).toEqual({ kind: "failed" });
    expect(viewer.state.queries.size).toBe(0);

    // Updates do not apply until the next snapshot
    relay.postMessage(removal("new1"));
    await settle();
    expect(viewer.state.status).toEqual({ kind: "failed" });
    const late = await openViewer(extension);
    expect(late.state.status).toEqual({ kind: "failed" });

    relay.postMessage(chunk(3, 0, 1, ["fresh"]));
    await settle();
    expect(hashes(viewer)).toEqual(["fresh"]);
    expect(hashes(late)).toEqual(["fresh"]);
  });

  it("brings a viewer that connects during a snapshot along with it", async () => {
    const { extension, relay, viewer } = await backgroundWithViewer();
    relay.postMessage(chunk(1, 0, 3, ["a"]));
    relay.postMessage(chunk(1, 1, 3, ["b"]));
    await settle();
    const late = await openViewer(extension);
    expect(late.state.status).toEqual({
      kind: "loading",
      received: 2,
      total: 3,
    });

    relay.postMessage(chunk(1, 2, 3, ["c"]));
    relay.postMessage(removal("b"));
    await settle();
    expect(hashes(viewer)).toEqual(["a", "c"]);
    expect(late.state).toEqual(viewer.state);
  });

  it("splits its cache for a late viewer and keeps updates in step", async () => {
    const { extension, relay, viewer } = await backgroundWithViewer();
    const data = "d".repeat(1024 * 1024);
    const queryHashes = Array.from({ length: 20 }, (_, i) => `q${i}`);
    relay.postMessage(chunk(1, 0, 3, queryHashes.slice(0, 7), data));
    relay.postMessage(chunk(1, 1, 3, queryHashes.slice(7, 14), data));
    relay.postMessage(chunk(1, 2, 3, queryHashes.slice(14), data));
    relay.postMessage(removal("q3"));
    await settle();
    expect(viewer.state.queries.size).toBe(19);

    const late = await openViewer(extension);
    expect(late.state).toEqual(viewer.state);
    const lateChunks = snapshotChunks(late.backgroundEnd);
    expect(lateChunks.length).toBeGreaterThan(2);
    for (const { bytes } of lateChunks) {
      expect(bytes).toBeLessThanOrEqual(CHUNK_LIMIT_BYTES);
    }
  });

  it("tells a viewer whose port refuses its snapshot, and keeps it", async () => {
    const { extension, relay } = await backgroundWithViewer();
    relay.postMessage(chunk(1, 0, 1, ["a"]));
    await settle();

    const late = new TestViewer(extension);
    // As Chrome refuses a message over 64 MiB
    late.backgroundEnd.refuse = ({ type }) => type === "SYNC_SNAPSHOT";
    await settle();
    expect(late.state.status).toEqual({ kind: "failed" });
    expect(warnedAbout("could not post SYNC_SNAPSHOT")).toBe(true);

    // Still registered: the next snapshot reaches it
    late.backgroundEnd.refuse = null;
    relay.postMessage(chunk(2, 0, 1, ["b"]));
    await settle();
    expect(hashes(late)).toEqual(["b"]);
  });

  it("applies updates on a new viewer port only after its snapshot", async () => {
    const { relay, viewer } = await backgroundWithViewer();
    relay.postMessage(chunk(1, 0, 1, ["a"]));
    await settle();

    // The only viewer goes away and comes back: the background drops its
    // cache and asks the page for a new snapshot
    viewer.reconnect();
    await settle();
    // An update still in flight from the old stream must not patch what the
    // viewer still shows
    relay.postMessage({
      type: "SYNC_UPDATE",
      changes: [
        {
          entityType: "query",
          changeType: "added",
          queryHash: "stale",
          entry: encodeQueryEntry(makeQuery("stale")).value,
        },
      ],
    });
    await settle();
    expect(hashes(viewer)).toEqual(["a"]);
    expect(viewer.state.status).toEqual({ kind: "connected" });

    relay.postMessage(chunk(2, 0, 1, ["b"]));
    relay.postMessage(removal("b"));
    await settle();
    expect(hashes(viewer)).toEqual([]);
  });
});

// === Viewer stream, fed directly ===

describe("viewer", () => {
  function viewerStream() {
    let state = initialSyncState;
    const handle = createViewerStream((action) => {
      state = syncReducer(state, action);
    });
    return { handle, state: () => state };
  }

  it("shows a failure, with nothing of the old state, when told the snapshot failed", () => {
    const viewer = viewerStream();
    viewer.handle(chunk(1, 0, 1, ["a"]));
    expect(viewer.state().status).toEqual({ kind: "connected" });
    viewer.handle({ type: "SYNC_SNAPSHOT_FAILED" });
    expect(viewer.state().status).toEqual({ kind: "failed" });
    expect(viewer.state().queries.size).toBe(0);
    // Updates wait for the next snapshot
    viewer.handle(removal("a"));
    viewer.handle(chunk(2, 0, 1, ["b"]));
    expect([...viewer.state().queries.keys()]).toEqual(["b"]);
  });

  it("fails on a malformed chunk and logs other malformed messages", () => {
    const viewer = viewerStream();
    viewer.handle({ type: "SYNC_UPDATE", changes: "nope" });
    viewer.handle({ type: "NOPE" });
    expect(viewer.state().status).toEqual({ kind: "disconnected" });
    expect(warnedAbout("ignored a malformed message")).toBe(true);

    viewer.handle({ ...chunk(1, 0, 2, ["a"]), chunkCount: 0 });
    expect(viewer.state().status).toEqual({ kind: "failed" });
    expect(warnedAbout("dropped a malformed SYNC_SNAPSHOT")).toBe(true);
  });
});
