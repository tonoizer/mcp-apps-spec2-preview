/**
 * Transport wiring for serving an MCP server factory over both protocol eras:
 *
 * - **2026-07-28 ("modern")** — per-request `_meta` envelope, `server/discover`
 *   negotiation. Served by the SDK's `createMcpHandler` (HTTP) and `serveStdio`
 *   (stdio), which install the `server/discover` handler and pin the revision.
 * - **2025-11-25 and older ("legacy")** — `initialize` handshake. On HTTP this is
 *   served *sessionfully* (one McpServer + Streamable HTTP transport per
 *   `Mcp-Session-Id`), so the capabilities a client declares in `initialize`
 *   are actually known when it later calls tools, GET opens the standalone SSE
 *   stream, and DELETE ends the session. Claim-less requests that arrive without
 *   a session (e.g. stateless JSON-RPC callers that never initialize) are still
 *   answered by the SDK's stateless legacy fallback, as in 0.0.x.
 *
 * Routing between the two uses the SDK's own `isLegacyRequest` classifier, so
 * it can never disagree with `createMcpHandler`.
 */
import { randomUUID } from 'node:crypto';
import { createMcpHandler, isInitializeRequest, isJsonContentType, isLegacyRequest, legacyStatelessFallback, } from '@modelcontextprotocol/server';
import { serveStdio } from '@modelcontextprotocol/server/stdio';
import { NodeStreamableHTTPServerTransport, toNodeHandler, toWebRequest } from '@modelcontextprotocol/node';
const DEFAULT_SESSION_IDLE_TIMEOUT_MS = 30 * 60 * 1000;
const DEFAULT_MAX_SESSIONS = 1000;
function jsonRpcError(res, status, code, message, id = null) {
    if (res.headersSent)
        return;
    res.writeHead(status, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ jsonrpc: '2.0', error: { code, message }, id }));
}
function isJsonPost(req) {
    if (req.method !== 'POST')
        return true;
    const header = req.headers['content-type'];
    return isJsonContentType(Array.isArray(header) ? header[0] : header);
}
function containsInitialize(body) {
    return Array.isArray(body) ? body.some((m) => isInitializeRequest(m)) : isInitializeRequest(body);
}
/**
 * Create a Node/Express request handler that serves an MCP server factory on
 * one Streamable HTTP endpoint for both protocol eras.
 *
 * @example
 * ```js
 * const mcp = createStreamableHttpHandler(() => createServer({ configPath }));
 * app.all('/mcp', (req, res) => void mcp.handle(req, res, req.body));
 * ```
 */
export function createStreamableHttpHandler(factory, options = {}) {
    const { onerror = (error) => console.error('[MF MCP] MCP error:', error), legacy = 'sessions', sessionIdleTimeoutMs = DEFAULT_SESSION_IDLE_TIMEOUT_MS, maxSessions = DEFAULT_MAX_SESSIONS, responseMode, } = options;
    const modern = createMcpHandler(factory, { legacy: 'reject', onerror, ...(responseMode ? { responseMode } : {}) });
    const handleModern = toNodeHandler(modern, { onerror });
    const statelessLegacy = legacyStatelessFallback(factory, onerror);
    const handleStatelessLegacy = toNodeHandler({ fetch: (request, opts) => statelessLegacy(request, opts) }, { onerror });
    /** @type {Map<string, { transport: NodeStreamableHTTPServerTransport, server: any, lastSeen: number }>} */
    const sessions = new Map();
    const closeSession = async (sessionId) => {
        const session = sessions.get(sessionId);
        if (!session)
            return;
        sessions.delete(sessionId);
        await session.transport.close().catch(() => { });
        await session.server.close?.().catch?.(() => { });
    };
    const sweeper = sessionIdleTimeoutMs > 0
        ? setInterval(() => {
            const cutoff = Date.now() - sessionIdleTimeoutMs;
            for (const [id, s] of sessions)
                if (s.lastSeen < cutoff)
                    void closeSession(id);
        }, Math.min(sessionIdleTimeoutMs, 60_000))
        : undefined;
    sweeper?.unref?.();
    async function handleLegacy(req, res, parsedBody) {
        if (legacy === 'stateless')
            return handleStatelessLegacy(req, res, parsedBody);
        const header = req.headers['mcp-session-id'];
        const sessionId = Array.isArray(header) ? header[0] : header;
        if (sessionId) {
            const session = sessions.get(sessionId);
            if (!session)
                return jsonRpcError(res, 404, -32001, 'Session not found');
            session.lastSeen = Date.now();
            return session.transport.handleRequest(req, res, parsedBody);
        }
        if (req.method === 'POST' && containsInitialize(parsedBody)) {
            if (sessions.size >= maxSessions)
                return jsonRpcError(res, 503, -32000, 'Too many MCP sessions', parsedBody?.id ?? null);
            const server = await factory({ era: 'legacy' });
            const transport = new NodeStreamableHTTPServerTransport({
                sessionIdGenerator: () => randomUUID(),
                onsessioninitialized: (id) => {
                    sessions.set(id, { transport, server, lastSeen: Date.now() });
                },
                onsessionclosed: (id) => {
                    // DELETE /mcp: let the transport finish answering, then release the instance.
                    sessions.delete(id);
                    setImmediate(() => void server.close?.().catch?.(() => { }));
                },
            });
            transport.onclose = () => {
                if (transport.sessionId)
                    sessions.delete(transport.sessionId);
            };
            await server.connect(transport);
            return transport.handleRequest(req, res, parsedBody);
        }
        // No session and not an initialize: keep 0.0.x stateless behaviour for
        // simple JSON-RPC callers (and answer GET/DELETE with 405).
        return handleStatelessLegacy(req, res, parsedBody);
    }
    async function handle(req, res, parsedBody) {
        try {
            if (!isJsonPost(req))
                return jsonRpcError(res, 415, -32000, 'Unsupported Media Type: Content-Type must be application/json');
            const probe = await toWebRequest(req, parsedBody);
            const isLegacy = await isLegacyRequest(probe, parsedBody);
            if (!isLegacy)
                return await handleModern(req, res, parsedBody);
            return await handleLegacy(req, res, parsedBody);
        }
        catch (error) {
            onerror(error instanceof Error ? error : new Error(String(error)));
            jsonRpcError(res, 500, -32603, 'Internal server error');
        }
    }
    async function close() {
        if (sweeper)
            clearInterval(sweeper);
        await Promise.all([...sessions.keys()].map(closeSession));
        await modern.close();
    }
    return { handle, close, sessionCount: () => sessions.size, modern };
}
/**
 * Serve an MCP server factory over stdio for both protocol eras. The opening
 * exchange selects the era: a `server/discover` probe pins 2026-07-28, an
 * `initialize` handshake pins the legacy (2025-11-25) protocol. Thin wrapper
 * around the SDK's `serveStdio`.
 */
export function serveStdioServer(factory, options = {}) {
    const { onerror = (error) => console.error('[MF MCP] MCP error:', error), ...rest } = options;
    return serveStdio(factory, { legacy: 'serve', onerror, ...rest });
}
