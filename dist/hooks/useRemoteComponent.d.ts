import type { ModuleFederationConfig } from '../loaders/mf-loader.js';
export interface UseRemoteComponentOptions {
    config: ModuleFederationConfig;
    onLog?: (msg: string) => void;
    /** Timeout for remote loading in milliseconds (default: 20000) */
    loadTimeoutMs?: number;
    /**
     * Dependency array to trigger reload.
     * If not provided, component loads once on mount.
     * If provided, component reloads when deps change.
     */
    deps?: React.DependencyList;
}
export interface UseRemoteComponentResult {
    /** The loaded React component, or null if still loading/error */
    component: any;
    /** Whether the component is currently loading */
    isLoading: boolean;
    /** Error message if loading failed, or null */
    error: string | null;
    /** Manually trigger a reload of the component */
    reload: () => void;
}
/**
 * Hook to load a remote Module Federation component.
 *
 * Handles:
 * - Loading state management
 * - Error handling
 * - MF instance caching (shared across hook instances via MFProvider)
 * - Snapshot caching (for vmok manifests)
 *
 * @example
 * ```tsx
 * const { component: MyComponent, isLoading, error } = useRemoteComponent({
 *   config: {
 *     remoteName: 'my_remote',
 *     remoteEntry: 'http://localhost:8080/mf-manifest.json',
 *     module: './MyComponent',
 *     exportName: 'default',
 *     manifestType: 'mf',
 *   },
 *   onLog: console.log,
 *   deps: [someExternalDep],
 * });
 *
 * if (isLoading) return <div>Loading...</div>;
 * if (error) return <div>Error: {error}</div>;
 * return <MyComponent {...props} />;
 * ```
 */
export declare function useRemoteComponent({ config, onLog, loadTimeoutMs, deps, }: UseRemoteComponentOptions): UseRemoteComponentResult;
