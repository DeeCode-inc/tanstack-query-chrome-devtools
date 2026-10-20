import type { Browser } from "wxt/browser";
import type {
  BackgroundToContentMessage,
  BackgroundToViewerMessage,
  ForwardedRequest,
} from "@/types/messages";
import { isForwardedRequest } from "@/types/messages";
import type { MutationEntry, QueryEntry } from "@/types/ui";
import { applyChanges } from "@/utils/apply-changes";
import {
  isContentToBackgroundMessage,
  isViewerToBackgroundMessage,
} from "@/utils/guards";

/** Latest known entries of one tab, kept only while a viewer is connected. */
interface TabCache {
  readonly queries: Map<string, QueryEntry>;
  readonly mutations: Map<number, MutationEntry>;
}

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

  function updateIcon(tabId: number, variant: "colored" | "gray") {
    void browser.action.setIcon({
      tabId,
      path: variant === "colored" ? COLORED_ICONS : GRAY_ICONS,
    });
  }

  // === Ephemeral routing state (rebuilt on reconnection) ===
  const contentPorts = new Map<number, Browser.runtime.Port>();
  const panelPorts = new Map<number, Set<Browser.runtime.Port>>();
  const panelPortTabMap = new Map<Browser.runtime.Port, number>();
  const tabCaches = new Map<number, TabCache>();
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

  function postToContent(tabId: number, message: BackgroundToContentMessage) {
    const contentPort = contentPorts.get(tabId);
    if (contentPort) safePostMessage(contentPort, message);
  }

  /** The last viewer of a tab is gone: stop the page streaming and drop the cache. */
  function onViewersEmpty(tabId: number) {
    panelPorts.delete(tabId);
    tabCaches.delete(tabId);
    postToContent(tabId, { type: "STOP_SYNC" });
  }

  function forwardToPanel(tabId: number, message: BackgroundToViewerMessage) {
    const ports = panelPorts.get(tabId);
    if (!ports) return;
    for (const p of ports) {
      if (!safePostMessage(p, message)) {
        ports.delete(p);
      }
    }
    if (ports.size === 0) onViewersEmpty(tabId);
  }

  function cleanupContentPort(tabId: number) {
    contentPorts.delete(tabId);
    tabCaches.delete(tabId);
    clientTabs.delete(tabId);
    forwardToPanel(tabId, { type: "SYNC_DISCONNECTED" });
    updateIcon(tabId, "gray");
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

    // Later viewers start from the cache instead of a new page snapshot
    const cache = tabCaches.get(tabId);
    if (cache) {
      const snapshot: BackgroundToViewerMessage = {
        type: "SYNC_SNAPSHOT",
        queries: [...cache.queries.values()],
        mutations: [...cache.mutations.values()],
      };
      if (!safePostMessage(port, snapshot)) {
        set.delete(port);
        if (set.size === 0) onViewersEmpty(tabId);
      }
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
      if (!isViewerToBackgroundMessage(message)) return;
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
      // The page streams only while this tab has a viewer. Always sent, so a
      // reconnecting relay resyncs an open viewer and gets a first message.
      safePostMessage(port, {
        type: panelPorts.has(tabId) ? "START_SYNC" : "STOP_SYNC",
      });

      port.onMessage.addListener((message: unknown) => {
        // A newer relay of the same tab (e.g. after navigation) owns the tab
        if (contentPorts.get(tabId) !== port) return;
        if (!isContentToBackgroundMessage(message)) return;

        switch (message.type) {
          case "SYNC_SNAPSHOT":
            // A snapshot still in flight after the last viewer left is not cached
            if (panelPorts.has(tabId)) {
              tabCaches.set(tabId, {
                queries: new Map(message.queries.map((q) => [q.queryHash, q])),
                mutations: new Map(
                  message.mutations.map((m) => [m.mutationId, m]),
                ),
              });
            }
            clientTabs.add(tabId);
            updateIcon(tabId, "colored");
            forwardToPanel(tabId, message);
            return;
          case "SYNC_UPDATE": {
            const cache = tabCaches.get(tabId);
            if (cache)
              applyChanges(cache.queries, cache.mutations, message.changes);
            forwardToPanel(tabId, message);
            return;
          }
          case "CLIENT_READY":
            clientTabs.add(tabId);
            updateIcon(tabId, "colored");
            return;
          case "SYNC_DISCONNECTED":
            clientTabs.delete(tabId);
            tabCaches.delete(tabId);
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
