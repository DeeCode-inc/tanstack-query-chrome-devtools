// Message communication with content script
import { MessageSerializer } from "../../lib/serialization-manager";
import type {
  TanStackQueryEvent,
  UpdateMessage,
  QueryActionResult,
  BulkQueryActionResult,
} from "../../types/messages";

export class InjectedScriptMessageCommunicator {
  sendEvent(event: TanStackQueryEvent): void {
    try {
      const message = MessageSerializer.prepareForPostMessage({
        ...event,
        source: "tanstack-query-devtools-injected",
      });

      window.postMessage(message, window.location.origin);
    } catch (error) {
      console.error("Error sending event to content script:", error);
    }
  }

  sendUpdate(payload: UpdateMessage["payload"]): void {
    try {
      const message = MessageSerializer.prepareForPostMessage({
        type: "UPDATE_QUERY_STATE",
        payload,
        source: "tanstack-query-devtools-injected",
      });

      window.postMessage(message, window.location.origin);
    } catch (error) {
      console.error("Error sending update to content script:", error);
    }
  }

  sendActionResult(result: QueryActionResult | BulkQueryActionResult): void {
    try {
      const message = MessageSerializer.prepareForPostMessage({
        ...result,
        source: "tanstack-query-devtools-injected",
      });

      window.postMessage(message, window.location.origin);
    } catch (error) {
      console.error("Error sending action result to content script:", error);
    }
  }
}
