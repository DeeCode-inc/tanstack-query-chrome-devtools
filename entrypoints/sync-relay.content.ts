import type {
  BridgeMessage,
  ContentToBackgroundMessage,
  PageRequest,
  PageRequestEnvelope,
} from "@/types/messages";
import { BRIDGE_SOURCE_ACTION } from "@/types/messages";
import {
  isBackgroundToContentMessage,
  MAX_PAYLOAD_CHARS,
  parseBridgeMessage,
} from "@/utils/guards";

const RECONNECT_BASE_MS = 1000;
const MAX_RECONNECT_RETRIES = 3;

/**
 * The relay is the only way page data enters the extension, so oversized
 * payloads are dropped here, before the background and the viewers each hold
 * a copy. A payload JSON cannot represent (a cycle or a bigint smuggled in by
 * a forged message) could not cross the port either and is dropped too.
 */
function fitsPayloadCap(type: string, payload: unknown): boolean {
  let size: number;
  try {
    size = JSON.stringify(payload).length;
  } catch {
    console.warn(`[tanstack-query-devtools] dropped ${type}: not serializable`);
    return false;
  }
  if (size > MAX_PAYLOAD_CHARS) {
    console.warn(
      `[tanstack-query-devtools] dropped ${type}: ${String(size)} characters exceeds the ${String(MAX_PAYLOAD_CHARS)} limit`,
    );
    return false;
  }
  return true;
}

function bridgeToPort(data: BridgeMessage): ContentToBackgroundMessage | null {
  switch (data.type) {
    case "SYNC_SNAPSHOT":
      return {
        type: "SYNC_SNAPSHOT",
        queries: data.payload.queries,
        mutations: data.payload.mutations,
      };
    case "SYNC_UPDATE":
      return {
        type: "SYNC_UPDATE",
        changes: data.payload.changes,
      };
    case "SYNC_DISCONNECTED":
      return { type: "SYNC_DISCONNECTED" };
    case "CLIENT_READY":
      return { type: "CLIENT_READY" };
    default:
      return null;
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main(ctx) {
    let port: ReturnType<typeof browser.runtime.connect> | null = null;
    let retries = 0;
    /** The page reported a QueryClient and has not reported losing it since. */
    let clientReady = false;

    function postToPage(request: PageRequest) {
      window.postMessage(
        { source: BRIDGE_SOURCE_ACTION, request } satisfies PageRequestEnvelope,
        "*",
      );
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
        if (isBackgroundToContentMessage(message)) postToPage(message);
      });

      // Announce on every (re)connect: a restarted background has lost which
      // tabs have a client
      if (clientReady) {
        current.postMessage({
          type: "CLIENT_READY",
        } satisfies ContentToBackgroundMessage);
      }
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== window) return;
      // Any script on the page can post here, so the message is validated
      // before anything is read from it
      const data = parseBridgeMessage(event.data);
      if (data === null) return;

      if (data.type === "CLIENT_READY") {
        clientReady = true;
        if (port === null) {
          // connect() announces the client itself
          if (!ctx.isInvalid) connect();
          return;
        }
      } else if (data.type === "SYNC_DISCONNECTED") {
        clientReady = false;
      } else if (!fitsPayloadCap(data.type, data.payload)) {
        // SYNC_SNAPSHOT or SYNC_UPDATE, the messages that carry page data
        return;
      }

      const portMsg = bridgeToPort(data);
      if (portMsg && port) {
        port.postMessage(portMsg);
      }
    }

    // Listen before asking, so the page's answer cannot arrive unheard. If the
    // page script starts after this one, its own startup CLIENT_READY reaches
    // this listener instead.
    window.addEventListener("message", onMessage);
    postToPage({ type: "CLIENT_STATUS_REQUEST" });

    ctx.onInvalidated(() => {
      // The page must not keep streaming into a dead extension context
      postToPage({ type: "STOP_SYNC" });
      window.removeEventListener("message", onMessage);
      if (port) {
        port.disconnect();
        port = null;
      }
    });
  },
});
