// Content script message communication utilities
import { MessageSerializer } from "../../lib/serialization-manager";

export class ContentScriptMessageCommunicator {
  // Request immediate data update from injected script
  requestImmediateUpdate(preserveArtificialStates?: boolean): void {
    try {
      const message = MessageSerializer.prepareForPostMessage({
        type: "REQUEST_IMMEDIATE_UPDATE",
        source: "tanstack-query-devtools-content",
        ...(preserveArtificialStates !== undefined && {
          preserveArtificialStates,
        }),
      });

      window.postMessage(message, window.location.origin);
    } catch (error) {
      console.error("Error requesting immediate update:", error);
    }
  }

  // Request clear artificial states from injected script
  requestClearArtificialStates(): void {
    try {
      const message = MessageSerializer.prepareForPostMessage({
        type: "CLEAR_ARTIFICIAL_STATES",
        source: "tanstack-query-devtools-content",
      });

      window.postMessage(message, window.location.origin);
    } catch (error) {
      console.error("Error requesting clear artificial states:", error);
    }
  }
}
