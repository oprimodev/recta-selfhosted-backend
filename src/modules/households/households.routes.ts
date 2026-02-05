import type { FastifyInstance } from 'fastify';
import { authMiddleware, getAuthUser } from '../../shared/middleware/auth.middleware.js';
import {
  requireHouseholdMember,
  requireOwner,
  getUserByFirebaseUid,
  getUserHouseholds,
} from '../../shared/middleware/authorization.middleware.js';
import {
  createHouseholdSchema,
  updateHouseholdSchema,
  inviteMemberSchema,
  updateMemberRoleSchema,
  updatePersonalAccountAccessSchema,
  updateSharedAccountIdsSchema,
  householdIdParamSchema,
  memberIdParamSchema,
} from './households.schema.js';
import * as householdsService from './households.service.js';

export async function householdRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authMiddleware());

  /**
   * GET /households
   * List all households the user is a member of
   */
  app.get('/', {
    schema: {
      description: 'List all households the user is a member of',
      tags: ['Households'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string', format: 'uuid' },
                  name: { type: 'string' },
                  role: { type: 'string', enum: ['OWNER', 'EDITOR', 'VIEWER'] },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  joinedAt: { type: 'string', format: 'date-time' },
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
  }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

    const households = await getUserHouseholds(user.id);

    return reply.send({
      success: true,
      data: households,
    });
  });

  /**
   * POST /households
   * Create a new household
   */
  app.post('/', {
    schema: {
      description: 'Create a new household',
      tags: ['Households'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        required: ['name'],
        properties: {
          name: { type: 'string', minLength: 1, maxLength: 100 },
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
    const authUser = getAuthUser(request);
    const user = await getUserByFirebaseUid(authUser.uid, authUser.email);
    const input = createHouseholdSchema.parse(request.body);

    const household = await householdsService.createHousehold(user.id, input);

    return reply.status(201).send({
      success: true,
      data: household,
    });
  });

  /**
   * GET /households/:householdId
   * Get household details
   */
  app.get<{ Params: { householdId: string } }>(
    '/:householdId',
    {
      schema: {
        description: 'Get household details',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { householdId } = householdIdParamSchema.parse(request.params);
      await requireHouseholdMember(request, householdId);

      const household = await householdsService.getHousehold(householdId);

      return reply.send({
        success: true,
        data: household,
      });
    }
  );

  /**
   * PATCH /households/:householdId
   * Update household details (OWNER only)
   */
  app.patch<{ Params: { householdId: string } }>(
    '/:householdId',
    {
      schema: {
        description: 'Update household details (OWNER only)',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          properties: {
            name: { type: 'string', minLength: 1, maxLength: 100 },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { householdId } = householdIdParamSchema.parse(request.params);
      await requireOwner(request, householdId);

      const input = updateHouseholdSchema.parse(request.body);
      const household = await householdsService.updateHousehold(householdId, input);

      return reply.send({
        success: true,
        data: household,
      });
    }
  );

  /**
   * DELETE /households/:householdId
   * Delete household (OWNER only)
   */
  app.delete<{ Params: { householdId: string } }>(
    '/:householdId',
    {
      schema: {
        description: 'Delete household (OWNER only)',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request, reply) => {
      const { householdId } = householdIdParamSchema.parse(request.params);
      await requireOwner(request, householdId);

      await householdsService.deleteHousehold(householdId);

      return reply.status(204).send();
    }
  );

  /**
   * POST /households/:householdId/leave
   * Leave a household (non-owners only)
   */
  app.post<{ Params: { householdId: string } }>(
    '/:householdId/leave',
    {
      schema: {
        description: 'Leave a household (non-owners only)',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request, reply) => {
      const { householdId } = householdIdParamSchema.parse(request.params);
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      await requireHouseholdMember(request, householdId);
      await householdsService.leaveHousehold(householdId, user.id);

      return reply.status(204).send();
    }
  );

  // ============================================================================
  // MEMBERS ROUTES
  // ============================================================================

  /**
   * GET /households/:householdId/members
   * List all members of a household
   */
  app.get<{ Params: { householdId: string } }>(
    '/:householdId/members',
    {
      schema: {
        description: 'List all members of a household',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                    properties: {
                      id: { type: 'string', format: 'uuid' },
                      householdId: { type: 'string', format: 'uuid' },
                      userId: { type: 'string', format: 'uuid' },
                      role: { type: 'string', enum: ['OWNER', 'EDITOR', 'VIEWER'] },
                      allowPersonalAccountAccess: { type: 'boolean' },
                      sharedAccountIds: { 
                        oneOf: [
                          { type: 'array', items: { type: 'string', format: 'uuid' } },
                          { type: 'null' },
                        ],
                      },
                      createdAt: { type: 'string', format: 'date-time' },
                      updatedAt: { type: 'string', format: 'date-time' },
                      // Relation: user
                      user: {
                        type: 'object',
                        properties: {
                          id: { type: 'string', format: 'uuid' },
                          email: { type: 'string' },
                          displayName: { type: 'string', nullable: true },
                          createdAt: { type: 'string', format: 'date-time' },
                        },
                        additionalProperties: true,
                      },
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
    },
    async (request, reply) => {
      const { householdId } = householdIdParamSchema.parse(request.params);
      await requireHouseholdMember(request, householdId);

      const members = await householdsService.getHouseholdMembers(householdId);

      return reply.send({
        success: true,
        data: members,
      });
    }
  );

  /**
   * POST /households/:householdId/invite
   * Invite a user to the household (OWNER only)
   */
  app.post<{ Params: { householdId: string } }>(
    '/:householdId/invite',
    {
      schema: {
        description: 'Invite a user to the household (OWNER only)',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['email'],
          properties: {
            email: { type: 'string', format: 'email' },
            role: { type: 'string', enum: ['EDITOR', 'VIEWER'] },
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
    },
    async (request, reply) => {
      const { householdId } = householdIdParamSchema.parse(request.params);
      await requireOwner(request, householdId);

      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      const input = inviteMemberSchema.parse(request.body);
      const invite = await householdsService.inviteMember(householdId, user.id, input);

      return reply.status(201).send({
        success: true,
        data: invite,
      });
    }
  );

  /**
   * PATCH /households/:householdId/members/:memberId
   * Update member role (OWNER only)
   */
  app.patch<{ Params: { householdId: string; memberId: string } }>(
    '/:householdId/members/:memberId',
    {
      schema: {
        description: 'Update member role (OWNER only)',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId', 'memberId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
            memberId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            role: { type: 'string', enum: ['EDITOR', 'VIEWER'] },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { householdId, memberId } = memberIdParamSchema.parse(request.params);
      await requireOwner(request, householdId);

      const { role } = updateMemberRoleSchema.parse(request.body);
      const member = await householdsService.updateMemberRole(householdId, memberId, role);

      return reply.send({
        success: true,
        data: member,
      });
    }
  );

  /**
   * PATCH /households/:householdId/members/me/personal-account-access
   * Update current member's personal account access permission (allows others to use their personal accounts)
   * Members can only update their own permission
   */
  app.patch<{ Params: { householdId: string } }>(
    '/:householdId/members/me/personal-account-access',
    {
      schema: {
        description: 'Update current member\'s personal account access permission',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['allowPersonalAccountAccess'],
          properties: {
            allowPersonalAccountAccess: { type: 'boolean' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { householdId } = householdIdParamSchema.parse(request.params);
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      // Verify user is a member of the household
      await requireHouseholdMember(request, householdId);

      const input = updatePersonalAccountAccessSchema.parse(request.body);

      const member = await householdsService.updatePersonalAccountAccess(
        householdId,
        user.id,
        input.allowPersonalAccountAccess
      );

      return reply.send({
        success: true,
        data: member,
      });
    }
  );

  /**
   * PATCH /households/:householdId/members/me/shared-account-ids
   * Update current member's shared account IDs (which specific personal accounts to share)
   * Members can only update their own sharedAccountIds
   */
  app.patch<{ Params: { householdId: string } }>(
    '/:householdId/members/me/shared-account-ids',
    {
      schema: {
        description: 'Update current member\'s shared account IDs (specific personal accounts to share)',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['sharedAccountIds'],
          properties: {
            sharedAccountIds: {
              type: 'array',
              items: { type: 'string', format: 'uuid' },
            },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object', additionalProperties: true },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { householdId } = householdIdParamSchema.parse(request.params);
      await requireHouseholdMember(request, householdId);

      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      const input = updateSharedAccountIdsSchema.parse(request.body);

      const member = await householdsService.updateSharedAccountIds(
        householdId,
        user.id,
        input.sharedAccountIds
      );

      return reply.send({
        success: true,
        data: member,
      });
    }
  );

  /**
   * DELETE /households/:householdId/members/:memberId
   * Remove a member (OWNER only)
   */
  app.delete<{ Params: { householdId: string; memberId: string } }>(
    '/:householdId/members/:memberId',
    {
      schema: {
        description: 'Remove a member (OWNER only)',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId', 'memberId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
            memberId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          204: { type: 'null' },
        },
      },
    },
    async (request, reply) => {
      const { householdId, memberId } = memberIdParamSchema.parse(request.params);
      await requireOwner(request, householdId);

      await householdsService.removeMember(householdId, memberId);

      return reply.status(204).send();
    }
  );

  /**
   * POST /households/:householdId/transfer-ownership
   * Transfer ownership to another member (OWNER only)
   */
  app.post<{ Params: { householdId: string } }>(
    '/:householdId/transfer-ownership',
    {
      schema: {
        description: 'Transfer ownership to another member (OWNER only)',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['memberId'],
          properties: {
            memberId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { householdId } = householdIdParamSchema.parse(request.params);
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);
      await requireOwner(request, householdId);

      const { memberId } = memberIdParamSchema
        .pick({ memberId: true })
        .extend({ memberId: memberIdParamSchema.shape.memberId })
        .parse(request.body);

      await householdsService.transferOwnership(householdId, user.id, memberId);

      return reply.send({
        success: true,
        message: 'Ownership transferred successfully',
      });
    }
  );

  // ============================================================================
  // INVITES ROUTES
  // ============================================================================

  /**
   * GET /households/invites/pending
   * Get pending invites for the current user
   */
  app.get(
    '/invites/pending',
    {
      schema: {
        description: 'Get pending invites for the current user',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    householdId: { type: 'string', format: 'uuid' },
                    inviterId: { type: 'string', format: 'uuid' },
                    inviteeId: { type: 'string', format: 'uuid', nullable: true },
                    email: { type: 'string' },
                    role: { type: 'string', enum: ['OWNER', 'EDITOR', 'VIEWER'] },
                    status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'] },
                    expiresAt: { type: 'string', format: 'date-time' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    acceptedAt: { type: 'string', format: 'date-time', nullable: true },
                    rejectedAt: { type: 'string', format: 'date-time', nullable: true },
                    // Relations
                    household: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                      additionalProperties: true,
                    },
                    inviter: {
                      type: 'object',
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string' },
                        displayName: { type: 'string', nullable: true },
                      },
                      additionalProperties: true,
                    },
                  },
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      const invites = await householdsService.getPendingInvites(user.id);

      return reply.send({
        success: true,
        data: invites,
      });
    }
  );

  /**
   * POST /households/invites/:inviteId/accept
   * Accept a household invite
   */
  app.post<{ Params: { inviteId: string } }>(
    '/invites/:inviteId/accept',
    {
      schema: {
        description: 'Accept a household invite',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['inviteId'],
          properties: {
            inviteId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: { type: 'object' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { inviteId } = request.params;
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      const member = await householdsService.acceptInvite(inviteId, user.id);

      return reply.send({
        success: true,
        data: member,
      });
    }
  );

  /**
   * POST /households/invites/:inviteId/reject
   * Reject a household invite
   */
  app.post<{ Params: { inviteId: string } }>(
    '/invites/:inviteId/reject',
    {
      schema: {
        description: 'Reject a household invite',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['inviteId'],
          properties: {
            inviteId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { inviteId } = request.params;
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      await householdsService.rejectInvite(inviteId, user.id);

      return reply.send({
        success: true,
        message: 'Invite rejected successfully',
      });
    }
  );

  /**
   * GET /households/:householdId/invites
   * Get all invites for a household (OWNER only)
   */
  app.get<{ Params: { householdId: string } }>(
    '/:householdId/invites',
    {
      schema: {
        description: 'Get all invites for a household (OWNER only)',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['householdId'],
          properties: {
            householdId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    id: { type: 'string', format: 'uuid' },
                    householdId: { type: 'string', format: 'uuid' },
                    inviterId: { type: 'string', format: 'uuid' },
                    inviteeId: { type: 'string', format: 'uuid', nullable: true },
                    email: { type: 'string' },
                    role: { type: 'string', enum: ['OWNER', 'EDITOR', 'VIEWER'] },
                    status: { type: 'string', enum: ['PENDING', 'ACCEPTED', 'REJECTED', 'EXPIRED'] },
                    expiresAt: { type: 'string', format: 'date-time' },
                    createdAt: { type: 'string', format: 'date-time' },
                    updatedAt: { type: 'string', format: 'date-time' },
                    acceptedAt: { type: 'string', format: 'date-time', nullable: true },
                    rejectedAt: { type: 'string', format: 'date-time', nullable: true },
                    // Relations (for getHouseholdInvites - includes invitee)
                    household: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        name: { type: 'string' },
                        createdAt: { type: 'string', format: 'date-time' },
                      },
                      additionalProperties: true,
                    },
                    inviter: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string' },
                        displayName: { type: 'string', nullable: true },
                      },
                      additionalProperties: true,
                    },
                    invitee: {
                      type: 'object',
                      nullable: true,
                      properties: {
                        id: { type: 'string', format: 'uuid' },
                        email: { type: 'string' },
                        displayName: { type: 'string', nullable: true },
                      },
                      additionalProperties: true,
                    },
                  },
                  additionalProperties: true,
                },
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { householdId } = householdIdParamSchema.parse(request.params);
      await requireOwner(request, householdId);

      const invites = await householdsService.getHouseholdInvites(householdId);

      return reply.send({
        success: true,
        data: invites,
      });
    }
  );

  /**
   * DELETE /households/invites/:inviteId
   * Cancel an invite (OWNER only)
   */
  app.delete<{ Params: { inviteId: string } }>(
    '/invites/:inviteId',
    {
      schema: {
        description: 'Cancel an invite (OWNER only)',
        tags: ['Households'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['inviteId'],
          properties: {
            inviteId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              message: { type: 'string' },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { inviteId } = request.params;
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      await householdsService.cancelInvite(inviteId, user.id);

      return reply.send({
        success: true,
        message: 'Invite cancelled successfully',
      });
    }
  );
}






