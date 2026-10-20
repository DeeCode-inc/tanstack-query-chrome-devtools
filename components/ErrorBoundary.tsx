import { Component, type ErrorInfo, type ReactNode } from "react";

interface ErrorBoundaryProps {
  readonly children: ReactNode;
}

interface ErrorBoundaryState {
  readonly error: Error | null;
}

/** Thrown values are not always errors; the fallback needs a message. */
function toError(thrown: unknown): Error {
  if (thrown instanceof Error) return thrown;
  try {
    return new Error(String(thrown));
  } catch {
    // e.g. an object without a prototype, which has no string conversion
    return new Error("Unknown error");
  }
}

/**
 * Catches render errors below it and shows the error with a way to reload,
 * instead of leaving the panel or popup blank.
 */
export class ErrorBoundary extends Component<
  ErrorBoundaryProps,
  ErrorBoundaryState
> {
  override state: ErrorBoundaryState = { error: null };

  static getDerivedStateFromError(thrown: unknown): ErrorBoundaryState {
    return { error: toError(thrown) };
  }

  override componentDidCatch(thrown: unknown, info: ErrorInfo): void {
    console.error(
      "[tanstack-query-devtools] UI crashed:",
      thrown,
      info.componentStack,
    );
  }

  override render(): ReactNode {
    const { error } = this.state;
    if (error === null) return this.props.children;

    return (
      <div
        role="alert"
        className="h-full flex flex-col items-center justify-center gap-4 p-4 text-center"
      >
        <h1 className="text-xl font-semibold text-gray-900 dark:text-gray-100">
          Something went wrong.
        </h1>
        <pre className="w-full max-w-lg max-h-48 overflow-auto rounded-lg p-4 text-left text-xs whitespace-pre-wrap break-words border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300">
          {error.message}
        </pre>
        <button
          type="button"
          onClick={() => location.reload()}
          className="px-3 py-1.5 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded text-sm font-medium cursor-default hover:bg-gray-200 dark:hover:bg-gray-700 active:scale-95 transition-all duration-150"
        >
          Reload
        </button>
      </div>
    );
  }
}
