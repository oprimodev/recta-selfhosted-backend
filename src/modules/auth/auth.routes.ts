import type { FastifyInstance } from 'fastify';
import { authMiddleware, getAuthUser } from '../../shared/middleware/auth.middleware.js';
import {
  getUserByFirebaseUid,
  getUserHouseholds,
} from '../../shared/middleware/authorization.middleware.js';
import { isProduction } from '../../shared/config/env.js';
import { getOrCreatePersonalHousehold } from '../households/households.service.js';
import { processReferralCode } from '../users/referrals.service.js';
import { prisma } from '../../shared/db/prisma.js';

export async function authRoutes(app: FastifyInstance) {
  /**
   * GET /auth/me
   * Get current user info
   * Returns user's households (if any)
   */
  app.get(
    '/me',
    {
      schema: {
        description: 'Get current authenticated user info',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  email: { type: 'string', format: 'email' },
                  firebaseUid: { type: 'string' },
                  createdAt: { type: 'string', format: 'date-time' },
                  households: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        role: { type: 'string' },
                        joinedAt: { type: 'string', format: 'date-time' },
                        createdAt: { type: 'string', format: 'date-time' },
                        updatedAt: { type: 'string', format: 'date-time' },
                      },
                      // IMPORTANT: without declaring properties (or allowing additionalProperties),
                      // Fastify's serializer may strip fields and return `{}` objects.
                      additionalProperties: true,
                    },
                  },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
      preHandler: authMiddleware(),
    },
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      // Get user's households (may be empty)
      const households = await getUserHouseholds(user.id);

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          firebaseUid: user.firebaseUid,
          createdAt: user.createdAt,
          households,
        },
      });
    }
  );

  /**
   * POST /auth/sync
   * Sync Firebase user with database
   * Called after successful Firebase authentication
   * Optionally accepts referralCode in body to process referral
   */
  app.post(
    '/sync',
    {
      schema: {
        description: 'Sync Firebase user with database. Called after successful Firebase authentication. Optionally accepts referralCode in body.',
        tags: ['Auth'],
        security: [{ bearerAuth: [] }],
        body: {
          type: 'object',
          properties: {
            referralCode: { type: 'string', maxLength: 20 },
          },
          // Allow empty object when no referralCode is provided
          additionalProperties: false,
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  email: { type: 'string', format: 'email' },
                  emailVerified: { type: 'boolean' },
                  createdAt: { type: 'string', format: 'date-time' },
                  householdId: { type: 'string', format: 'uuid' },
                },
              },
            },
          },
          401: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              error: { type: 'string' },
            },
          },
        },
      },
      preHandler: authMiddleware({ requireEmailVerified: false }),
    },
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const body = request.body as { referralCode?: string } | undefined;
      const referralCode = body?.referralCode;

      // Create or get user
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      // Process referral code if provided (only for users without existing referral record)
      // The processReferralCode function already handles duplicate checks and validation
      if (referralCode) {
        // Check if user already has a referral record
        const existingReferral = await prisma.referral.findUnique({
          where: {
            referredId: user.id,
          },
        });

        // Process referral if user doesn't have one yet
        // Also check if user was created recently (within 5 minutes) to avoid processing for very old users
        const hasNoReferralRecord = !existingReferral;
        const wasCreatedRecently = user.createdAt && 
          new Date().getTime() - new Date(user.createdAt).getTime() < 300000; // 5 minutes threshold
        
        if (hasNoReferralRecord && wasCreatedRecently) {
          try {
            if (!isProduction) {
              console.log('[Referral] Processing referral for new user');
            }
            const referrerId = await processReferralCode(referralCode, user.id);
            if (referrerId && !isProduction) {
              console.log('[Referral] Referral processed successfully');
            }
          } catch (error) {
            if (!isProduction) {
              console.error('[Referral] Error processing referral code:', error);
            }
          }
        }
      }

      // Create personal household automatically if it doesn't exist
      // This ensures users always have a household from the first login
      const household = await getOrCreatePersonalHousehold(user.id, user.email);

      return reply.send({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          emailVerified: authUser.emailVerified,
          createdAt: user.createdAt,
          householdId: household.id, // Return household ID so frontend can save it
        },
      });
    }
  );
}






