import { useState, useEffect } from 'react'
import './App.css'

// Query data interface matching injected script
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

// Helper function to get status icon and color
function getStatusDisplay(query: QueryData) {
  if (query.state.isFetching) {
    return { icon: '🔄', color: '#007bff', text: 'Fetching' };
  }

  switch (query.state.status) {
    case 'success':
      return { icon: '✅', color: '#28a745', text: 'Success' };
    case 'error':
      return { icon: '❌', color: '#dc3545', text: 'Error' };
    case 'pending':
      return { icon: '⏳', color: '#ffc107', text: 'Pending' };
    case 'idle':
      return { icon: '⏸️', color: '#6c757d', text: 'Idle' };
    default:
      return { icon: '❓', color: '#6c757d', text: 'Unknown' };
  }
}

// Helper function to format query key
function formatQueryKey(queryKey: readonly unknown[]): string {
  try {
    return JSON.stringify(queryKey).replace(/"/g, '');
  } catch {
    return String(queryKey);
  }
}

// Helper function to format relative time
function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;

  if (diff < 1000) return 'now';
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  return `${Math.floor(diff / 3600000)}h ago`;
}

// QueryItem component
function QueryItem({ query }: { query: QueryData }) {
  const status = getStatusDisplay(query);
  const lastUpdated = Math.max(query.state.dataUpdatedAt, query.state.errorUpdatedAt);

  return (
    <div style={{
      padding: '12px 16px',
      borderBottom: '1px solid #e9ecef',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
      fontSize: '14px'
    }}>
      {/* Status indicator */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        minWidth: '100px'
      }}>
        <span style={{ fontSize: '16px' }}>{status.icon}</span>
        <span style={{ color: status.color, fontWeight: '500' }}>
          {status.text}
        </span>
      </div>

      {/* Query key */}
      <div style={{
        flex: 1,
        fontFamily: 'monospace',
        backgroundColor: '#f8f9fa',
        padding: '4px 8px',
        borderRadius: '3px',
        fontSize: '13px'
      }}>
        {formatQueryKey(query.queryKey)}
      </div>

      {/* Active indicator */}
      {query.isActive && (
        <div style={{
          fontSize: '12px',
          backgroundColor: '#007bff',
          color: 'white',
          padding: '2px 6px',
          borderRadius: '10px'
        }}>
          Active ({query.observersCount})
        </div>
      )}

      {/* Stale indicator */}
      {query.state.isStale && (
        <div style={{
          fontSize: '12px',
          backgroundColor: '#ffc107',
          color: '#212529',
          padding: '2px 6px',
          borderRadius: '10px'
        }}>
          Stale
        </div>
      )}

      {/* Last updated */}
      <div style={{
        fontSize: '12px',
        color: '#6c757d',
        minWidth: '60px',
        textAlign: 'right'
      }}>
        {lastUpdated > 0 ? formatRelativeTime(lastUpdated) : '-'}
      </div>
    </div>
  );
}

function App() {
  const [tanStackQueryDetected, setTanStackQueryDetected] = useState<boolean | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')
  const [queries, setQueries] = useState<QueryData[]>([])
  const [searchTerm, setSearchTerm] = useState('')

  useEffect(() => {
    // Connect to background script
    const port = chrome.runtime.connect({ name: 'devtools' })

    setConnectionStatus('connected')

    port.onMessage.addListener((message) => {
      console.log('DevTools panel received message:', message)

      if (message.type === 'INITIAL_STATE') {
        setTanStackQueryDetected(message.hasTanStackQuery)
      } else if (message.type === 'QEVENT') {
        switch (message.subtype) {
          case 'QUERY_CLIENT_DETECTED':
            setTanStackQueryDetected(true)
            break
          case 'QUERY_CLIENT_NOT_FOUND':
            setTanStackQueryDetected(false)
            break
          case 'QUERY_STATE_UPDATE':
            // Handle query state updates here
            console.log('Query state update:', message.payload)
            break
          case 'QUERY_DATA_UPDATE':
            // Handle query data updates
            console.log('Query data update:', message.payload)
            if (Array.isArray(message.payload)) {
              setQueries(message.payload)
            }
            break
        }
      }
    })

    port.onDisconnect.addListener(() => {
      setConnectionStatus('disconnected')
    })

    // Cleanup
    return () => {
      port.disconnect()
    }
  }, [])

  return (
    <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <h1>🏠 TanStack Query DevTools</h1>

      <div style={{ marginBottom: '20px' }}>
        <h3>Connection Status</h3>
        <div style={{
          padding: '10px',
          borderRadius: '4px',
          backgroundColor: connectionStatus === 'connected' ? '#d4edda' : '#f8d7da',
          color: connectionStatus === 'connected' ? '#155724' : '#721c24',
          border: `1px solid ${connectionStatus === 'connected' ? '#c3e6cb' : '#f5c6cb'}`
        }}>
          {connectionStatus === 'connecting' && '🔄 Connecting...'}
          {connectionStatus === 'connected' && '✅ Connected to background script'}
          {connectionStatus === 'disconnected' && '❌ Disconnected'}
        </div>
      </div>

      <div style={{ marginBottom: '20px' }}>
        <h3>TanStack Query Detection</h3>
        <div style={{
          padding: '10px',
          borderRadius: '4px',
          backgroundColor: tanStackQueryDetected === true ? '#d4edda' :
                           tanStackQueryDetected === false ? '#fff3cd' : '#e2e3e5',
          color: tanStackQueryDetected === true ? '#155724' :
                 tanStackQueryDetected === false ? '#856404' : '#6c757d',
          border: `1px solid ${tanStackQueryDetected === true ? '#c3e6cb' :
                                tanStackQueryDetected === false ? '#ffeaa7' : '#d1ecf1'}`
        }}>
          {tanStackQueryDetected === null && '🔍 Checking for TanStack Query...'}
          {tanStackQueryDetected === true && '🎉 TanStack Query detected on this page!'}
          {tanStackQueryDetected === false && '⚠️ TanStack Query not found on this page'}
        </div>
      </div>

      {tanStackQueryDetected === true && (
        <div style={{ marginBottom: '20px' }}>
          <h3>Queries ({queries.length})</h3>

          {/* Search bar */}
          <div style={{ marginBottom: '15px' }}>
            <input
              type="text"
              placeholder="🔍 Search queries..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                border: '1px solid #ccc',
                borderRadius: '4px',
                fontSize: '14px'
              }}
            />
          </div>

          {/* Query list */}
          <div style={{
            border: '1px solid #dee2e6',
            borderRadius: '4px',
            backgroundColor: '#fff'
          }}>
            {queries.length === 0 ? (
              <div style={{
                padding: '20px',
                textAlign: 'center',
                color: '#6c757d'
              }}>
                No queries found. Make sure window.queryClient is set in your application.
              </div>
            ) : (
              queries
                .filter(query => {
                  if (!searchTerm) return true;
                  const queryKeyStr = JSON.stringify(query.queryKey).toLowerCase();
                  return queryKeyStr.includes(searchTerm.toLowerCase());
                })
                .map((query, index) => (
                  <QueryItem key={index} query={query} />
                ))
            )}
          </div>
        </div>
      )}

      <div style={{ fontSize: '12px', color: '#6c757d', marginTop: '40px' }}>
        <p>TanStack Query Chrome DevTools v0.1.0</p>
        <p>Extension context: DevTools Panel</p>
      </div>
    </div>
  )
}

export default App
