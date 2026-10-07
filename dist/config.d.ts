/**
 * Configuration loader and types
 */
export interface ModuleFederationConfig {
    remoteName: string;
    remoteEntry: string;
    module: string;
    exportName?: string;
}
export interface CSPConfig {
    connectDomains?: string[];
    resourceDomains?: string[];
}
export interface ResourceConfig {
    name: string;
    uri: string;
    mimeType?: string;
    moduleFederation: ModuleFederationConfig;
    csp?: CSPConfig;
}
export interface ToolConfig {
    name: string;
    title: string;
    description: string;
    inputSchema?: Record<string, unknown>;
    ui: {
        resourceUri: string;
        visibility?: string[];
    };
}
export interface McpAppsConfig {
    tools: ToolConfig[];
    resources: ResourceConfig[];
}
/**
 * Load and validate MCP Apps configuration
 */
export declare function loadConfig(configPath: string): Promise<McpAppsConfig>;
/**
 * Get resource by URI
 */
export declare function getResourceByUri(config: McpAppsConfig, uri: string): ResourceConfig | undefined;
