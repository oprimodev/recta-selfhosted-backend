import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import { createFeedbackSchema } from './feedback.schema.js';
import * as feedbackService from './feedback.service.js';

export async function feedbackRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authMiddleware());

  /**
   * POST /feedback
   * Create a new feedback
   */
  app.post('/', {
    schema: {
      description: 'Create a new user feedback',
      tags: ['Feedback'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['score'],
        properties: {
          score: { type: 'number', minimum: 1, maximum: 5 },
          feedbackContent: { type: 'string', maxLength: 5000 },
        },
      },
      response: {
        201: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const input = createFeedbackSchema.parse(request.body);
    
    // Get user email from authenticated user
    const userEmail = request.authUser?.email;
    if (!userEmail) {
      return reply.status(401).send({
        success: false,
        error: {
          code: 'UNAUTHORIZED',
          message: 'User email not found',
        },
      });
    }

    const feedback = await feedbackService.createFeedback(input, userEmail);

    return reply.status(201).send({
      success: true,
      data: feedback,
    });
  });
}
