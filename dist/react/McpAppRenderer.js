import { jsx as _jsx } from "react/jsx-runtime";
import { AppBridge, PostMessageTransport, } from '@modelcontextprotocol/ext-apps/app-bridge';
import { useEffect, useRef, useState } from 'react';
const DEFAULT_HOST_INFO = { name: 'mcp-app-host', version: '1.0.0' };
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
export const McpAppRenderer = ({ uiResource, messageId, hostInfo = DEFAULT_HOST_INFO, initialHeight = 400, onMessage, }) => {
    const iframeRef = useRef(null);
    const bridgeRef = useRef(null);
    const [height, setHeight] = useState(initialHeight);
    const html = uiResource?.text || uiResource?.html;
    const resourceHttpUrl = uiResource?.resourceHttpUrl;
    // Use messageId as the key effect dependency so the bridge re-initialises
    // on every new tool call — even when the same tool is called twice in a row
    // (html content and resourceHttpUrl would be identical, so they wouldn't
    // re-trigger the effect on their own).
    useEffect(() => {
        if ((!html && !resourceHttpUrl) || !iframeRef.current) {
            return;
        }
        const iframe = iframeRef.current;
        let cancelled = false;
        const onLoad = async () => {
            if (!iframe.contentWindow || cancelled) {
                return;
            }
            bridgeRef.current?.close?.();
            bridgeRef.current = null;
            const bridge = new AppBridge(null, // No MCP Client — tool calls are handled directly by the host
            hostInfo, { openLinks: {} }, {
                hostContext: {
                    theme: window.matchMedia('(prefers-color-scheme: dark)').matches
                        ? 'dark'
                        : 'light',
                    platform: 'web',
                    containerDimensions: { maxHeight: 6000 },
                    displayMode: 'inline',
                    availableDisplayModes: ['inline'],
                },
            });
            bridgeRef.current = bridge;
            bridge.onsizechange = ({ height: h }) => {
                if (h !== undefined)
                    setHeight(h);
            };
            bridge.onmessage = (params) => {
                onMessage?.(params);
                return Promise.resolve({});
            };
            bridge.onopenlink = ({ url }) => {
                window.open(url, '_blank', 'noopener,noreferrer');
                return Promise.resolve({});
            };
            // ⚠️ Must set oninitialized BEFORE connect() — the initialized event
            // fires during connect() and would be missed if set afterward.
            bridge.oninitialized = () => {
                // Defer so the app's React effects (useApp) finish running and
                // ontoolresult / ontoolinput handlers are registered before we send.
                // queueMicrotask is not enough — React effects run after paint, so we
                // need setTimeout(0) to push past the current event loop turn.
                setTimeout(() => {
                    if (uiResource?.toolResult) {
                        bridge.sendToolInput({ arguments: uiResource.toolResult });
                    }
                    if (uiResource?.callToolResult) {
                        // eslint-disable-next-line @typescript-eslint/no-explicit-any
                        bridge.sendToolResult(uiResource.callToolResult);
                    }
                }, 0);
            };
            if (cancelled)
                return;
            await bridge.connect(new PostMessageTransport(iframe.contentWindow, iframe.contentWindow));
        };
        iframe.addEventListener('load', onLoad);
        return () => {
            cancelled = true;
            iframe.removeEventListener('load', onLoad);
            bridgeRef.current?.close?.();
            bridgeRef.current = null;
        };
    }, [messageId]); // eslint-disable-line react-hooks/exhaustive-deps
    if (!html && !resourceHttpUrl) {
        console.warn('[McpAppRenderer] No HTML content in uiResource:', uiResource);
        return (_jsx("div", { style: { padding: 12, color: '#999' }, children: "Unable to render UI component (missing HTML content)" }));
    }
    return (_jsx("iframe", { ref: iframeRef, ...(resourceHttpUrl ? { src: resourceHttpUrl } : { srcDoc: html }), sandbox: "allow-scripts allow-same-origin allow-forms allow-popups", style: { width: '100%', border: 'none', height }, title: `mcp-ui-${messageId}` }, messageId));
};
