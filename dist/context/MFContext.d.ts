/**
 * Global Module Federation caching context.
 *
 * Manages shared MF instance and snapshot cache across multiple containers,
 * preventing React Hook conflicts ("Invalid hook call") when loading the same remote.
 */
export interface MFContextType {
    /** Cached MF instance (reused per remote name) */
    mfInstanceRef: {
        current: any;
    };
    /** Cached snapshots (for vmok-based manifests) */
    snapshotCacheRef: {
        current: Map<string, any>;
    };
    /** Last remote name loaded (to detect remote changes) */
    lastRemoteNameRef: {
        current: string;
    };
}
export declare const MFContext: import("react").Context<MFContextType | null>;
/**
 * Hook to access MF caching utilities.
 * Must be used within a <MFProvider>.
 */
export declare function useMFContext(): MFContextType;
