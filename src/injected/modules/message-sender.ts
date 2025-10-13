// Helper function to send messages from injected script to content script
export function sendToContentScript(
  message: Record<string, unknown> | object,
): void {
  try {
    window.postMessage(
      { ...message, source: "tanstack-query-devtools-injected" },
      window.location.origin,
    );
  } catch (error) {
    console.error("Error sending message to content script:", error);
  }
}
