import type { Browser } from "wxt/browser";
import type { PortMessage, SyncSnapshotPortMessage, ChangeEvent } from "@/types/messages";

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
  const snapshotCache = new Map<number, SyncSnapshotPortMessage>();

  // === Helpers ===
  function safePostMessage(port: Browser.runtime.Port, message: PortMessage): boolean {
    try {
      port.postMessage(message);
      return true;
    } catch {
      return false;
    }
  }

  function forwardToPanel(tabId: number, message: PortMessage) {
    const ports = panelPorts.get(tabId);
    if (!ports) return;
    for (const p of ports) {
      if (!safePostMessage(p, message)) {
        ports.delete(p);
      }
    }
    if (ports.size === 0) panelPorts.delete(tabId);
  }

  function cleanupContentPort(tabId: number) {
    contentPorts.delete(tabId);
    snapshotCache.delete(tabId);
    forwardToPanel(tabId, { type: "SYNC_DISCONNECTED" });
    updateIcon(tabId, "gray");
  }

  function applyChangesToCache(tabId: number, changes: readonly ChangeEvent[]) {
    const cached = snapshotCache.get(tabId);
    if (!cached) return;

    const queries = new Map(cached.queries.map((q) => [q.queryHash, q]));
    const mutations = new Map(cached.mutations.map((m) => [m.mutationId, m]));

    for (const change of changes) {
      if (change.entityType === "query") {
        if (change.changeType === "removed") {
          queries.delete(change.queryHash);
        } else if (change.entry) {
          queries.set(change.queryHash, change.entry);
        }
      } else {
        if (change.changeType === "removed") {
          mutations.delete(change.mutationId);
        } else if (change.entry) {
          mutations.set(change.mutationId, change.entry);
        }
      }
    }

    snapshotCache.set(tabId, {
      type: "SYNC_SNAPSHOT",
      queries: [...queries.values()],
      mutations: [...mutations.values()],
    });
  }

  function addPanelPort(tabId: number, port: Browser.runtime.Port) {
    let set = panelPorts.get(tabId);
    if (!set) {
      set = new Set();
      panelPorts.set(tabId, set);
    }
    set.add(port);

    // Send cached snapshot if available
    const cached = snapshotCache.get(tabId);
    if (cached) {
      if (!safePostMessage(port, cached)) {
        set.delete(port);
        if (set.size === 0) panelPorts.delete(tabId);
      }
    } else {
      // No cache (service worker restarted) — ask content to re-send snapshot
      const contentPort = contentPorts.get(tabId);
      if (contentPort) {
        safePostMessage(contentPort, { type: "RESYNC_REQUEST" });
      }
    }
  }

  function removePanelPort(port: Browser.runtime.Port) {
    for (const [tabId, set] of panelPorts) {
      set.delete(port);
      if (set.size === 0) {
        panelPorts.delete(tabId);
      }
    }
  }

  // === Service worker recovery: restore icon on tab switch ===
  browser.tabs.onActivated.addListener(({ tabId }) => {
    updateIcon(tabId, snapshotCache.has(tabId) ? "colored" : "gray");
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

      port.onMessage.addListener((message: unknown) => {
        const msg = message as PortMessage;

        if (msg.type === "SYNC_SNAPSHOT") {
          snapshotCache.set(tabId, msg);
          forwardToPanel(tabId, msg);
          updateIcon(tabId, "colored");
        } else if (msg.type === "SYNC_UPDATE") {
          applyChangesToCache(tabId, msg.changes);
          forwardToPanel(tabId, msg);
        } else if (msg.type === "SYNC_DISCONNECTED") {
          snapshotCache.delete(tabId);
          forwardToPanel(tabId, msg);
          updateIcon(tabId, "gray");
        }
      });

      port.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        cleanupContentPort(tabId);
      });
    } else if (port.name === "panel") {
      port.onMessage.addListener((message: unknown) => {
        const msg = message as PortMessage;
        if (msg.type === "PANEL_CONNECT") {
          panelPortTabMap.set(port, msg.tabId);
          addPanelPort(msg.tabId, port);
        } else if (msg.type === "ACTION_REQUEST" || msg.type === "SET_DATA_REQUEST" || msg.type === "DELETE_DATA_REQUEST" || msg.type === "REMOVE_ALL_QUERIES_REQUEST" || msg.type === "CLEAR_ARRAY_REQUEST" || msg.type === "CLEAR_MUTATION_CACHE_REQUEST") {
          const tabId = panelPortTabMap.get(port);
          if (tabId === undefined) return;
          const contentPort = contentPorts.get(tabId);
          if (!contentPort) return;
          safePostMessage(contentPort, msg);
        }
      });

      port.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        panelPortTabMap.delete(port);
        removePanelPort(port);
      });
    } else if (port.name === "popup") {
      port.onMessage.addListener((message: unknown) => {
        const msg = message as PortMessage;
        if (msg.type === "POPUP_CONNECT") {
          browser.tabs
            .query({ active: true, currentWindow: true })
            .then(([activeTab]) => {
              const tabId = activeTab?.id;
              if (tabId === undefined) {
                safePostMessage(port, { type: "SYNC_CLEAR" });
                return;
              }
              panelPortTabMap.set(port, tabId);
              addPanelPort(tabId, port);
            })
            .catch(() => {
              safePostMessage(port, { type: "SYNC_CLEAR" });
            });
        } else if (msg.type === "ACTION_REQUEST" || msg.type === "SET_DATA_REQUEST" || msg.type === "DELETE_DATA_REQUEST" || msg.type === "REMOVE_ALL_QUERIES_REQUEST" || msg.type === "CLEAR_ARRAY_REQUEST" || msg.type === "CLEAR_MUTATION_CACHE_REQUEST") {
          const tabId = panelPortTabMap.get(port);
          if (tabId === undefined) return;
          const contentPort = contentPorts.get(tabId);
          if (!contentPort) return;
          safePostMessage(contentPort, msg);
        }
      });

      port.onDisconnect.addListener(() => {
        void browser.runtime.lastError;
        panelPortTabMap.delete(port);
        removePanelPort(port);
      });
    }
  });

});
