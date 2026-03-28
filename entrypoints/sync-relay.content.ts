import type { BridgeMessage, PortMessage } from "@/types/messages";
import { BRIDGE_SOURCE, BRIDGE_SOURCE_ACTION } from "@/types/messages";

const RECONNECT_BASE_MS = 1000;
const MAX_RECONNECT_RETRIES = 3;

function bridgeToPort(data: BridgeMessage): PortMessage | null {
  switch (data.type) {
    case "SYNC_SNAPSHOT": {
      const payload = data.payload as BridgeMessage<"SYNC_SNAPSHOT">["payload"];
      return {
        type: "SYNC_SNAPSHOT",
        queries: payload.queries,
        mutations: payload.mutations,
      };
    }
    case "SYNC_UPDATE": {
      const payload = data.payload as BridgeMessage<"SYNC_UPDATE">["payload"];
      return {
        type: "SYNC_UPDATE",
        changes: payload.changes,
      };
    }
    case "SYNC_DISCONNECTED":
      return { type: "SYNC_DISCONNECTED" };
    default:
      return null;
  }
}

export default defineContentScript({
  matches: ["<all_urls>"],
  main(ctx) {
    let port: ReturnType<typeof browser.runtime.connect> | null = null;
    let retries = 0;

    function connect() {
      port = browser.runtime.connect({ name: "sync-relay" });

      port.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        port = null;
        if (ctx.isInvalid) return;

        if (retries < MAX_RECONNECT_RETRIES) {
          const delay = RECONNECT_BASE_MS * Math.pow(2, retries);
          retries++;
          setTimeout(() => {
            if (!ctx.isInvalid) connect();
          }, delay);
        }
      });

      // Listen for reverse-direction ACTION_REQUEST, SET_DATA_REQUEST, DELETE_DATA_REQUEST, and REMOVE_ALL_QUERIES_REQUEST messages from background
      port.onMessage.addListener((message: unknown) => {
        const msg = message as PortMessage;
        if (msg.type === "ACTION_REQUEST") {
          window.postMessage(
            {
              source: BRIDGE_SOURCE_ACTION,
              type: "ACTION_REQUEST",
              payload: { action: msg.action, queryHash: msg.queryHash },
            },
            "*",
          );
        } else if (msg.type === "SET_DATA_REQUEST") {
          window.postMessage(
            {
              source: BRIDGE_SOURCE_ACTION,
              type: "SET_DATA_REQUEST",
              payload: { queryHash: msg.queryHash, path: msg.path, value: msg.value },
            },
            "*",
          );
        } else if (msg.type === "DELETE_DATA_REQUEST") {
          window.postMessage(
            {
              source: BRIDGE_SOURCE_ACTION,
              type: "DELETE_DATA_REQUEST",
              payload: { queryHash: msg.queryHash, path: msg.path },
            },
            "*",
          );
        } else if (msg.type === "REMOVE_ALL_QUERIES_REQUEST") {
          window.postMessage(
            {
              source: BRIDGE_SOURCE_ACTION,
              type: "REMOVE_ALL_QUERIES_REQUEST",
              payload: {},
            },
            "*",
          );
        } else if (msg.type === "CLEAR_ARRAY_REQUEST") {
          window.postMessage(
            {
              source: BRIDGE_SOURCE_ACTION,
              type: "CLEAR_ARRAY_REQUEST",
              payload: { queryHash: msg.queryHash, path: msg.path },
            },
            "*",
          );
        } else if (msg.type === "CLEAR_MUTATION_CACHE_REQUEST") {
          window.postMessage(
            {
              source: BRIDGE_SOURCE_ACTION,
              type: "CLEAR_MUTATION_CACHE_REQUEST",
              payload: {},
            },
            "*",
          );
        } else if (msg.type === "RESYNC_REQUEST") {
          window.postMessage(
            {
              source: BRIDGE_SOURCE_ACTION,
              type: "RESYNC_REQUEST",
              payload: {},
            },
            "*",
          );
        }
      });

      // Reset retry counter on successful connection
      retries = 0;
    }

    function onMessage(event: MessageEvent) {
      if (event.source !== window || (event.data as Record<string, unknown>)?.source !== BRIDGE_SOURCE) {
        return;
      }

      const data = event.data as BridgeMessage;
      const portMsg = bridgeToPort(data);
      if (portMsg && port) {
        port.postMessage(portMsg);
      }
    }

    connect();
    window.addEventListener("message", onMessage);

    ctx.onInvalidated(() => {
      window.removeEventListener("message", onMessage);
      if (port) {
        port.disconnect();
        port = null;
      }
    });
  },
});
