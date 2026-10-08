import type { McpServerFactory, McpHttpHandler } from '@modelcontextprotocol/server';
import type { IncomingMessage, ServerResponse } from 'node:http';
export interface StreamableHttpHandlerOptions {
    /** Called for transport/handler errors. Defaults to logging on stderr. */
    onerror?: (error: Error) => void;
    /**
     * How 2025-era (initialize-handshake) traffic is served.
     * - `'sessions'` (default): one server instance per `Mcp-Session-Id`, so the
     *   client capabilities declared in `initialize` are known for later requests.
     *   Session-less, non-initialize requests still get the stateless fallback.
     * - `'stateless'`: every legacy request is answered by a fresh instance (0.0.x behaviour).
     */
    legacy?: 'sessions' | 'stateless';
    /** Idle legacy sessions are closed after this many ms (0 disables). @default 1800000 */
    sessionIdleTimeoutMs?: number;
    /** Upper bound on concurrent legacy sessions. @default 1000 */
    maxSessions?: number;
    /** Response mode for the 2026-07-28 leg (see `createMcpHandler`). */
    responseMode?: 'auto' | 'sse' | 'json';
}
export interface StreamableHttpHandler {
    /** Node/Express request handler: `app.all('/mcp', (req, res) => void h.handle(req, res, req.body))`. */
    handle(req: IncomingMessage, res: ServerResponse, parsedBody?: unknown): Promise<void>;
    /** Closes all legacy sessions and the modern handler. */
    close(): Promise<void>;
    /** Number of open legacy sessions. */
    sessionCount(): number;
    /** The underlying SDK handler serving 2026-07-28 traffic. */
    modern: McpHttpHandler;
}
/**
 * Serve an MCP server factory on one Streamable HTTP endpoint for both
 * protocol eras (2026-07-28 via `server/discover` + per-request envelope,
 * 2025-11-25 and older via sessionful `initialize`).
 */
export declare function createStreamableHttpHandler(factory: McpServerFactory, options?: StreamableHttpHandlerOptions): StreamableHttpHandler;
export interface StdioServeOptions {
    onerror?: (error: Error) => void;
    /** `'serve'` (default) also accepts 2025-era `initialize` handshakes; `'reject'` is modern-only. */
    legacy?: 'serve' | 'reject';
    maxSubscriptions?: number;
}
/** Serve an MCP server factory over stdio for both protocol eras (wraps the SDK's `serveStdio`). */
export declare function serveStdioServer(factory: McpServerFactory, options?: StdioServeOptions): {
    close(): Promise<void>;
};
