import { useState } from 'react';

/**
 * Exposed as `demo_remote/Greeting`.
 * Rendered by the package's MCP App (dist/mcp-app.html) inside the host iframe.
 * Props = tool arguments + `mcpApp` (the ext-apps App instance in the iframe).
 */
export default function Greeting({ name = 'world', mcpApp }) {
  const [count, setCount] = useState(0);
  const [sent, setSent] = useState(false);

  const sendToHost = async () => {
    await mcpApp?.sendMessage?.({
      role: 'user',
      content: [{ type: 'text', text: `Hello from the MCP Apps demo (greeting: ${name}, clicked ${count}x)` }],
    });
    setSent(true);
  };

  return (
    <div style={styles.card}>
      <div style={styles.badge}>Module Federation remote · demo_remote/Greeting</div>
      <h2 style={styles.title}>Hello, {name}! 👋</h2>
      <p style={styles.text}>
        This card is a React component loaded at runtime from a Module Federation remote and
        rendered inside an MCP App (<code>text/html;profile=mcp-app</code>) iframe.
      </p>
      <div style={styles.row}>
        <button style={styles.button} onClick={() => setCount((c) => c + 1)}>
          Clicked {count}×
        </button>
        <button style={{ ...styles.button, ...styles.secondary }} onClick={sendToHost} disabled={!mcpApp}>
          {sent ? 'Message sent ✓' : 'Send message to host'}
        </button>
      </div>
    </div>
  );
}

const styles = {
  card: { fontFamily: 'system-ui, sans-serif', padding: 24, borderRadius: 12, background: 'linear-gradient(135deg,#eef2ff,#f0fdfa)', border: '1px solid #c7d2fe', color: '#1e1b4b' },
  badge: { display: 'inline-block', fontSize: 12, padding: '2px 8px', borderRadius: 999, background: '#4f46e5', color: 'white', marginBottom: 12 },
  title: { margin: '0 0 8px', fontSize: 26 },
  text: { margin: '0 0 16px', lineHeight: 1.5, color: '#334155' },
  row: { display: 'flex', gap: 12 },
  button: { padding: '8px 14px', borderRadius: 8, border: 'none', background: '#4f46e5', color: 'white', fontSize: 14, cursor: 'pointer' },
  secondary: { background: '#0d9488' },
};
