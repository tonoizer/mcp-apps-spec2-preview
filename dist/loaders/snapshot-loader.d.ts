interface SnapshotLoaderOptions {
    snapshotUrl: string;
    addLog: (msg: string) => void;
    snapshotCache: Map<string, any>;
}
/**
 * Initialize the __VMOK__ global object (ByteDance-internal, vmok mode only)
 */
export declare function initializeVMOK(): void;
/**
 * Load and inject a snapshot into the global __VMOK__ object.
 * Supports caching to avoid repeated fetches.
 */
export declare function loadAndInjectSnapshot({ snapshotUrl, addLog, snapshotCache }: SnapshotLoaderOptions): Promise<void>;
/**
 * Generate a snapshot URL.
 * Falls back to auto-deriving from remoteEntry if not provided.
 */
export declare function generateSnapshotUrl(configSnapshotUrl: string | undefined, remoteEntry: string): string;
/**
 * Fix a single protocol-relative URL (// prefix → https://).
 */
export declare function fixProtocolRelativeUrl(url: string): string;
export {};
