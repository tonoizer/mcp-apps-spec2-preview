import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import { ErrorBoundary } from './error-boundary.js';
import '../styles/component-renderer.css';
export function ComponentRenderer({ isLoadingMF, mfError, RemoteComponent, currentTool, addLog, app, }) {
    return (_jsx("div", { className: "mf-content", children: _jsxs("div", { className: "mf-component-container", children: [isLoadingMF && (_jsxs("div", { className: "mf-loading-wrapper", children: [_jsx("div", { className: "loading-spinner" }), _jsx("div", { className: "mf-loading-text", children: "Loading..." })] })), !isLoadingMF && !mfError && RemoteComponent && (() => {
                    console.log(`🎨 [render] Preparing to render component`, {
                        RemoteComponent: !!RemoteComponent,
                        componentType: typeof RemoteComponent,
                        isLoadingMF,
                        mfError,
                        args: currentTool?.args
                    });
                    try {
                        return (_jsx("div", { className: "mf-component-wrapper", children: _jsx("div", { "data-component-container": true, className: "mf-component-wrapper", children: _jsx(ErrorBoundary, { children: _jsx(RemoteComponent, { ...(currentTool?.args || {}), mcpApp: app }) }) }) }));
                    }
                    catch (outerError) {
                        console.error(`❌ [render] Outer error:`, outerError);
                        addLog(`❌ Component render error: ${outerError.message}`);
                        return (_jsxs("div", { className: "component-error-container", children: [_jsx("div", { className: "component-error-icon", children: "\u274C" }), _jsx("div", { className: "component-error-title", children: "Component Load Error" }), _jsx("div", { className: "component-error-message", children: outerError.message || String(outerError) }), outerError.stack && (_jsxs("details", { className: "component-error-stack", children: [_jsx("summary", { className: "component-error-stack-summary", children: "View full stack trace" }), _jsx("pre", { className: "component-error-stack-pre", children: outerError.stack })] }))] }));
                    }
                })()] }) }));
}
