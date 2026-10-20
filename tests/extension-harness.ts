import type { QueryClient } from "@tanstack/query-core";
import { vi } from "vitest";
import type { Browser } from "wxt/browser";
import background from "@/entrypoints/background";
import pageScript from "@/entrypoints/sync.content";
import relayScript from "@/entrypoints/sync-relay.content";
import { utf8ByteLength } from "@/utils/chunking";
import {
  createViewerStream,
  initialSyncState,
  type SyncState,
  syncReducer,
} from "@/utils/viewer-sync";

/**
 * The extension's own code wired together in one process: the page script
 * and the relay on a fake window, the background and viewers on fake ports.
 * Everything is delivered asynchronously through timers, so tests run on
 * fake timers and `settle()` between steps.
 */

/** The tab every relay port belongs to. */
export const TAB_ID = 7;

/** Chrome refuses a port message whose JSON is over this many UTF-8 bytes. */
const CHROME_PORT_LIMIT_BYTES = 64 * 1024 * 1024;

/** Lets every message in flight arrive; less than the page's batch delay. */
export function settle(): Promise<void> {
  return vi.advanceTimersByTimeAsync(20).then(() => undefined);
}

type Listener<A extends unknown[]> = (...args: A) => void;

class FakeEvent<A extends unknown[]> {
  private readonly listeners: Listener<A>[] = [];

  addListener(listener: Listener<A>): void {
    this.listeners.push(listener);
  }

  emit(...args: A): void {
    for (const listener of [...this.listeners]) listener(...args);
  }
}

/** A message one end of a port posted, with its size on the wire. */
export interface SentMessage {
  readonly message: { readonly type: string } & Record<string, unknown>;
  readonly bytes: number;
}

/**
 * One end of an extension port. A message crosses as JSON, as in Chrome,
 * and posting throws on one over Chrome's size limit or on a disconnected
 * port.
 */
export class FakePort {
  peer: FakePort | null = null;
  connected = true;
  readonly onMessage = new FakeEvent<[unknown]>();
  readonly onDisconnect = new FakeEvent<[]>();
  /** Every message this end posted. */
  readonly sent: SentMessage[] = [];
  /** Makes posting a matching message throw, as a port refusing it does. */
  refuse: ((message: SentMessage["message"]) => boolean) | null = null;

  constructor(
    readonly name: string,
    readonly sender?: { readonly tab: { readonly id: number } },
  ) {}

  postMessage(value: unknown): void {
    if (!this.connected) {
      throw new Error("Attempting to use a disconnected port object");
    }
    const message = value as SentMessage["message"];
    const json = JSON.stringify(message);
    const bytes = utf8ByteLength(json);
    if (bytes > CHROME_PORT_LIMIT_BYTES || this.refuse?.(message)) {
      throw new Error("Message length exceeded maximum allowed length.");
    }
    this.sent.push({ message, bytes });
    const { peer } = this;
    setTimeout(() => {
      if (peer?.connected) peer.onMessage.emit(JSON.parse(json));
    }, 0);
  }

  disconnect(): void {
    if (!this.connected) return;
    this.connected = false;
    const { peer } = this;
    if (!peer) return;
    peer.connected = false;
    setTimeout(() => peer.onDisconnect.emit(), 0);
  }

  /** Messages of a type this end posted. */
  sentOf(type: string): SentMessage[] {
    return this.sent.filter(({ message }) => message.type === type);
  }

  asPort(): Browser.runtime.Port {
    return this as unknown as Browser.runtime.Port;
  }
}

/** The window the page script and the relay share; messages are cloned. */
export class FakeWindow extends EventTarget {
  __TANSTACK_QUERY_CLIENT__: QueryClient | undefined;
  /** Every message posted on the window, as listeners receive it. */
  readonly posted: unknown[] = [];

  postMessage(data: unknown): void {
    const clone: unknown = structuredClone(data);
    this.posted.push(clone);
    setTimeout(() => {
      this.dispatchEvent(
        Object.assign(new Event("message"), { data: clone, source: this }),
      );
    }, 0);
  }

  /** START_SYNC requests posted to the page, by the relay or forwarded. */
  startSyncRequests(): number {
    return this.posted.filter(
      (data) =>
        typeof data === "object" &&
        data !== null &&
        "request" in data &&
        typeof data.request === "object" &&
        data.request !== null &&
        "type" in data.request &&
        data.request.type === "START_SYNC",
    ).length;
  }
}

/** A panel as `useSyncConnection` runs it, without React. */
export class TestViewer {
  state: SyncState = initialSyncState;
  port: FakePort;

  constructor(
    private readonly extension: TestExtension,
    private readonly tabId: number = TAB_ID,
  ) {
    this.port = this.connect();
  }

  /** A new port with a stream of its own; the state carries over. */
  private connect(): FakePort {
    const port = this.extension.open("panel");
    const handle = createViewerStream((action) => {
      this.state = syncReducer(this.state, action);
    });
    port.onMessage.addListener(handle);
    port.postMessage({ type: "PANEL_CONNECT", tabId: this.tabId });
    return port;
  }

  /** As the hook retries after losing its port: the state stays on screen. */
  reconnect(): void {
    this.port.disconnect();
    this.port = this.connect();
  }

  /** The background's end of the port, which posts to this viewer. */
  get backgroundEnd(): FakePort {
    return this.port.peer!;
  }

  close(): void {
    this.port.disconnect();
  }
}

export class TestExtension {
  readonly window = new FakeWindow();
  /** The caller's end of every port opened, oldest first. */
  readonly ports: FakePort[] = [];
  private onConnect: ((port: Browser.runtime.Port) => void) | null = null;

  constructor() {
    vi.spyOn(browser.runtime.onConnect, "addListener").mockImplementation(
      (listener) => {
        this.onConnect = listener;
      },
    );
    vi.spyOn(browser.runtime, "connect").mockImplementation(((info?: {
      name?: string;
    }) =>
      this.open(info?.name ?? "").asPort()) as typeof browser.runtime.connect);
    vi.spyOn(browser.action, "setIcon").mockResolvedValue(undefined);
    background.main();
  }

  /** Opens a port to the background, as `runtime.connect` does. */
  open(name: string): FakePort {
    const caller = new FakePort(name);
    const callee = new FakePort(
      name,
      name === "sync-relay" ? { tab: { id: TAB_ID } } : undefined,
    );
    caller.peer = callee;
    callee.peer = caller;
    this.ports.push(caller);
    this.onConnect?.(callee.asPort());
    return caller;
  }

  /** Runs the page script on the window, with `client` as the page's global. */
  startPage(client: QueryClient): void {
    Object.defineProperty(globalThis, "window", {
      value: this.window,
      configurable: true,
      writable: true,
    });
    this.window.__TANSTACK_QUERY_CLIENT__ = client;
    pageScript.main(fakeContext());
  }

  /** Runs the relay on the window. */
  startRelay(): void {
    relayScript.main(fakeContext());
  }

  /** The relay's end of its port to the background. */
  relayPort(): FakePort {
    const port = this.ports.findLast(({ name }) => name === "sync-relay");
    if (!port) throw new Error("the relay has not connected");
    return port;
  }
}

type ContentScriptContext = NonNullable<Parameters<typeof relayScript.main>[0]>;

/** A content script context that is never invalidated. */
function fakeContext(): ContentScriptContext {
  return {
    isInvalid: false,
    onInvalidated: () => () => {},
  } as unknown as ContentScriptContext;
}

/** Undoes `startPage`. */
export function removeWindow(): void {
  Reflect.deleteProperty(globalThis, "window");
}
