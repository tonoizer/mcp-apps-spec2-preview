/**
 * Module Federation Renderer API
 *
 * Public entry for MF module developers to load and render remote components.
 *
 * @example
 * import { MFProvider, RemoteComponentContainer } from '@module-federation/mcp-apps/renderer';
 */
// Context & Provider
export { MFProvider } from './context/MFProvider.js';
export { MFContext, useMFContext } from './context/MFContext.js';
// Hook
export { useRemoteComponent } from './hooks/useRemoteComponent.js';
// Components
export { RemoteComponentContainer } from './components/remote-component-container.js';
