// Type-safe message router for handling different message types

// Handler interface for type-safe message handling
interface MessageHandler<T> {
  validate: (message: unknown) => message is T;
  handle: (message: T) => Promise<void> | void;
  batchable?: boolean; // Whether this handler supports batching
}

// Error handler interface for message handling errors
interface ErrorHandler {
  onValidationError?: (message: unknown, error: Error) => void;
  onHandlingError?: (message: unknown, error: Error) => void;
}

// Type-safe message router for handling different message types
class TypeSafeMessageRouter {
  private handlers = new Map<string, MessageHandler<unknown>>();
  private errorHandler?: ErrorHandler;

  constructor(errorHandler?: ErrorHandler) {
    this.errorHandler = errorHandler;
  }

  // Register a handler for a specific message type
  register<T>(key: string, handler: MessageHandler<T>): void {
    this.handlers.set(key, handler as MessageHandler<unknown>);
  }

  // Route a message to the appropriate handler
  async route(message: unknown): Promise<boolean> {
    try {
      // Try each handler to find the right one
      for (const handler of this.handlers.values()) {
        if (handler.validate(message)) {
          try {
            await handler.handle(message);
            return true;
          } catch (error) {
            this.errorHandler?.onHandlingError?.(
              message,
              error instanceof Error ? error : new Error(String(error)),
            );
            return false;
          }
        }
      }

      // No handler found for this message type
      return false;
    } catch (error) {
      this.errorHandler?.onValidationError?.(
        message,
        error instanceof Error ? error : new Error(String(error)),
      );
      return false;
    }
  }
}

// PostMessage router for window.postMessage events
class PostMessageRouter extends TypeSafeMessageRouter {
  private listener?: (event: MessageEvent) => void;
  private isActive = false;

  private options: {
    requireInjectedSource?: boolean;
    requireContentSource?: boolean;
    expectedOrigin?: string;
  };

  constructor(
    options: {
      requireInjectedSource?: boolean;
      requireContentSource?: boolean;
      expectedOrigin?: string;
    } = {},
    errorHandler?: ErrorHandler,
  ) {
    super(errorHandler);
    this.options = options;
  }

  // Start listening to postMessage events
  start(): void {
    if (this.isActive) return;

    this.listener = async (event: MessageEvent) => {
      // Origin validation
      const expectedOrigin =
        this.options.expectedOrigin || window.location.origin;
      if (event.origin !== expectedOrigin) {
        return;
      }

      // Source validation
      if (
        this.options.requireInjectedSource &&
        (event.data as { source?: string })?.source !==
          "tanstack-query-devtools-injected"
      ) {
        return;
      }

      if (
        this.options.requireContentSource &&
        (event.data as { source?: string })?.source !==
          "tanstack-query-devtools-content"
      ) {
        return;
      }

      await this.route(event.data);
    };

    window.addEventListener("message", this.listener);
    this.isActive = true;
  }

  // Stop listening to postMessage events
  stop(): void {
    if (!this.isActive || !this.listener) return;

    window.removeEventListener("message", this.listener);
    this.listener = undefined;
    this.isActive = false;
  }

  // Check if currently listening
  get active(): boolean {
    return this.isActive;
  }
}

// Utility functions for creating common routers
export function createPostMessageRouter(
  options: {
    requireInjectedSource?: boolean;
    requireContentSource?: boolean;
    expectedOrigin?: string;
  } = {},
): PostMessageRouter {
  return new PostMessageRouter(options, {
    onValidationError: (message, error) => {
      console.warn("PostMessage validation error:", error, "Message:", message);
    },
    onHandlingError: (message, error) => {
      console.error("PostMessage handling error:", error, "Message:", message);
    },
  });
}
