import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import { useRemoteComponent } from '../hooks/useRemoteComponent.js';
import { ErrorBoundary } from './error-boundary.js';
import '../styles/component-renderer.css';
/**
 * Container component for rendering remote Module Federation components.
 *
 * This is the easiest way to load and render a remote component.
 * It handles loading, error states, and passes props/mcpApp automatically.
 *
 * @example
 * ```tsx
 * <MFProvider>
 *   <RemoteComponentContainer
 *     config={{
 *       remoteName: 'my_remote',
 *       remoteEntry: 'http://localhost:8080/mf-manifest.json',
 *       module: './MyComponent',
 *       exportName: 'default',
 *       manifestType: 'mf',
 *     }}
 *     args={{ title: 'Hello' }}
 *     mcpApp={app}
 *     onLog={console.log}
 *   />
 * </MFProvider>
 * ```
 */
export function RemoteComponentContainer({ config, args = {}, mcpApp = null, onLog, loadingFallback, errorFallback, className, deps, }) {
    const { component: RemoteComponent, isLoading, error } = useRemoteComponent({
        config,
        onLog,
        deps,
    });
    return (_jsx("div", { className: className || 'mf-content', children: _jsxs("div", { className: "mf-component-container", children: [isLoading && (loadingFallback ?? (_jsxs("div", { className: "mf-loading-wrapper", children: [_jsx("div", { className: "loading-spinner" }), _jsx("div", { className: "mf-loading-text", children: "Loading..." })] }))), !isLoading && error && (errorFallback ? (errorFallback(error)) : (_jsxs("div", { className: "component-error-container", children: [_jsx("div", { className: "component-error-icon", children: "\u274C" }), _jsx("div", { className: "component-error-title", children: "Component Load Error" }), _jsx("div", { className: "component-error-message", children: error })] }))), !isLoading && !error && RemoteComponent && (_jsx("div", { className: "mf-component-wrapper", children: _jsx("div", { "data-component-container": true, className: "mf-component-wrapper", children: _jsx(ErrorBoundary, { children: _jsx(RemoteComponent, { ...args, mcpApp: mcpApp }) }) }) }))] }) }));
}
