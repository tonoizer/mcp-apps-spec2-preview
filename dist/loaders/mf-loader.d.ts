export interface ModuleFederationConfig {
    remoteName: string;
    remoteEntry: string;
    module: string;
    exportName: string;
    snapshotUrl?: string;
    manifestType?: 'mf' | 'vmok';
}
export interface LoadRemoteOptions {
    config: ModuleFederationConfig;
    addLog: (msg: string) => void;
    /** Ref holding the cached MF instance (reused across calls for the same remote) */
    mfInstanceRef: {
        current: any;
    };
    snapshotCacheRef: {
        current: Map<string, any>;
    };
    lastRemoteNameRef: {
        current: string;
    };
}
/**
 * Load a remote Module Federation component.
 *
 * Dispatches to the appropriate manifest loader based on `manifestType`:
 *   - `"mf"` (default): standard MF path — uses mf-manifest.json directly
 *   - `"vmok"`: ByteDance-internal path — handled by vmok-loader.ts
 *
 * Reuses the existing MF instance when the same remote is requested again,
 * preventing React multi-instance errors ("Invalid hook call").
 *
 * @returns The resolved React component (or module export)
 */
export declare function loadRemoteComponent({ config, addLog, mfInstanceRef, snapshotCacheRef, lastRemoteNameRef, }: LoadRemoteOptions): Promise<any>;
