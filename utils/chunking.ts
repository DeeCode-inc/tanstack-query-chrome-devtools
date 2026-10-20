import type {
  SnapshotChunkFields,
  SyncSnapshotPortMessage,
} from "@/types/messages";
import type { MutationEntry, QueryEntry } from "@/types/ui";

/**
 * Sizing of the messages that carry page data, and the split of a snapshot
 * into chunks and back.
 *
 * Sizes are UTF-8 bytes of JSON, which is how a Chrome extension port
 * measures a message: Chrome throws on `postMessage` of anything over
 * 64 MiB. Lists are never capped by length, only messages by size.
 */

/**
 * Hard cap of one SYNC_SNAPSHOT or SYNC_UPDATE message. The page and the
 * background split their data to stay under it, and the relay refuses
 * anything over it (the backstop for messages from the page, which are
 * untrusted). Half of Chrome's limit: the background forwards what the relay
 * accepted with an envelope that differs by a few bytes, and every entry it
 * holds then fits in one message to a viewer.
 */
export const MAX_MESSAGE_BYTES = 32 * 1024 * 1024;

/**
 * Size the page and the background aim for when they split a snapshot or a
 * batch of changes. A message is held whole in several processes at once
 * (page, relay, background, every viewer) and parsed in one go, so smaller
 * messages keep those peaks and pauses down. An item over the target still
 * travels, in a message of its own.
 */
export const TARGET_MESSAGE_BYTES = 8 * 1024 * 1024;

/**
 * Room kept in every message for what surrounds its items: the message type,
 * the chunk fields and the bridge envelope, all under 200 bytes.
 */
const ENVELOPE_RESERVE_BYTES = 1024;

/** Largest single item (an entry or a change) a message can carry. */
export const MAX_ITEM_BYTES = MAX_MESSAGE_BYTES - ENVELOPE_RESERVE_BYTES;

/** Any UTF-16 code unit that UTF-8 encodes in more than one byte. */
const NON_ASCII = /[\u0080-\uffff]/;

/** UTF-8 size of `s`; a lone surrogate counts as U+FFFD, as browsers encode it. */
export function utf8ByteLength(s: string): number {
  if (!NON_ASCII.test(s)) return s.length;
  let bytes = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) {
      bytes += 1;
    } else if (c < 0x800) {
      bytes += 2;
    } else if (c >= 0xd800 && c <= 0xdbff) {
      const next = s.charCodeAt(i + 1);
      if (next >= 0xdc00 && next <= 0xdfff) {
        // A surrogate pair is one 4-byte code point.
        bytes += 4;
        i++;
      } else {
        bytes += 3;
      }
    } else {
      bytes += 3;
    }
  }
  return bytes;
}

/**
 * UTF-8 size of `JSON.stringify(value)`. Throws where `JSON.stringify` does:
 * on a cycle or a bigint.
 */
export function jsonUtf8Bytes(value: unknown): number {
  return utf8ByteLength(JSON.stringify(value));
}

/** An item with the UTF-8 size of its JSON, as `encodeForWire` returns it. */
export interface Sized<T> {
  readonly value: T;
  readonly utf8Bytes: number;
}

/**
 * Splits `items` in order into groups whose JSON (the items and the commas
 * between them) stays within `targetBytes`; an item over the target makes a
 * group of its own. No group is empty, and no items make no group.
 */
export function packBySize<T>(
  items: readonly Sized<T>[],
  targetBytes: number,
): T[][] {
  const groups: T[][] = [];
  let group: T[] = [];
  let groupBytes = 0;
  for (const { value, utf8Bytes } of items) {
    if (group.length > 0 && groupBytes + 1 + utf8Bytes > targetBytes) {
      groups.push(group);
      group = [];
      groupBytes = 0;
    }
    // The comma before every item but the first
    groupBytes += (group.length > 0 ? 1 : 0) + utf8Bytes;
    group.push(value);
  }
  if (group.length > 0) groups.push(group);
  return groups;
}

/** The entries one chunk of a snapshot carries. */
export interface SnapshotPart {
  readonly queries: readonly QueryEntry[];
  readonly mutations: readonly MutationEntry[];
}

type SnapshotItem =
  | { readonly query: QueryEntry }
  | { readonly mutation: MutationEntry };

/**
 * Splits a snapshot into parts of about `targetBytes` each, queries first.
 * There is always at least one part, so an empty cache still makes a
 * snapshot that replaces the receiver's state.
 */
export function splitSnapshot(
  queries: readonly Sized<QueryEntry>[],
  mutations: readonly Sized<MutationEntry>[],
  targetBytes: number = TARGET_MESSAGE_BYTES,
): SnapshotPart[] {
  const items: Sized<SnapshotItem>[] = [];
  for (const { value, utf8Bytes } of queries) {
    items.push({ value: { query: value }, utf8Bytes });
  }
  for (const { value, utf8Bytes } of mutations) {
    items.push({ value: { mutation: value }, utf8Bytes });
  }
  const parts = packBySize(items, targetBytes).map((group): SnapshotPart => {
    const partQueries: QueryEntry[] = [];
    const partMutations: MutationEntry[] = [];
    for (const item of group) {
      if ("query" in item) partQueries.push(item.query);
      else partMutations.push(item.mutation);
    }
    return { queries: partQueries, mutations: partMutations };
  });
  return parts.length > 0 ? parts : [{ queries: [], mutations: [] }];
}

/**
 * UTF-8 JSON sizes of the entries the background holds, measured once per
 * entry object: a change replaces an entry, it never modifies one.
 */
const entrySizes = new WeakMap<object, number>();

function measuredEntry<T extends object>(entry: T): Sized<T> {
  let utf8Bytes = entrySizes.get(entry);
  if (utf8Bytes === undefined) {
    utf8Bytes = jsonUtf8Bytes(entry);
    entrySizes.set(entry, utf8Bytes);
  }
  return { value: entry, utf8Bytes };
}

/**
 * The chunks of snapshot `snapshotId` of the given entries, as the background
 * sends its cache to a viewer that connects late. It measures the entries
 * itself rather than trusting sizes reported by the page.
 */
export function snapshotChunkMessages(
  queries: Iterable<QueryEntry>,
  mutations: Iterable<MutationEntry>,
  snapshotId: number,
): SyncSnapshotPortMessage[] {
  const parts = splitSnapshot(
    Array.from(queries, (entry) => measuredEntry(entry)),
    Array.from(mutations, (entry) => measuredEntry(entry)),
  );
  return parts.map((part, chunkIndex) => ({
    type: "SYNC_SNAPSHOT",
    snapshotId,
    chunkIndex,
    chunkCount: parts.length,
    ...part,
  }));
}

// === Reassembly ===

/** A snapshot chunk as the guards checked it. */
export interface SnapshotChunk extends SnapshotChunkFields, SnapshotPart {}

/** The chunks of one snapshot received so far, in order. */
export interface PartialSnapshot<C extends SnapshotChunk = SnapshotChunk> {
  readonly snapshotId: number;
  readonly chunkCount: number;
  readonly chunks: readonly C[];
}

/** What a received chunk did to the snapshot being reassembled. */
export type ChunkResult<C extends SnapshotChunk> =
  /** It started or continued a snapshot that is not complete yet. */
  | { readonly kind: "partial"; readonly partial: PartialSnapshot<C> }
  /** It completed a snapshot: every entry of it, in the order sent. */
  | {
      readonly kind: "complete";
      readonly queries: readonly QueryEntry[];
      readonly mutations: readonly MutationEntry[];
    }
  /**
   * It does not continue the unfinished snapshot, so a chunk of that one was
   * lost: the unfinished snapshot is abandoned.
   */
  | { readonly kind: "broken" }
  /**
   * It continues no unfinished snapshot: the rest of one that was abandoned
   * or superseded, which is ignored.
   */
  | { readonly kind: "stray" };

/**
 * Adds `chunk` to the unfinished snapshot `partial` (`null` for none). Chunk
 * 0 always starts a new snapshot, superseding an unfinished one; any other
 * chunk must be the next one of the same snapshot. The caller keeps the
 * returned partial snapshot and drops it on any other outcome.
 */
export function addChunk<C extends SnapshotChunk>(
  partial: PartialSnapshot<C> | null,
  chunk: C,
): ChunkResult<C> {
  let chunks: readonly C[];
  if (chunk.chunkIndex === 0) {
    chunks = [chunk];
  } else if (
    partial !== null &&
    chunk.snapshotId === partial.snapshotId &&
    chunk.chunkCount === partial.chunkCount &&
    chunk.chunkIndex === partial.chunks.length
  ) {
    chunks = [...partial.chunks, chunk];
  } else {
    return { kind: partial === null ? "stray" : "broken" };
  }
  if (chunks.length < chunk.chunkCount) {
    return {
      kind: "partial",
      partial: {
        snapshotId: chunk.snapshotId,
        chunkCount: chunk.chunkCount,
        chunks,
      },
    };
  }
  return {
    kind: "complete",
    queries: chunks.flatMap((c) => c.queries),
    mutations: chunks.flatMap((c) => c.mutations),
  };
}
