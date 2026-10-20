import type {
  BridgeMessage,
  ContentToBackgroundMessage,
  PageRequest,
  PageRequestEnvelope,
  SyncSnapshotPortMessage,
  SyncUpdatePortMessage,
} from "@/types/messages";
import { BRIDGE_SOURCE_ACTION } from "@/types/messages";
import { MAX_MESSAGE_BYTES, utf8ByteLength } from "@/utils/chunking";
import {
  claimsBridgeSource,
  isBackgroundToContentMessage,
  parseBridgeMessage,
} from "@/utils/guards";
import { createResyncScheduler } from "@/utils/resync";

const RECONNECT_BASE_MS = 1000;
const MAX_RECONNECT_RETRIES = 3;

function warn(text: string, ...details: unknown[]): void {
  console.warn(`[tanstack-query-devtools] ${text}`, ...details);
}

/**
 * The relay is the only way page data enters the extension, so a message
 * over `MAX_MESSAGE_BYTES` is refused here, before the background and the
 * viewers each hold a copy, and so is one JSON cannot represent (a cycle or
 * a bigint smuggled in by a forged message), which Chrome's ports could not
 * carry and Firefox's would deliver as is.
 *
 * The page sizes its messages exactly and keeps them under the cap, but any
 * script on the page can post one, so the size the relay goes by is its own.
 * Measuring costs a `JSON.stringify` per message on the page's thread, on top
 * of the serialization Chrome's port does anyway; the page splits a snapshot
 * into chunks of `TARGET_MESSAGE_BYTES`, so for its own messages one call
 * measures at most one chunk. It is kept because nothing else here checks a
 * forged message's size or serializability, and because it guarantees that
 * every entry the background holds fits in one message to a viewer.
 */
function fitsMessageCap(message: ContentToBackgroundMessage): boolean {
  let json: string;
  try {
    json = JSON.stringify(message);
  } catch {
    warn(`dropped ${message.type}: not serializable`);
    return false;
  }
  // Each UTF-16 code unit takes one to three bytes, so only a message
  // between the two bounds needs counting.
  if (json.length * 3 <= MAX_MESSAGE_BYTES) return true;
  const bytes =
    json.length > MAX_MESSAGE_BYTES ? json.length : utf8ByteLength(json);
  if (bytes <= MAX_MESSAGE_BYTES) return true;
  warn(
    `dropped ${message.type}: at least ${String(bytes)} bytes, over the ${String(MAX_MESSAGE_BYTES)} limit`,
  );
  return false;
}

function bridgeToPort(data: BridgeMessage): ContentToBackgroundMessage {
  switch (data.type) {
    case "SYNC_SNAPSHOT":
      return { type: "SYNC_SNAPSHOT", ...data.payload };
    case "SYNC_UPDATE":
      return { type: "SYNC_UPDATE", changes: data.payload.changes };
    case "SYNC_DISCONNECTED":
      return { type: "SYNC_DISCONNECTED" };
    case "CLIENT_READY":
      return { type: "CLIENT_READY" };
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main(ctx) {
    let port: ReturnType<typeof browser.runtime.connect> | null = null;
    let retries = 0;
    /** The page reported a QueryClient and has not reported losing it since. */
    let clientReady = false;
    /** The last stream control the page got was START_SYNC. */
    let streaming = false;
    /**
     * Snapshot of which a chunk could not be forwarded; its later chunks are
     * dropped without measuring them.
     */
    let failedSnapshotId: number | null = null;
    /**
     * The snapshot the stream is on could not be delivered. Updates follow
     * the snapshot they were made on, so losing one then cannot be repaired
     * by a resync, which would only rebuild the snapshot that failed.
     */
    let snapshotFailed = false;

    function postToPage(request: PageRequest) {
      window.postMessage(
        { source: BRIDGE_SOURCE_ACTION, request } satisfies PageRequestEnvelope,
        "*",
      );
    }

    /**
     * Recovery from a lost update: the background and the viewers miss its
     * changes (a removal leaves a ghost entry), so the page is asked for a
     * fresh snapshot that replaces their state. Rate-limited, since every
     * snapshot takes the page's thread.
     */
    const resync = createResyncScheduler(() => {
      if (!streaming || port === null || ctx.isInvalid) return;
      warn("resyncing after a lost update");
      postToPage({ type: "START_SYNC" });
    });

    /**
     * Posts to the background. A port throws on a message it cannot carry,
     * or once disconnected (its onDisconnect then follows).
     */
    function postToBackground(message: ContentToBackgroundMessage): boolean {
      if (port === null) return false;
      try {
        port.postMessage(message);
        return true;
      } catch (error: unknown) {
        warn(`could not forward ${message.type}:`, error);
        return false;
      }
    }

    function forwardSnapshotChunk(message: SyncSnapshotPortMessage): void {
      if (message.snapshotId === failedSnapshotId) return;
      if (fitsMessageCap(message) && postToBackground(message)) {
        if (message.chunkIndex === 0) snapshotFailed = false;
        return;
      }
      failedSnapshotId = message.snapshotId;
      snapshotFailed = true;
      // Not resynced: the page would build and post the same snapshot again
      postToBackground({ type: "SYNC_SNAPSHOT_FAILED" });
    }

    function forwardUpdate(message: SyncUpdatePortMessage): void {
      if (fitsMessageCap(message) && postToBackground(message)) return;
      if (!snapshotFailed) resync.request();
    }

    /**
     * Opened only once the page has a client, so pages without TanStack Query
     * never hold a port to (or wake) the background.
     */
    function connect() {
      const current = browser.runtime.connect({ name: "sync-relay" });
      port = current;

      current.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        port = null;
        // Nothing receives the page's changes now. A reconnect is answered
        // with START_SYNC or STOP_SYNC, so the page never streams into a
        // relay that has given up or whose extension context is gone.
        streaming = false;
        resync.cancel();
        postToPage({ type: "STOP_SYNC" });
        if (ctx.isInvalid) return;

        if (retries < MAX_RECONNECT_RETRIES) {
          const delay = RECONNECT_BASE_MS * 2 ** retries;
          retries++;
          setTimeout(() => {
            // A CLIENT_READY may have reconnected in the meantime
            if (!ctx.isInvalid && port === null) connect();
          }, delay);
        }
      });

      // Hand viewer requests and stream control from the background to the
      // page unchanged
      current.onMessage.addListener((message: unknown) => {
        retries = 0;
        if (!isBackgroundToContentMessage(message)) {
          warn("ignored a malformed message from the background");
          return;
        }
        if (message.type === "START_SYNC" || message.type === "STOP_SYNC") {
          streaming = message.type === "START_SYNC";
          // A fresh snapshot is coming anyway, or nobody is watching
          resync.cancel();
        }
        postToPage(message);
      });

      // Announce on every (re)connect: a restarted background has lost which
      // tabs have a client
      if (clientReady) postToBackground({ type: "CLIENT_READY" });
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      // Any script on the page can post here, so the message is validated
      // before anything is read from it. A message that fails is dropped
      // without a resync, which forged junk could otherwise trigger at will.
      const data = parseBridgeMessage(event.data);
      if (data === null) {
        if (claimsBridgeSource(event.data)) {
          warn("dropped a malformed message from the page");
        }
        return;
      }

      if (data.type === "CLIENT_READY") {
        clientReady = true;
        if (port === null) {
          // connect() announces the client itself
          if (!ctx.isInvalid) connect();
          return;
        }
      } else if (data.type === "SYNC_DISCONNECTED") {
        clientReady = false;
      }
      // Nothing to forward to: a reconnect starts over with a fresh snapshot
      if (port === null) return;

      const message = bridgeToPort(data);
      switch (message.type) {
        case "SYNC_SNAPSHOT":
          forwardSnapshotChunk(message);
          return;
        case "SYNC_UPDATE":
          forwardUpdate(message);
          return;
        default:
          postToBackground(message);
      }
    }

    // Listen before asking, so the page's answer cannot arrive unheard. If the
    // page script starts after this one, its own startup CLIENT_READY reaches
    // this listener instead.
    window.addEventListener("message", onMessage);
    postToPage({ type: "CLIENT_STATUS_REQUEST" });

    ctx.onInvalidated(() => {
      // The page must not keep streaming into a dead extension context
      resync.cancel();
      postToPage({ type: "STOP_SYNC" });
      window.removeEventListener("message", onMessage);
      if (port) {
        port.disconnect();
        port = null;
      }
    });
  },
});
