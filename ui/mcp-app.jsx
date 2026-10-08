/**
 * MCP App shell (the HTML returned by `resources/read ui://mf/<remote>`).
 *
 * Reconstructed from the published 0.0.6 bundle (dist/static/js/mcp-app-shell.js),
 * whose TypeScript source is not part of the npm package. The component tree,
 * class names and behaviour are unchanged; the only functional change is the
 * MCP Apps client: it now uses `useApp` / `App` from
 * @modelcontextprotocol/ext-apps 2.x (instead of the 1.x copy that was
 * bundled before) and subscribes via `addEventListener` rather than the
 * deprecated `on*` setters.
 *
 * Everything else is imported from the compiled package modules in ../dist.
 * Build with `npm run build:ui` (see ui/build.mjs).
 */
import '../dist/utils/console-logger.js';
import '../dist/styles/mcp-app.css';
import React, { useCallback, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { useApp } from '@modelcontextprotocol/ext-apps/react';
import { AppList } from '../dist/components/app-list.js';
import { ErrorBoundary } from '../dist/components/error-boundary.js';
import { RemoteComponentContainer } from '../dist/components/remote-component-container.js';
import { MFProvider } from '../dist/context/MFProvider.js';
import { DebugPanel, DebugToolbarButton } from '../dist/debug/debug-panel.js';
import { injectGlobalStyles } from '../dist/styles/styles.js';

/** ChatGPT Apps SDK fallback when ontoolresult never arrives (ext-apps#522). */
function readOpenAiToolOutput() {
  try {
    const output = window.openai?.toolOutput;
    return output?.tool ? output : null;
  } catch {
    return null;
  }
}

function McpApp() {
  const [displayMode, setDisplayMode] = useState('inline');
  const [apps, setApps] = useState([]);
  const [currentTool, setCurrentTool] = useState(null);
  const [showMFComponent, setShowMFComponent] = useState(false);
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  const [, setLogs] = useState([]);
  const toolResultReceived = useRef(false);
  const appRef = useRef(null);

  const addLog = useCallback((message) => {
    const line = `[${new Date().toLocaleTimeString()}] ${message}`;
    console.log(line);
    setLogs((prev) => [...prev, line].slice(-20));
  }, []);

  const toggleDisplayMode = useCallback(async () => {
    if (!appRef.current) return;
    const mode = displayMode === 'fullscreen' ? 'inline' : 'fullscreen';
    try {
      const result = await appRef.current.requestDisplayMode({ mode });
      setDisplayMode(result.mode);
      addLog(`📺 Switched to ${result.mode} mode`);
    } catch (error) {
      console.error('requestDisplayMode failed:', error);
      addLog('❌ Failed to switch display mode');
    }
  }, [displayMode, addLog]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && displayMode === 'fullscreen') void toggleDisplayMode();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [displayMode, toggleDisplayMode]);

  /** Apply the JSON payload produced by the server's tool handler. */
  const applyToolResult = useCallback((data) => {
    if (Array.isArray(data)) return void setApps(data);
    if (data.apps) return void setApps(data.apps);
    if (data.tool && data.resource) {
      setCurrentTool({ tool: data.tool, args: data.args ?? {}, config: { resource: data.resource } });
    } else if (data.tool && data.config?.resource) {
      setCurrentTool(data);
    } else {
      return;
    }
    console.log('[mcp-app] ✅ tool result applied for', data.tool);
    setShowMFComponent(true);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (toolResultReceived.current) return;
      const output = readOpenAiToolOutput();
      if (output) {
        console.log('[mcp-app] ⚠️ ontoolresult not received — recovering from window.openai (ext-apps#522)');
        applyToolResult(output);
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [applyToolResult]);

  const { app, error, isConnected } = useApp({
    appInfo: { name: 'Module Federation', version: '1.0.0' },
    capabilities: {},
    onAppCreated: (created) => {
      appRef.current = created;
      toolResultReceived.current = false;
      created.addEventListener('hostcontextchanged', (ctx) => {
        if (ctx.displayMode) setDisplayMode(ctx.displayMode);
      });
      created.addEventListener('toolresult', (result) => {
        toolResultReceived.current = true;
        if (!result.content || !Array.isArray(result.content)) return;
        const text = result.content.find((c) => c.type === 'text')?.text;
        if (!text) return;
        let data;
        try {
          data = JSON.parse(text);
        } catch {
          return;
        }
        applyToolResult(data);
      });
      created.onteardown = async () => ({});
      created.onerror = (err) => {
        if (!(err?.message || String(err)).includes('unknown message ID')) console.error('[MF App] Error:', err);
      };
    },
  });

  if (error) {
    return (
      <div className="mf-error-container">
        <h1 className="mf-error-title">Connection Error</h1>
        <p className="mf-error-message">{error.message}</p>
      </div>
    );
  }
  if (!isConnected || !app) {
    return (
      <div className="mf-loading-container">
        <div>Connecting...</div>
      </div>
    );
  }
  const mf = currentTool?.config?.resource?.moduleFederation;
  return (
    <main className="mf-main">
      <div className="mf-toolbar">
        <button
          className="mf-tool-btn"
          onClick={toggleDisplayMode}
          title={displayMode === 'fullscreen' ? 'Exit fullscreen (ESC)' : 'Toggle fullscreen'}
          style={{ color: displayMode === 'fullscreen' ? '#8b5cf6' : 'rgba(0, 0, 0, 0.6)' }}
        >
          ⛶
        </button>
        <DebugToolbarButton showDebugPanel={showDebugPanel} onToggle={() => setShowDebugPanel(!showDebugPanel)} />
      </div>
      {showDebugPanel && (
        <DebugPanel
          isConnected={isConnected}
          app={app}
          showMFComponent={showMFComponent}
          currentTool={currentTool}
          onToggle={() => setShowDebugPanel(!showDebugPanel)}
        />
      )}
      <AppList apps={apps} displayMode={displayMode} />
      {showMFComponent && mf && (
        <RemoteComponentContainer config={mf} args={currentTool.args} mcpApp={app} onLog={addLog} />
      )}
    </main>
  );
}

injectGlobalStyles();
createRoot(document.body).render(
  <ErrorBoundary>
    <MFProvider>
      <McpApp />
    </MFProvider>
  </ErrorBoundary>,
);
