/**
 * Helper functions for Swagger/OpenAPI documentation
 */

export function createSwaggerSchema(options: {
  description: string;
  tag: string;
  requiresAuth?: boolean;
  params?: any;
  querystring?: any;
  body?: any;
  response?: any;
}) {
  const { description, tag, requiresAuth = true, params, querystring, body, response } = options;

  const schema: any = {
    description,
    tags: [tag],
  };

  if (requiresAuth) {
    schema.security = [{ bearerAuth: [] }];
  }

  if (params) {
    schema.params = params;
  }

  if (querystring) {
    schema.querystring = querystring;
  }

  if (body) {
    schema.body = body;
  }

  if (response) {
    schema.response = response;
  } else {
    // Default response
    schema.response = {
      200: {
        type: 'object',
        properties: {
          success: { type: 'boolean' },
          data: { type: 'object' },
        },
      },
    };
  }

  return schema;
}

