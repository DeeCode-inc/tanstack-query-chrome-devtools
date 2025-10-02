// Message communication with content script
import type {
  TanStackQueryEvent,
  UpdateMessage,
  QueryActionResult,
  BulkQueryActionResult,
} from "../../types/messages";

export class InjectedScriptMessageCommunicator {
  sendEvent(event: TanStackQueryEvent): void {
    try {
      const message = {
        ...event,
        source: "tanstack-query-devtools-injected",
      };

      // postMessage uses structured clone algorithm - no serialization needed
      window.postMessage(message, window.location.origin);
    } catch (error) {
      console.error("Error sending event to content script:", error);
    }
  }

  sendUpdate(payload: UpdateMessage["payload"]): void {
    try {
      const message = {
        type: "UPDATE_QUERY_STATE",
        payload,
        source: "tanstack-query-devtools-injected",
      };

      // postMessage uses structured clone algorithm - no serialization needed
      window.postMessage(message, window.location.origin);
    } catch (error) {
      console.error("Error sending update to content script:", error);
    }
  }

  sendActionResult(result: QueryActionResult | BulkQueryActionResult): void {
    try {
      const message = {
        ...result,
        source: "tanstack-query-devtools-injected",
      };

      // postMessage uses structured clone algorithm - no serialization needed
      window.postMessage(message, window.location.origin);
    } catch (error) {
      console.error("Error sending action result to content script:", error);
    }
  }
}
