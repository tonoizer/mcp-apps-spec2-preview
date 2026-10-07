/**
 * Module Federation Renderer API
 *
 * Public entry for MF module developers to load and render remote components.
 *
 * @example
 * import { MFProvider, RemoteComponentContainer } from '@module-federation/mcp-apps/renderer';
 */
export { MFProvider } from './context/MFProvider.js';
export { MFContext, useMFContext, type MFContextType } from './context/MFContext.js';
export { useRemoteComponent, type UseRemoteComponentOptions, type UseRemoteComponentResult } from './hooks/useRemoteComponent.js';
export { RemoteComponentContainer, type RemoteComponentContainerProps } from './components/remote-component-container.js';
export type { ModuleFederationConfig, LoadRemoteOptions } from './loaders/mf-loader.js';
