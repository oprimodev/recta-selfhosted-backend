import type { FastifyInstance } from 'fastify';
import { authMiddleware, getAuthUser } from '../../shared/middleware/auth.middleware.js';
import { getUserByFirebaseUid } from '../../shared/middleware/authorization.middleware.js';
import {
  listNotificationsQuerySchema,
  updateNotificationStatusSchema,
  notificationIdParamSchema,
} from './notifications.schema.js';
import * as notificationsService from './notifications.service.js';

export async function notificationRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authMiddleware());

  /**
   * GET /notifications
   * List all notifications for the current user
   */
  app.get('/', {
    schema: {
      description: 'List all notifications for the current user',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        properties: {
          status: { type: 'string', enum: ['UNREAD', 'READ', 'ARCHIVED'] },
          type: { type: 'string', enum: ['HOUSEHOLD_INVITE', 'BUDGET_ALERT', 'TRANSACTION_REMINDER', 'GOAL_UPDATE'] },
          limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
          cursor: { type: 'string', format: 'uuid' },
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
                  userId: { type: 'string', format: 'uuid' },
                  type: { type: 'string', enum: ['HOUSEHOLD_INVITE', 'BUDGET_ALERT', 'TRANSACTION_REMINDER', 'GOAL_UPDATE'] },
                  status: { type: 'string', enum: ['UNREAD', 'READ', 'ARCHIVED'] },
                  title: { type: 'string' },
                  message: { type: 'string' },
                  metadata: { type: 'object' },
                  deepLink: { type: 'string', nullable: true },
                  readAt: { type: 'string', format: 'date-time', nullable: true },
                  archivedAt: { type: 'string', format: 'date-time', nullable: true },
                  createdAt: { type: 'string', format: 'date-time' },
                  updatedAt: { type: 'string', format: 'date-time' },
                  expiresAt: { type: 'string', format: 'date-time', nullable: true },
                },
                additionalProperties: true,
              },
            },
            pagination: {
              type: 'object',
              properties: {
                hasMore: { type: 'boolean' },
                nextCursor: { type: 'string', format: 'uuid', nullable: true },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const user = await getUserByFirebaseUid(authUser.uid, authUser.email);
    const query = listNotificationsQuerySchema.parse(request.query);

    const result = await notificationsService.getUserNotifications(user.id, query);

    return reply.send({
      success: true,
      data: result.items,
      pagination: result.pagination,
    });
  });

  /**
   * GET /notifications/unread/count
   * Get unread notification count
   */
  app.get('/unread/count', {
    schema: {
      description: 'Get unread notification count for the current user',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                count: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

    const count = await notificationsService.getUnreadNotificationCount(user.id);

    return reply.send({
      success: true,
      data: { count },
    });
  });

  /**
   * GET /notifications/:notificationId
   * Get a single notification by ID
   */
  app.get<{ Params: { notificationId: string } }>('/:notificationId', {
    schema: {
      description: 'Get a single notification by ID',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      params: {
        type: 'object',
        required: ['notificationId'],
        properties: {
          notificationId: { type: 'string', format: 'uuid' },
        },
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
                userId: { type: 'string', format: 'uuid' },
                type: { type: 'string', enum: ['HOUSEHOLD_INVITE', 'BUDGET_ALERT', 'TRANSACTION_REMINDER', 'GOAL_UPDATE'] },
                status: { type: 'string', enum: ['UNREAD', 'READ', 'ARCHIVED'] },
                title: { type: 'string' },
                message: { type: 'string' },
                metadata: { type: 'object' },
                deepLink: { type: 'string', nullable: true },
                readAt: { type: 'string', format: 'date-time', nullable: true },
                archivedAt: { type: 'string', format: 'date-time', nullable: true },
                createdAt: { type: 'string', format: 'date-time' },
                updatedAt: { type: 'string', format: 'date-time' },
                expiresAt: { type: 'string', format: 'date-time', nullable: true },
              },
              additionalProperties: true,
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const { notificationId } = notificationIdParamSchema.parse(request.params);
    const authUser = getAuthUser(request);
    const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

    const notification = await notificationsService.getNotification(notificationId, user.id);

    return reply.send({
      success: true,
      data: notification,
    });
  });

  /**
   * PATCH /notifications/:notificationId/status
   * Update notification status (read/unread/archived)
   */
  app.patch<{ Params: { notificationId: string } }>(
    '/:notificationId/status',
    {
      schema: {
        description: 'Update notification status',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['notificationId'],
          properties: {
            notificationId: { type: 'string', format: 'uuid' },
          },
        },
        body: {
          type: 'object',
          required: ['status'],
          properties: {
            status: { type: 'string', enum: ['UNREAD', 'READ', 'ARCHIVED'] },
          },
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
                  status: { type: 'string', enum: ['UNREAD', 'READ', 'ARCHIVED'] },
                },
                additionalProperties: true,
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { notificationId } = notificationIdParamSchema.parse(request.params);
      const input = updateNotificationStatusSchema.parse(request.body);
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      const notification = await notificationsService.updateNotificationStatus(notificationId, user.id, input);

      return reply.send({
        success: true,
        data: notification,
      });
    }
  );

  /**
   * POST /notifications/:notificationId/read
   * Mark notification as read (convenience endpoint)
   */
  app.post<{ Params: { notificationId: string } }>(
    '/:notificationId/read',
    {
      schema: {
        description: 'Mark notification as read',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['notificationId'],
          properties: {
            notificationId: { type: 'string', format: 'uuid' },
          },
        },
        response: {
          200: {
            type: 'object',
            properties: {
              success: { type: 'boolean' },
              data: {
                type: 'object',
                additionalProperties: true,
              },
            },
          },
        },
      },
    },
    async (request, reply) => {
      const { notificationId } = notificationIdParamSchema.parse(request.params);
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      const notification = await notificationsService.markNotificationAsRead(notificationId, user.id);

      return reply.send({
        success: true,
        data: notification,
      });
    }
  );

  /**
   * POST /notifications/read-all
   * Mark all notifications as read
   */
  app.post('/read-all', {
    schema: {
      description: 'Mark all notifications as read for the current user',
      tags: ['Notifications'],
      security: [{ bearerAuth: [] }],
      response: {
        200: {
          type: 'object',
          properties: {
            success: { type: 'boolean' },
            data: {
              type: 'object',
              properties: {
                count: { type: 'number' },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const authUser = getAuthUser(request);
    const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

    const result = await notificationsService.markAllNotificationsAsRead(user.id);

    return reply.send({
      success: true,
      data: { count: result.count },
    });
  });

  /**
   * DELETE /notifications/:notificationId
   * Delete (archive) a notification
   */
  app.delete<{ Params: { notificationId: string } }>(
    '/:notificationId',
    {
      schema: {
        description: 'Delete (archive) a notification',
        tags: ['Notifications'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['notificationId'],
          properties: {
            notificationId: { type: 'string', format: 'uuid' },
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
      const { notificationId } = notificationIdParamSchema.parse(request.params);
      const authUser = getAuthUser(request);
      const user = await getUserByFirebaseUid(authUser.uid, authUser.email);

      await notificationsService.deleteNotification(notificationId, user.id);

      return reply.send({
        success: true,
        message: 'Notification archived successfully',
      });
    }
  );
}
