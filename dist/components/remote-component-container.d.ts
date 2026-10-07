import React from 'react';
import type { ModuleFederationConfig } from '../loaders/mf-loader.js';
import type { App } from '@modelcontextprotocol/ext-apps';
import '../styles/component-renderer.css';
export interface RemoteComponentContainerProps {
    /**
     * Module Federation configuration for loading the remote component.
     * Must include remoteName, remoteEntry, module, exportName, and manifestType.
     */
    config: ModuleFederationConfig;
    /**
     * Props to pass to the loaded remote component.
     * These are spread as component props: <RemoteComponent {...args} />
     */
    args?: Record<string, any>;
    /**
     * Optional MCP App instance to pass as `mcpApp` prop to the component.
     * This allows the remote component to communicate with the MCP host.
     */
    mcpApp?: App | null;
    /**
     * Optional callback to log messages during loading.
     */
    onLog?: (msg: string) => void;
    /**
     * Custom loading UI. Defaults to a spinner + "Loading..." text.
     */
    loadingFallback?: React.ReactNode;
    /**
     * Custom error UI. Defaults to error details with stack trace.
     * Receives error message as string.
     */
    errorFallback?: (error: string) => React.ReactNode;
    /**
     * Custom wrapper class name for the component container.
     */
    className?: string;
    /**
     * Optional dependency array to trigger reload.
     * If provided, component reloads when deps change.
     */
    deps?: React.DependencyList;
}
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
export declare function RemoteComponentContainer({ config, args, mcpApp, onLog, loadingFallback, errorFallback, className, deps, }: RemoteComponentContainerProps): import("react/jsx-runtime").JSX.Element;
