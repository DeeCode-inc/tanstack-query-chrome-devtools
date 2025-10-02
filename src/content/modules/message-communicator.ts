// Content script message communication utilities
export class ContentScriptMessageCommunicator {
  // Request immediate data update from injected script
  requestImmediateUpdate(preserveArtificialStates?: boolean): void {
    try {
      const message = {
        type: "REQUEST_IMMEDIATE_UPDATE",
        source: "tanstack-query-devtools-content",
        ...(preserveArtificialStates !== undefined && {
          preserveArtificialStates,
        }),
      };

      // postMessage uses structured clone algorithm - no serialization needed
      window.postMessage(message, window.location.origin);
    } catch (error) {
      console.error("Error requesting immediate update:", error);
    }
  }

  // Request clear artificial states from injected script
  requestClearArtificialStates(): void {
    try {
      const message = {
        type: "CLEAR_ARTIFICIAL_STATES",
        source: "tanstack-query-devtools-content",
      };

      // postMessage uses structured clone algorithm - no serialization needed
      window.postMessage(message, window.location.origin);
    } catch (error) {
      console.error("Error requesting clear artificial states:", error);
    }
  }
}
