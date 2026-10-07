import React from 'react';
interface MFProviderProps {
    children: React.ReactNode;
}
/**
 * Provider component for global Module Federation caching.
 *
 * Wraps your application to share MF instance cache and snapshot cache
 * across all <RemoteComponentContainer> components. This prevents:
 * - React Hook conflicts ("Invalid hook call") when reusing the same remote
 * - Duplicate MF instance creation
 * - Unnecessary snapshot fetches
 *
 * Usage:
 * ```tsx
 * <MFProvider>
 *   <App />
 * </MFProvider>
 * ```
 */
export declare function MFProvider({ children }: MFProviderProps): import("react/jsx-runtime").JSX.Element;
export {};
