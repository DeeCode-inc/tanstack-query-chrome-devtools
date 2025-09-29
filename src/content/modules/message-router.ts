// Content script message router implementation

export interface ContentMessageHandler<T> {
  validate: (message: unknown) => message is T;
  handle: (message: T) => Promise<void> | void;
}

export class ContentScriptMessageRouter {
  private handlers = new Map<string, ContentMessageHandler<unknown>>();
  private _active = false;

  register<T>(key: string, handler: ContentMessageHandler<T>): void {
    this.handlers.set(key, handler as ContentMessageHandler<unknown>);
  }

  async route(event: MessageEvent): Promise<boolean> {
    // Origin and source validation
    if (event.origin !== window.location.origin) return false;
    if (event.data?.source !== "tanstack-query-devtools-injected") return false;

    // Try each handler to find the right one
    for (const [key, handler] of this.handlers.entries()) {
      if (handler.validate(event.data)) {
        try {
          await handler.handle(event.data);
          return true;
        } catch (error) {
          console.error(`Error in message handler for ${key}:`, error);
          return false;
        }
      }
    }

    return false;
  }

  start(): void {
    if (this._active) return;

    window.addEventListener("message", this.handleMessage.bind(this));
    this._active = true;
  }

  stop(): void {
    if (!this._active) return;

    window.removeEventListener("message", this.handleMessage.bind(this));
    this._active = false;
  }

  private handleMessage = async (event: MessageEvent): Promise<void> => {
    await this.route(event);
  };

  get isActive(): boolean {
    return this._active;
  }

  get active(): boolean {
    return this._active;
  }
}
