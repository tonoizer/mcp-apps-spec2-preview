import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Client, StreamableHTTPClientTransport } from '@modelcontextprotocol/client';
import { McpAppRenderer } from '@module-federation/mcp-apps/react';

const MCP_URL = new URL('/mcp', window.location.href);
const UI_EXTENSION = 'io.modelcontextprotocol/ui';
const MCP_APP_MIME = 'text/html;profile=mcp-app';

function App() {
  const clientRef = useRef(null);
  const [status, setStatus] = useState('connecting…');
  const [server, setServer] = useState(null);
  const [tools, setTools] = useState([]);
  const [name, setName] = useState('Demo');
  const [call, setCall] = useState(null); // { id, result, html, resourceUri, mimeType }
  const [messages, setMessages] = useState([]);
  const [error, setError] = useState(null);

  const callTool = async (tool, args) => {
    setError(null);
    try {
      const client = clientRef.current;
      const result = await client.callTool({ name: tool.name, arguments: args });
      const resourceUri = tool._meta?.ui?.resourceUri;
      const read = await client.readResource({ uri: resourceUri });
      const content = read.contents[0];
      if (content.mimeType !== MCP_APP_MIME) throw new Error(`Unexpected UI mimeType ${content.mimeType}`);
      setCall({ id: `call-${Date.now()}`, tool: tool.name, args, result, html: content.text, resourceUri, mimeType: content.mimeType });
    } catch (e) {
      setError(String(e?.message ?? e));
    }
  };

  useEffect(() => {
    let closed = false;
    (async () => {
      try {
        // 'auto' probes server/discover and speaks MCP 2026-07-28 when offered;
        // open the page with ?era=legacy to force the 2025-11-25 initialize handshake.
        const era = new URLSearchParams(location.search).get('era') === 'legacy' ? 'legacy' : 'auto';
        const client = new Client(
          { name: 'mcp-apps-demo-host', version: '1.0.0' },
          { capabilities: { extensions: { [UI_EXTENSION]: { mimeTypes: [MCP_APP_MIME] } } }, versionNegotiation: { mode: era } },
        );
        await client.connect(new StreamableHTTPClientTransport(MCP_URL));
        if (closed) return;
        clientRef.current = client;
        setServer({ ...client.getServerVersion(), protocol: client.getNegotiatedProtocolVersion() });
        setStatus('connected');
        const { tools } = await client.listTools();
        setTools(tools);
        if (tools[0]) await callTool(tools[0], { name: 'Demo' });
      } catch (e) {
        setStatus('error');
        setError(String(e?.message ?? e));
      }
    })();
    return () => { closed = true; clientRef.current?.close(); };
  }, []);

  return (
    <div style={s.page}>
      <header style={s.header}>
        <h1 style={s.h1}>MCP Apps demo host</h1>
        <span style={{ ...s.pill, background: status === 'connected' ? '#16a34a' : status === 'error' ? '#dc2626' : '#64748b' }}>
          {status}{server ? ` · ${server.name}@${server.version} · MCP ${server.protocol}` : ''}
        </span>
      </header>

      <section style={s.panel}>
        <h3 style={s.h3}>tools/list</h3>
        {tools.map((t) => (
          <div key={t.name} style={s.tool}>
            <div><b>{t.name}</b> — {t.title}</div>
            <div style={s.muted}>_meta.ui.resourceUri: <code>{t._meta?.ui?.resourceUri}</code></div>
            <div style={s.row}>
              <input style={s.input} value={name} onChange={(e) => setName(e.target.value)} aria-label="name" />
              <button style={s.button} onClick={() => callTool(t, { name })}>tools/call {t.name}</button>
            </div>
          </div>
        ))}
      </section>

      {error && <pre style={s.error}>{error}</pre>}

      {call && (
        <section style={s.panel}>
          <h3 style={s.h3}>
            MCP App: <code>{call.resourceUri}</code> <span style={s.muted}>({call.mimeType}, {Math.round(call.html.length / 1024)} KB)</span>
          </h3>
          <McpAppRenderer
            key={call.id}
            messageId={call.id}
            uiResource={{ html: call.html, callToolResult: call.result }}
            hostInfo={{ name: 'mcp-apps-demo-host', version: '1.0.0' }}
            initialHeight={360}
            onMessage={(p) => setMessages((m) => [...m, p.content?.map((c) => c.text).join(' ')])}
          />
          <h3 style={s.h3}>ui/message from app</h3>
          {messages.length === 0 ? <div style={s.muted}>(none yet — click “Send message to host” in the app)</div>
            : messages.map((m, i) => <div key={i} style={s.msg}>{m}</div>)}
        </section>
      )}
    </div>
  );
}

const s = {
  page: { fontFamily: 'system-ui, sans-serif', maxWidth: 960, margin: '0 auto', padding: 24, color: '#0f172a' },
  header: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 },
  h1: { fontSize: 22, margin: 0 },
  h3: { fontSize: 14, margin: '0 0 8px', textTransform: 'none' },
  pill: { color: 'white', borderRadius: 999, padding: '2px 10px', fontSize: 12 },
  panel: { border: '1px solid #e2e8f0', borderRadius: 10, padding: 16, marginBottom: 16, background: '#fff' },
  tool: { display: 'grid', gap: 6 },
  row: { display: 'flex', gap: 8, marginTop: 4 },
  input: { padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6 },
  button: { padding: '6px 12px', borderRadius: 6, border: 'none', background: '#0f172a', color: 'white', cursor: 'pointer' },
  muted: { color: '#64748b', fontSize: 12 },
  msg: { fontSize: 13, padding: '4px 8px', background: '#f1f5f9', borderRadius: 6, marginBottom: 4 },
  error: { color: '#b91c1c', background: '#fef2f2', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap' },
};

createRoot(document.getElementById('root')).render(<App />);
