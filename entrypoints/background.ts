import type { Browser } from "wxt/browser";
import type {
  BackgroundToContentMessage,
  BackgroundToViewerMessage,
  ForwardedRequest,
  SyncSnapshotPortMessage,
} from "@/types/messages";
import { isForwardedRequest } from "@/types/messages";
import type { MutationEntry, QueryEntry } from "@/types/ui";
import { applyChanges } from "@/utils/apply-changes";
import {
  addChunk,
  type PartialSnapshot,
  snapshotChunkMessages,
} from "@/utils/chunking";
import {
  isContentToBackgroundMessage,
  isViewerToBackgroundMessage,
} from "@/utils/guards";

/** Latest known entries of one tab, kept only while a viewer is connected. */
interface TabCache {
  readonly queries: Map<string, QueryEntry>;
  readonly mutations: Map<number, MutationEntry>;
}

/** Outcome of posting to a viewer (see `postToViewer`). */
type ViewerPost = "sent" | "failed" | "gone";

export default defineBackground(() => {
  // === Icon path constants ===
  const GRAY_ICONS = {
    16: "icon/icon-16-gray.png",
    48: "icon/icon-48-gray.png",
    128: "icon/icon-128-gray.png",
  } as const;

  const COLORED_ICONS = {
    16: "icon/icon-16.png",
    48: "icon/icon-48.png",
    128: "icon/icon-128.png",
  } as const;

  /**
   * The toolbar button: `action` in MV3 (Chrome), `browserAction` in MV2
   * (Firefox), where `browser.action` is undefined. WXT's `browser` is the
   * native object and does not alias one to the other.
   */
  const toolbarAction = browser.action ?? browser.browserAction;

  /**
   * Cosmetic only, so it never throws: it runs in the middle of routing
   * messages, which a failure here (e.g. the tab closed meanwhile) must not
   * cut short.
   */
  function updateIcon(tabId: number, variant: "colored" | "gray") {
    try {
      toolbarAction
        .setIcon({
          tabId,
          path: variant === "colored" ? COLORED_ICONS : GRAY_ICONS,
        })
        .catch(() => {
          /* The tab is gone */
        });
    } catch (error: unknown) {
      console.warn("[background] could not set the toolbar icon:", error);
    }
  }

  // === Ephemeral routing state (rebuilt on reconnection) ===
  const contentPorts = new Map<number, Browser.runtime.Port>();
  const panelPorts = new Map<number, Set<Browser.runtime.Port>>();
  const panelPortTabMap = new Map<Browser.runtime.Port, number>();
  const tabCaches = new Map<number, TabCache>();
  /**
   * A page snapshot whose chunks are still arriving, kept only while a viewer
   * is connected. Its chunks are forwarded as they come and replayed to a
   * viewer that connects meanwhile; the cache is replaced only once the last
   * one is in, so it never holds a part of one snapshot over another.
   */
  const pendingSnapshots = new Map<
    number,
    PartialSnapshot<SyncSnapshotPortMessage>
  >();
  /**
   * Tabs whose latest snapshot could not be delivered. They have no cache,
   * and their viewers show the failure until the next snapshot.
   */
  const failedTabs = new Set<number>();
  /** Id of the last snapshot built from a cache for a viewer that came late. */
  let lastCacheSnapshotId = 0;
  /** Tabs whose page reported a QueryClient, independent of streaming. */
  const clientTabs = new Set<number>();

  // === Helpers ===
  function safePostMessage(
    port: Browser.runtime.Port,
    message: BackgroundToContentMessage | BackgroundToViewerMessage,
  ): boolean {
    try {
      port.postMessage(message);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Posts to a viewer. A message the port refuses (e.g. one over the
   * browser's size limit) is replaced by SYNC_SNAPSHOT_FAILED, so that the
   * viewer shows the failure instead of state that silently stopped
   * following the page: "failed". "gone" when the port refuses that too.
   */
  function postToViewer(
    port: Browser.runtime.Port,
    message: BackgroundToViewerMessage,
  ): ViewerPost {
    try {
      port.postMessage(message);
      return "sent";
    } catch (error: unknown) {
      console.warn(`[background] could not post ${message.type}:`, error);
    }
    return safePostMessage(port, { type: "SYNC_SNAPSHOT_FAILED" })
      ? "failed"
      : "gone";
  }

  function postToContent(tabId: number, message: BackgroundToContentMessage) {
    const contentPort = contentPorts.get(tabId);
    if (contentPort) safePostMessage(contentPort, message);
  }

  /** Forgets what the background knows of the page's caches for a tab. */
  function resetTabStream(tabId: number) {
    tabCaches.delete(tabId);
    pendingSnapshots.delete(tabId);
    failedTabs.delete(tabId);
  }

  /** The last viewer of a tab is gone: stop the page streaming and drop the cache. */
  function onViewersEmpty(tabId: number) {
    panelPorts.delete(tabId);
    resetTabStream(tabId);
    postToContent(tabId, { type: "STOP_SYNC" });
  }

  function forwardToPanel(tabId: number, message: BackgroundToViewerMessage) {
    const ports = panelPorts.get(tabId);
    if (!ports) return;
    for (const p of ports) {
      if (postToViewer(p, message) === "gone") {
        ports.delete(p);
      }
    }
    if (ports.size === 0) onViewersEmpty(tabId);
  }

  function cleanupContentPort(tabId: number) {
    contentPorts.delete(tabId);
    resetTabStream(tabId);
    clientTabs.delete(tabId);
    forwardToPanel(tabId, { type: "SYNC_DISCONNECTED" });
    updateIcon(tabId, "gray");
  }

  /**
   * The snapshot the tab's stream is on did not arrive whole. The cache and
   * the updates that follow would not match the page, so both are dropped
   * until the next snapshot, and the viewers are told.
   */
  function failSnapshot(tabId: number) {
    tabCaches.delete(tabId);
    pendingSnapshots.delete(tabId);
    failedTabs.add(tabId);
    forwardToPanel(tabId, { type: "SYNC_SNAPSHOT_FAILED" });
  }

  function onSnapshotChunk(tabId: number, chunk: SyncSnapshotPortMessage) {
    // A snapshot still in flight after the last viewer left is not cached
    if (!panelPorts.has(tabId)) return;
    const result = addChunk(pendingSnapshots.get(tabId) ?? null, chunk);
    switch (result.kind) {
      case "partial":
        pendingSnapshots.set(tabId, result.partial);
        forwardToPanel(tabId, chunk);
        return;
      case "complete":
        pendingSnapshots.delete(tabId);
        failedTabs.delete(tabId);
        tabCaches.set(tabId, {
          queries: new Map(result.queries.map((q) => [q.queryHash, q])),
          mutations: new Map(result.mutations.map((m) => [m.mutationId, m])),
        });
        forwardToPanel(tabId, chunk);
        return;
      case "broken":
        console.warn(
          `[background] snapshot of tab ${String(tabId)} is incomplete`,
        );
        failSnapshot(tabId);
        return;
      case "stray":
        // The rest of a snapshot that was superseded or already failed
        return;
    }
  }

  /**
   * Brings a viewer that connects while the tab streams to where the others
   * are: the chunks so far of a page snapshot in progress (the rest then
   * reaches it like the others), or else the cache as a snapshot of its own,
   * split like a page snapshot, or the failure of the last snapshot. Nothing
   * yet when the page has not answered START_SYNC. Returns false if the
   * viewer is gone.
   */
  function catchUpViewer(tabId: number, port: Browser.runtime.Port): boolean {
    const pending = pendingSnapshots.get(tabId);
    const cache = tabCaches.get(tabId);
    let messages: readonly BackgroundToViewerMessage[];
    if (pending) {
      messages = pending.chunks;
    } else if (cache) {
      lastCacheSnapshotId++;
      messages = snapshotChunkMessages(
        cache.queries.values(),
        cache.mutations.values(),
        lastCacheSnapshotId,
      );
    } else if (failedTabs.has(tabId)) {
      messages = [{ type: "SYNC_SNAPSHOT_FAILED" }];
    } else {
      return true;
    }
    for (const message of messages) {
      const outcome = postToViewer(port, message);
      // After a failure the viewer drops the snapshot, so the rest is moot
      if (outcome !== "sent") return outcome === "failed";
    }
    return true;
  }

  function addPanelPort(tabId: number, port: Browser.runtime.Port) {
    let set = panelPorts.get(tabId);
    if (!set) {
      set = new Set();
      panelPorts.set(tabId, set);
      // First viewer for this tab: the page answers with a fresh snapshot.
      postToContent(tabId, { type: "START_SYNC" });
    }
    set.add(port);

    // Later viewers start from the background's state instead of a new page
    // snapshot
    if (!catchUpViewer(tabId, port)) {
      set.delete(port);
      if (set.size === 0) onViewersEmpty(tabId);
    }
  }

  function removePanelPort(port: Browser.runtime.Port) {
    for (const [tabId, set] of panelPorts) {
      if (set.delete(port) && set.size === 0) {
        onViewersEmpty(tabId);
      }
    }
  }

  /** Relays a viewer request to the content script of the viewer's tab. */
  function forwardToContent(port: Browser.runtime.Port, msg: ForwardedRequest) {
    const tabId = panelPortTabMap.get(port);
    if (tabId === undefined) return;
    postToContent(tabId, msg);
  }

  /**
   * Shared handling for panel and popup ports. Each variant accepts only its
   * own connect message; forwarded requests are routed the same way for both.
   */
  function attachViewerPort(
    port: Browser.runtime.Port,
    variant: "panel" | "popup",
  ) {
    port.onMessage.addListener((message: unknown) => {
      if (!isViewerToBackgroundMessage(message)) {
        console.warn(`[background] ignored a malformed ${variant} message`);
        return;
      }
      if (isForwardedRequest(message)) {
        forwardToContent(port, message);
        return;
      }
      switch (message.type) {
        case "PANEL_CONNECT":
          if (variant !== "panel") return;
          // Acknowledge before any cached snapshot; a viewer that is already
          // gone is not registered
          if (!safePostMessage(port, { type: "CONNECT_ACK" })) return;
          panelPortTabMap.set(port, message.tabId);
          addPanelPort(message.tabId, port);
          return;
        case "POPUP_CONNECT":
          if (variant !== "popup") return;
          browser.tabs
            .query({ active: true, currentWindow: true })
            .then(([activeTab]) => {
              const tabId = activeTab?.id;
              if (tabId === undefined) {
                safePostMessage(port, {
                  type: "SYNC_CLEAR",
                } satisfies BackgroundToViewerMessage);
                return;
              }
              // The popup may have closed while the tab query was pending
              if (!safePostMessage(port, { type: "CONNECT_ACK" })) return;
              panelPortTabMap.set(port, tabId);
              addPanelPort(tabId, port);
            })
            .catch(() => {
              safePostMessage(port, {
                type: "SYNC_CLEAR",
              } satisfies BackgroundToViewerMessage);
            });
          return;
      }
    });

    port.onDisconnect.addListener(() => {
      void browser.runtime.lastError;
      panelPortTabMap.delete(port);
      removePanelPort(port);
    });
  }

  // === Service worker recovery: restore icon on tab switch ===
  browser.tabs.onActivated.addListener(({ tabId }) => {
    updateIcon(tabId, clientTabs.has(tabId) ? "colored" : "gray");
  });

  // === Port connection handling ===
  browser.runtime.onConnect.addListener((port) => {
    if (port.name === "sync-relay") {
      const tabId = port.sender?.tab?.id;
      if (tabId === undefined) {
        console.warn("[background] sync-relay connected without valid tab ID");
        return;
      }

      contentPorts.set(tabId, port);
      // Chunks of a snapshot the previous relay of the tab was sending will
      // not be continued; the snapshot answering the START_SYNC below
      // supersedes it at the viewers.
      pendingSnapshots.delete(tabId);
      failedTabs.delete(tabId);
      // The page streams only while this tab has a viewer. Always sent, so a
      // reconnecting relay resyncs an open viewer and gets a first message.
      safePostMessage(port, {
        type: panelPorts.has(tabId) ? "START_SYNC" : "STOP_SYNC",
      });

      port.onMessage.addListener((message: unknown) => {
        // A newer relay of the same tab (e.g. after navigation) owns the tab
        if (contentPorts.get(tabId) !== port) return;
        if (!isContentToBackgroundMessage(message)) {
          console.warn(
            `[background] ignored a malformed message from tab ${String(tabId)}`,
          );
          return;
        }

        switch (message.type) {
          case "SYNC_SNAPSHOT":
            clientTabs.add(tabId);
            updateIcon(tabId, "colored");
            onSnapshotChunk(tabId, message);
            return;
          case "SYNC_UPDATE": {
            if (pendingSnapshots.has(tabId)) {
              // A snapshot's chunks are posted back to back, so an update in
              // between means the rest of the snapshot was lost
              console.warn(
                `[background] snapshot of tab ${String(tabId)} is incomplete`,
              );
              failSnapshot(tabId);
              return;
            }
            const cache = tabCaches.get(tabId);
            if (cache)
              applyChanges(cache.queries, cache.mutations, message.changes);
            forwardToPanel(tabId, message);
            return;
          }
          case "SYNC_SNAPSHOT_FAILED":
            if (panelPorts.has(tabId)) failSnapshot(tabId);
            return;
          case "CLIENT_READY":
            clientTabs.add(tabId);
            updateIcon(tabId, "colored");
            return;
          case "SYNC_DISCONNECTED":
            clientTabs.delete(tabId);
            resetTabStream(tabId);
            forwardToPanel(tabId, message);
            updateIcon(tabId, "gray");
            return;
        }
      });

      port.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        // A stale relay going away must not tear down its successor's state
        if (contentPorts.get(tabId) !== port) return;
        cleanupContentPort(tabId);
      });
    } else if (port.name === "panel") {
      attachViewerPort(port, "panel");
    } else if (port.name === "popup") {
      attachViewerPort(port, "popup");
    }
  });
});
