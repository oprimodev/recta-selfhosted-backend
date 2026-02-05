import { zodToJsonSchema } from 'zod-to-json-schema';
import type { ZodSchema } from 'zod';

/**
 * Convert a Zod schema to Fastify/JSON Schema format for Swagger
 */
export function zodToFastifySchema(zodSchema: ZodSchema): any {
  const jsonSchema = zodToJsonSchema(zodSchema, {
    target: 'openApi3',
    $refStrategy: 'none', // Inline all schemas to avoid $ref issues
  });

  // Fastify expects the schema to be at the root level
  return jsonSchema;
}

