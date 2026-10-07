import { createContext, useContext } from 'react';
export const MFContext = createContext(null);
/**
 * Hook to access MF caching utilities.
 * Must be used within a <MFProvider>.
 */
export function useMFContext() {
    const context = useContext(MFContext);
    if (!context) {
        throw new Error('useMFContext must be used within a <MFProvider>');
    }
    return context;
}
