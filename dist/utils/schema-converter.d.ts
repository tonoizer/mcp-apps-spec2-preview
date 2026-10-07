/**
 * JSON Schema to Zod converter
 * Converts JSON Schema objects to Zod validation schemas
 */
import { z } from 'zod/v4';
/**
 * Convert a JSON Schema to a Zod schema
 */
export declare function jsonSchemaToZod(schema: any): z.ZodTypeAny;
/**
 * Validate that a schema can be converted (for testing/debugging)
 */
export declare function validateJsonSchema(schema: any): {
    valid: boolean;
    errors: string[];
};
