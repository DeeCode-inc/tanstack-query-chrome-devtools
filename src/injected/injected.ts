// Injected script - runs in the webpage context for deeper TanStack Query integration
import type { Query } from '@tanstack/query-core';

console.log('TanStack Query DevTools: Injected script loaded');

// Message types for communication
interface TanStackQueryEvent {
  type: 'QEVENT';
  subtype: 'QUERY_CLIENT_DETECTED' | 'QUERY_CLIENT_NOT_FOUND' | 'QUERY_STATE_UPDATE' | 'QUERY_DATA_UPDATE';
  payload?: unknown;
}

// Query data interface
interface QueryData {
  queryKey: readonly unknown[];
  state: {
    data?: unknown;
    error?: unknown;
    status: 'idle' | 'pending' | 'success' | 'error';
    isFetching: boolean;
    isStale: boolean;
    dataUpdatedAt: number;
    errorUpdatedAt: number;
  };
  meta?: Record<string, unknown>;
  isActive: boolean;
  observersCount: number;
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

// Get the active QueryClient
function getQueryClient() {
  return window.queryClient || window.__TANSTACK_QUERY_CLIENT__ || null;
}

// Extract query data from QueryClient
function getQueryData(): QueryData[] {
  const queryClient = getQueryClient();
  if (!queryClient || !queryClient.getQueryCache) {
    return [];
  }

  try {
    const queryCache = queryClient.getQueryCache();
    const queries = queryCache.getAll();

    return queries.map((query: Query): QueryData => ({
      queryKey: query.queryKey,
      state: {
        data: query.state.data,
        error: query.state.error,
        status: query.state.status,
        isFetching: query.state.fetchStatus === 'fetching',
        isStale: query.isStale(),
        dataUpdatedAt: query.state.dataUpdatedAt,
        errorUpdatedAt: query.state.errorUpdatedAt
      },
      meta: query.meta || {},
      isActive: query.getObserversCount() > 0,
      observersCount: query.getObserversCount()
    }));
  } catch (error) {
    console.error('TanStack Query DevTools: Error collecting query data:', error);
    return [];
  }
}

// Send message to content script via postMessage
function sendToContentScript(event: TanStackQueryEvent) {
  window.postMessage({
    source: 'tanstack-query-devtools-injected',
    ...event
  }, '*');
}

// Send query data update
function sendQueryDataUpdate() {
  const queryData = getQueryData();
  sendToContentScript({
    type: 'QEVENT',
    subtype: 'QUERY_DATA_UPDATE',
    payload: queryData
  });
}

// Setup query cache subscription
function setupQuerySubscription() {
  const queryClient = getQueryClient();
  if (!queryClient || typeof queryClient.getQueryCache !== 'function') {
    return;
  }

  try {
    const queryCache = queryClient.getQueryCache();
    if (typeof queryCache.subscribe === 'function') {
      console.log('TanStack Query DevTools: Setting up query cache subscription');

      // Subscribe to cache changes
      queryCache.subscribe(() => {
        sendQueryDataUpdate();
      });

      // Send initial query data
      sendQueryDataUpdate();
    }
  } catch (error) {
    console.error('TanStack Query DevTools: Error setting up subscription:', error);
  }
}

// Enhanced detection that also sets up subscription
function performEnhancedDetection() {
  const detected = detectTanStackQuery();

  if (detected) {
    console.log('TanStack Query DevTools: Sending detection confirmation');
    sendToContentScript({
      type: 'QEVENT',
      subtype: 'QUERY_CLIENT_DETECTED'
    });

    // Set up subscription for real-time updates
    setupQuerySubscription();
  } else {
    console.log('TanStack Query DevTools: No TanStack Query found');
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
  performEnhancedDetection();

  // Also check periodically in case TanStack Query is loaded dynamically
  let checkCount = 0;
  const maxChecks = 10;
  const interval = setInterval(() => {
    checkCount++;

    if (detectTanStackQuery() || checkCount >= maxChecks) {
      clearInterval(interval);
      if (detectTanStackQuery()) {
        console.log('TanStack Query DevTools: Periodic detection successful');
        performEnhancedDetection();
      }
    }
  }, 1000);
}
