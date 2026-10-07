import { McpServer } from '@modelcontextprotocol/server';
export interface CreateServerOptions {
    configPath: string;
    /**
     * When true, mcp-app.html is re-read from disk on every resources/read
     * request instead of being served from the in-memory cache.
     * Enable with `--dev` CLI flag or `NODE_ENV=development`.
     */
    devMode?: boolean;
    /**
     * HTTP server base URL (e.g. `http://localhost:3001`).
     * When set, `resources/read` returns the tiny `mcp-app-shell.html` (~1 KB)
     * that loads JS/CSS from `{shellBaseUrl}/static/...` instead of the full
     * self-contained 686 KB inline HTML.
     * Leave undefined in stdio mode (no HTTP server available).
     */
    shellBaseUrl?: string;
}
/**
 * Create and configure the MCP server
 */
export declare function createServer({ configPath, devMode, shellBaseUrl }: CreateServerOptions): Promise<McpServer>;
