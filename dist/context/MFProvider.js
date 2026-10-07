import { jsx as _jsx } from "react/jsx-runtime";
import React, { useRef } from 'react';
import { MFContext } from './MFContext.js';
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
export function MFProvider({ children }) {
    const mfInstanceRef = useRef(null);
    const snapshotCacheRef = useRef(new Map());
    const lastRemoteNameRef = useRef('');
    const contextValue = {
        mfInstanceRef,
        snapshotCacheRef,
        lastRemoteNameRef,
    };
    return (_jsx(MFContext.Provider, { value: contextValue, children: children }));
}
