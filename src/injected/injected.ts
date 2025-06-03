// Injected script - runs in the webpage context for deeper TanStack Query integration
console.log('TanStack Query DevTools: Injected script loaded');

// Message types for communication
interface TanStackQueryEvent {
  type: 'QEVENT';
  subtype: 'QUERY_CLIENT_DETECTED' | 'QUERY_CLIENT_NOT_FOUND' | 'QUERY_STATE_UPDATE';
  payload?: unknown;
}

// Check for TanStack Query in the application's window context
function detectTanStackQuery(): boolean {
  // Check for global queryClient (as mentioned by user for Lit app)
  if (window.queryClient) {
    console.log('TanStack Query DevTools: queryClient found on application window');
    return true;
  }

  // Check for other common patterns
  if (window.__TANSTACK_QUERY_CLIENT__) {
    console.log('TanStack Query DevTools: __TANSTACK_QUERY_CLIENT__ found');
    return true;
  }

  return false;
}

// Send message to content script via postMessage
function sendToContentScript(event: TanStackQueryEvent) {
  window.postMessage({
    source: 'tanstack-query-devtools-injected',
    ...event
  }, '*');
}

// Initial detection
function performInitialDetection() {
  const detected = detectTanStackQuery();

  if (detected) {
    console.log('TanStack Query DevTools: Sending detection confirmation');
    sendToContentScript({
      type: 'QEVENT',
      subtype: 'QUERY_CLIENT_DETECTED'
    });
  } else {
    console.log('TanStack Query DevTools: No TanStack Query found initially');
    sendToContentScript({
      type: 'QEVENT',
      subtype: 'QUERY_CLIENT_NOT_FOUND'
    });
  }
}

// Check if we're in a valid context
if (typeof window !== 'undefined') {
  // Mark that our injected script is present
  window.__TANSTACK_QUERY_DEVTOOLS_INJECTED__ = true;

  console.log('TanStack Query DevTools: Injected script ready');

  // Perform initial detection
  performInitialDetection();

  // Also check periodically in case TanStack Query is loaded dynamically
  let checkCount = 0;
  const maxChecks = 10;
  const interval = setInterval(() => {
    checkCount++;

    if (detectTanStackQuery() || checkCount >= maxChecks) {
      clearInterval(interval);
      if (detectTanStackQuery()) {
        console.log('TanStack Query DevTools: Periodic detection successful');
        sendToContentScript({
          type: 'QEVENT',
          subtype: 'QUERY_CLIENT_DETECTED'
        });
      }
    }
  }, 1000);
}
