import { useState, useEffect } from 'react'
import './App.css'

function App() {
  const [tanStackQueryDetected, setTanStackQueryDetected] = useState<boolean | null>(null)
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting')

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
          <h3>Query Information</h3>
          <div style={{
            padding: '10px',
            borderRadius: '4px',
            backgroundColor: '#f8f9fa',
            border: '1px solid #dee2e6'
          }}>
            <p>🚧 Query inspection features coming soon...</p>
            <p>✨ This minimal working extension successfully:</p>
            <ul style={{ textAlign: 'left', marginLeft: '20px' }}>
              <li>Loads as a Chrome DevTools panel</li>
              <li>Detects TanStack Query on web pages</li>
              <li>Communicates between all extension contexts</li>
            </ul>
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
