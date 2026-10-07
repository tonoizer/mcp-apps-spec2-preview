/**
 * The payload produced by the server-side enrichment layer and passed to {@link McpAppRenderer}.
 *
 * - `resourceHttpUrl` — preferred: an HTTP URL pointing to the MCP App HTML file
 *   (e.g. `http://localhost:3001/static/mcp-app.html`). The iframe is loaded with
 *   `src=` so it runs under a real origin, which is required for
 *   `history.pushState` and CSP `script-src` to work correctly in a real browser.
 * - `text` / `html` — fallback: raw HTML string loaded via `srcDoc=`.
 *   Works in Electron (Claude Desktop) but NOT in a real browser because
 *   `about:srcdoc` origin breaks `history.*` and CSP domain rules.
 * - `callToolResult` — the serialised `CallToolResult` payload that should be
 *   forwarded to the MCP App after the bridge initialises.
 * - `toolResult` — legacy alias for `callToolResult` (deprecated, use `callToolResult`).
 */
export interface McpAppResource {
    /** HTTP URL to load as iframe `src` (preferred for browser environments) */
    resourceHttpUrl?: string;
    /** Raw HTML string to load as iframe `srcDoc` (Electron / non-browser only) */
    text?: string;
    /** Raw HTML string to load as iframe `srcDoc` (alias for `text`) */
    html?: string;
    /** CallToolResult payload forwarded to the MCP App via AppBridge */
    callToolResult?: unknown;
    /** @deprecated use `callToolResult` */
    toolResult?: unknown;
}
export interface McpAppRendererProps {
    /** The McpAppResource payload from the server-side enrichment layer */
    uiResource: McpAppResource;
    /**
     * A unique ID for this tool call. Used as React `key` and effect dependency
     * so the bridge re-initialises on every new call, even when the same tool is
     * called twice in a row with identical content.
     */
    messageId?: string;
    /** Host application info passed to AppBridge */
    hostInfo?: {
        name: string;
        version: string;
    };
    /** Initial iframe height in px (default: 400) */
    initialHeight?: number;
    /**
     * Called when the MCP App sends a ui/message request (e.g. to trigger the
     * next step in a multi-step flow). The host should relay this as a new chat
     * message so the agent can respond.
     */
    onMessage?: (params: {
        role: string;
        content: Array<{
            type: string;
            text: string;
        }>;
    }) => void;
}
/**
 * Renders an MCP App inside an iframe and wires up the AppBridge communication
 * channel between the host page and the MCP App.
 *
 * ## Browser vs Electron
 *
 * In a real browser, always provide `uiResource.resourceHttpUrl` so the iframe
 * runs under a real HTTP origin. Using `srcDoc` in a browser sets the iframe
 * origin to `null` (`about:srcdoc`), which breaks `history.pushState` and CSP
 * `script-src` rules for dynamically loaded Module Federation chunks.
 *
 * In Electron (e.g. Claude Desktop) both `resourceHttpUrl` and `srcDoc` work.
 *
 * @example
 * ```tsx
 * <McpAppRenderer
 *   uiResource={uiResource}
 *   messageId={message.id}
 *   hostInfo={{ name: 'my-agent', version: '1.0.0' }}
 * />
 * ```
 */
export declare const McpAppRenderer: ({ uiResource, messageId, hostInfo, initialHeight, onMessage, }: McpAppRendererProps) => import("react/jsx-runtime").JSX.Element;
