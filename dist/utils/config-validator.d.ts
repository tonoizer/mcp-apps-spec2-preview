/**
 * Configuration validator for mcp_apps.json
 * Ensures configuration is valid before server starts
 */
import { z } from 'zod/v4';
export declare const McpAppsConfigSchema: z.ZodObject<{
    version: z.ZodOptional<z.ZodString>;
    remotes: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        version: z.ZodOptional<z.ZodString>;
        baseUrl: z.ZodString;
        locale: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        manifestType: z.ZodDefault<z.ZodOptional<z.ZodEnum<{
            vmok: "vmok";
            mf: "mf";
        }>>>;
        snapshotUrl: z.ZodOptional<z.ZodString>;
        csp: z.ZodObject<{
            connectDomains: z.ZodArray<z.ZodString>;
            resourceDomains: z.ZodArray<z.ZodString>;
            frameDomains: z.ZodOptional<z.ZodArray<z.ZodString>>;
            baseUriDomains: z.ZodOptional<z.ZodArray<z.ZodString>>;
        }, z.core.$strip>;
    }, z.core.$strip>>;
    tools: z.ZodArray<z.ZodObject<{
        name: z.ZodString;
        title: z.ZodString;
        description: z.ZodString;
        inputSchema: z.ZodDefault<z.ZodOptional<z.ZodAny>>;
        remote: z.ZodString;
        module: z.ZodString;
        exportName: z.ZodDefault<z.ZodOptional<z.ZodString>>;
        visibility: z.ZodDefault<z.ZodOptional<z.ZodArray<z.ZodEnum<{
            model: "model";
            app: "app";
        }>>>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export interface ValidationError {
    path: string;
    message: string;
}
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}
/**
 * Validate configuration against schema
 */
export declare function validateConfig(config: any): ValidationResult;
/**
 * Type guard for validated config
 */
export type McpAppsConfig = z.infer<typeof McpAppsConfigSchema>;
