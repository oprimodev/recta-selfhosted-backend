import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import {
  requireHouseholdMember,
  requireEditor,
  ensurePersonalHousehold,
} from '../../shared/middleware/authorization.middleware.js';
import {
  createRecurringTransactionSchema,
  updateRecurringTransactionSchema,
  executeRecurringTransactionSchema,
  recurringTransactionIdParamSchema,
  listRecurringTransactionsQuerySchema,
} from './recurring-transactions.schema.js';
import * as recurringTransactionsService from './recurring-transactions.service.js';

export async function recurringTransactionRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authMiddleware());

  /**
   * GET /recurring-transactions
   * List recurring transactions for a household
   * If householdId is not provided, uses personal household automatically
   */
  app.get('/', {
    schema: {
      description: 'List recurring transactions for a household',
      tags: ['Recurring Transactions'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
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
              items: { type: 'object', additionalProperties: true } 
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const query = listRecurringTransactionsQuerySchema.parse(request.query);
    
    // If no householdId provided, ensure user has a personal household
    const householdId = query.householdId || await ensurePersonalHousehold(request);
    
    await requireHouseholdMember(request, householdId);

    const recurring = await recurringTransactionsService.listRecurringTransactions(
      { ...query, householdId }
    );

    return reply.send({
      success: true,
      data: recurring,
    });
  });

  /**
   * GET /recurring-transactions/due
   * Get recurring transactions that are due (nextRunAt <= today)
   * If householdId is not provided, uses personal household automatically
   */
  app.get('/due', {
    schema: {
      description: 'Get recurring transactions that are due',
      tags: ['Recurring Transactions'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
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
              items: { type: 'object', additionalProperties: true } 
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const query = listRecurringTransactionsQuerySchema
      .pick({ householdId: true })
      .parse(request.query);
    
    // If no householdId provided, ensure user has a personal household
    const householdId = query.householdId || await ensurePersonalHousehold(request);
    
    await requireHouseholdMember(request, householdId);

    const due = await recurringTransactionsService.getDueRecurringTransactions(
      householdId
    );

    return reply.send({
      success: true,
      data: due,
    });
  });

  /**
   * POST /recurring-transactions
   * Create a new recurring transaction (EDITOR+)
   * If householdId is not provided, creates a personal household automatically
   */
  app.post('/', {
    schema: {
      description: 'Create a new recurring transaction (EDITOR+)',
      tags: ['Recurring Transactions'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          amount: { type: 'number' },
          frequency: { type: 'string' },
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
    const input = createRecurringTransactionSchema.parse(request.body);
    
    // If no householdId provided, ensure user has a personal household
    const householdId = input.householdId || await ensurePersonalHousehold(request);
    
    // Verify user has access to the household
    await requireEditor(request, householdId);

    const recurring = await recurringTransactionsService.createRecurringTransaction({
      ...input,
      householdId,
    });

    return reply.status(201).send({
      success: true,
      data: recurring,
    });
  });

  /**
   * GET /recurring-transactions/:recurringId
   * Get recurring transaction details
   */
  app.get<{ Params: { recurringId: string } }>(
    '/:recurringId',
    {
      schema: {
        description: 'Get recurring transaction details',
        tags: ['Recurring Transactions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['recurringId'],
          properties: {
            recurringId: { type: 'string', format: 'uuid' },
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
      const { recurringId } = recurringTransactionIdParamSchema.parse(
        request.params
      );
      const recurring =
        await recurringTransactionsService.getRecurringTransaction(recurringId);

      // Verify user has access to the household
      await requireHouseholdMember(request, recurring.householdId);

      return reply.send({
        success: true,
        data: recurring,
      });
    }
  );

  /**
   * PATCH /recurring-transactions/:recurringId
   * Update recurring transaction (EDITOR+)
   */
  app.patch<{ Params: { recurringId: string } }>(
    '/:recurringId',
    {
      schema: {
        description: 'Update recurring transaction (EDITOR+)',
        tags: ['Recurring Transactions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['recurringId'],
          properties: {
            recurringId: { type: 'string', format: 'uuid' },
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
      const { recurringId } = recurringTransactionIdParamSchema.parse(
        request.params
      );
      const input = updateRecurringTransactionSchema.parse(request.body);

      // Get recurring transaction to verify household access
      const existing =
        await recurringTransactionsService.getRecurringTransaction(recurringId);
      await requireEditor(request, existing.householdId);

      const recurring = await recurringTransactionsService.updateRecurringTransaction(
        recurringId,
        existing.householdId,
        input
      );

      return reply.send({
        success: true,
        data: recurring,
      });
    }
  );

  /**
   * DELETE /recurring-transactions/:recurringId
   * Delete recurring transaction (EDITOR+)
   */
  app.delete<{ Params: { recurringId: string } }>(
    '/:recurringId',
    {
      schema: {
        description: 'Delete recurring transaction (EDITOR+)',
        tags: ['Recurring Transactions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['recurringId'],
          properties: {
            recurringId: { type: 'string', format: 'uuid' },
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
      const { recurringId } = recurringTransactionIdParamSchema.parse(
        request.params
      );

      // Get recurring transaction to verify household access
      const existing =
        await recurringTransactionsService.getRecurringTransaction(recurringId);
      await requireEditor(request, existing.householdId);

      const result = await recurringTransactionsService.deleteRecurringTransaction(
        recurringId,
        existing.householdId
      );

      return reply.send({
        success: true,
        data: result,
      });
    }
  );

  /**
   * POST /recurring-transactions/:recurringId/execute
   * Execute a recurring transaction (create actual transaction and update next run date) (EDITOR+)
   */
  app.post<{ Params: { recurringId: string } }>(
    '/:recurringId/execute',
    {
      schema: {
        description: 'Execute a recurring transaction (create actual transaction and update next run date) (EDITOR+)',
        tags: ['Recurring Transactions'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['recurringId'],
          properties: {
            recurringId: { type: 'string', format: 'uuid' },
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
      const { recurringId } = recurringTransactionIdParamSchema.parse(
        request.params
      );
      const input = executeRecurringTransactionSchema.parse(request.body);

      // Get recurring transaction to verify household access
      const existing =
        await recurringTransactionsService.getRecurringTransaction(recurringId);
      await requireEditor(request, existing.householdId);

      const result = await recurringTransactionsService.executeRecurringTransaction(
        recurringId,
        existing.householdId,
        input
      );

      return reply.send({
        success: true,
        data: result,
      });
    }
  );
}

