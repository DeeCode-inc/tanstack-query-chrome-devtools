// Injected script - runs in the webpage context for deeper TanStack Query integration
import type { Query } from '@tanstack/query-core';

console.log('TanStack Query DevTools: Injected script loaded');

// Message types for communication
interface TanStackQueryEvent {
  type: 'QEVENT';
  subtype: 'QUERY_CLIENT_DETECTED' | 'QUERY_CLIENT_NOT_FOUND' | 'QUERY_STATE_UPDATE' | 'QUERY_DATA_UPDATE';
  payload?: unknown;
}

// Action message types
interface QueryActionMessage {
  type: 'QUERY_ACTION';
  action: 'INVALIDATE' | 'REFETCH' | 'REMOVE' | 'RESET';
  queryKey: readonly unknown[];
}

// Action result message
interface QueryActionResult {
  type: 'QUERY_ACTION_RESULT';
  action: 'INVALIDATE' | 'REFETCH' | 'REMOVE' | 'RESET';
  queryKey: readonly unknown[];
  success: boolean;
  error?: string;
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
  // Only check for __TANSTACK_QUERY_CLIENT__
  if (window.__TANSTACK_QUERY_CLIENT__) {
    console.log('TanStack Query DevTools: __TANSTACK_QUERY_CLIENT__ found');
    return true;
  }

  return false;
}

// Get the active QueryClient
function getQueryClient() {
  return window.__TANSTACK_QUERY_CLIENT__ || null;
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

// Query action handlers
async function handleQueryAction(action: QueryActionMessage): Promise<QueryActionResult> {
  const queryClient = getQueryClient();

  if (!queryClient) {
    return {
      type: 'QUERY_ACTION_RESULT',
      action: action.action,
      queryKey: action.queryKey,
      success: false,
      error: 'QueryClient not found'
    };
  }

  try {
    switch (action.action) {
      case 'INVALIDATE':
        await queryClient.invalidateQueries({ queryKey: action.queryKey });
        console.log('TanStack Query DevTools: Query invalidated:', action.queryKey);
        break;

      case 'REFETCH':
        await queryClient.refetchQueries({ queryKey: action.queryKey });
        console.log('TanStack Query DevTools: Query refetched:', action.queryKey);
        break;

      case 'REMOVE':
        queryClient.removeQueries({ queryKey: action.queryKey });
        console.log('TanStack Query DevTools: Query removed:', action.queryKey);
        break;

      case 'RESET':
        queryClient.resetQueries({ queryKey: action.queryKey });
        console.log('TanStack Query DevTools: Query reset:', action.queryKey);
        break;

      default:
        throw new Error(`Unknown action: ${action.action}`);
    }

    return {
      type: 'QUERY_ACTION_RESULT',
      action: action.action,
      queryKey: action.queryKey,
      success: true
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('TanStack Query DevTools: Action failed:', error);

    return {
      type: 'QUERY_ACTION_RESULT',
      action: action.action,
      queryKey: action.queryKey,
      success: false,
      error: errorMessage
    };
  }
}

// Send action result to content script
function sendActionResult(result: QueryActionResult) {
  window.postMessage({
    source: 'tanstack-query-devtools-injected',
    ...result
  }, '*');
}

// Listen for action messages from content script
window.addEventListener('message', async (event) => {
  // Only accept messages from same origin and our content script
  if (event.origin !== window.location.origin) return;
  if (event.data?.source !== 'tanstack-query-devtools-content') return;

  console.log('Injected script received message:', event.data);

  if (event.data.type === 'QUERY_ACTION') {
    const result = await handleQueryAction(event.data);
    sendActionResult(result);

    // Trigger query data update after action
    setTimeout(sendQueryDataUpdate, 100);
  }

  // Handle immediate update requests from DevTools
  if (event.data.type === 'REQUEST_IMMEDIATE_UPDATE') {
    console.log('Injected script: Received immediate update request');
    if (detectTanStackQuery()) {
      console.log('Injected script: Sending immediate query data update');
      sendQueryDataUpdate();
    } else {
      console.log('Injected script: TanStack Query not available for immediate update');
    }
  }
});

// Check if we're in a valid context
if (typeof window !== 'undefined') {
  // Mark that our injected script is present
  window.__TANSTACK_QUERY_DEVTOOLS_INJECTED__ = true;

  console.log('TanStack Query DevTools: Injected script ready');

  // Perform initial detection
  performEnhancedDetection();

  // Also check periodically in case TanStack Query is loaded dynamically
  // Continue checking until TanStack Query is found (no artificial limit)
  let detectionFound = false;
  const interval = setInterval(() => {
    if (!detectionFound && detectTanStackQuery()) {
      detectionFound = true;
      console.log('TanStack Query DevTools: Periodic detection successful');
      performEnhancedDetection();
      clearInterval(interval);
    }
  }, 1000);

  // Stop checking after 2 minutes to avoid infinite polling
  setTimeout(() => {
    if (!detectionFound) {
      clearInterval(interval);
      console.log('TanStack Query DevTools: Stopped periodic detection after 2 minutes');
    }
  }, 120000);
}
