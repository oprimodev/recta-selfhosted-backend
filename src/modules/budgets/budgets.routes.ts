import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import {
  requireHouseholdMember,
  requireEditor,
  ensurePersonalHousehold,
} from '../../shared/middleware/authorization.middleware.js';
import {
  createBudgetSchema,
  updateBudgetSchema,
  budgetIdParamSchema,
  listBudgetsQuerySchema,
  budgetSummaryQuerySchema,
} from './budgets.schema.js';
import * as budgetsService from './budgets.service.js';

export async function budgetRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authMiddleware());

  /**
   * GET /budgets
   * List budgets for a household
   * If householdId is not provided, uses personal household automatically
   */
  app.get('/', {
    schema: {
      description: 'List budgets for a household',
      tags: ['Budgets'],
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
            data: { type: 'array', items: { type: 'object', additionalProperties: true } },
          },
        },
      },
    },
  }, async (request, reply) => {
    const query = listBudgetsQuerySchema.parse(request.query);
    
    // If no householdId provided, ensure user has a personal household
    const householdId = query.householdId || await ensurePersonalHousehold(request);
    
    await requireHouseholdMember(request, householdId);

    const budgets = await budgetsService.listBudgets({ ...query, householdId });

    return reply.send({
      success: true,
      data: budgets,
    });
  });

  /**
   * GET /budgets/summary
   * Get budget summary with spending vs limits
   * If householdId is not provided, uses personal household automatically
   */
  app.get('/summary', {
    schema: {
      description: 'Get budget summary with spending vs limits',
      tags: ['Budgets'],
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
            data: { type: 'object' },
          },
        },
      },
    },
  }, async (request, reply) => {
    const query = budgetSummaryQuerySchema.parse(request.query);
    
    // If no householdId provided, ensure user has a personal household
    const householdId = query.householdId || await ensurePersonalHousehold(request);
    
    await requireHouseholdMember(request, householdId);

    const summary = await budgetsService.getBudgetSummary({ ...query, householdId });

    return reply.send({
      success: true,
      data: summary,
    });
  });

  /**
   * POST /budgets
   * Create a new budget (EDITOR+)
   * If householdId is not provided, creates a personal household automatically
   */
  app.post('/', {
    schema: {
      description: 'Create a new budget (EDITOR+)',
      tags: ['Budgets'],
      security: [{ bearerAuth: [] }],
      body: {
        type: 'object',
        properties: {
          category: { type: 'string' },
          limit: { type: 'number' },
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
    const input = createBudgetSchema.parse(request.body);
    
    // If no householdId provided, ensure user has a personal household
    const householdId = input.householdId || await ensurePersonalHousehold(request);
    
    // Verify user has access to the household
    await requireEditor(request, householdId);

    const budget = await budgetsService.createBudget({
      ...input,
      householdId,
    });

    return reply.status(201).send({
      success: true,
      data: budget,
    });
  });

  /**
   * GET /budgets/:budgetId
   * Get budget details
   */
  app.get<{ Params: { budgetId: string } }>(
    '/:budgetId',
    {
      schema: {
        description: 'Get budget details',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['budgetId'],
          properties: {
            budgetId: { type: 'string', format: 'uuid' },
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
      const { budgetId } = budgetIdParamSchema.parse(request.params);
      const budget = await budgetsService.getBudget(budgetId);

      // Verify user has access to the household
      await requireHouseholdMember(request, budget.householdId);

      return reply.send({
        success: true,
        data: budget,
      });
    }
  );

  /**
   * PATCH /budgets/:budgetId
   * Update budget (EDITOR+)
   */
  app.patch<{ Params: { budgetId: string } }>(
    '/:budgetId',
    {
      schema: {
        description: 'Update budget (EDITOR+)',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['budgetId'],
          properties: {
            budgetId: { type: 'string', format: 'uuid' },
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
      const { budgetId } = budgetIdParamSchema.parse(request.params);
      const input = updateBudgetSchema.parse(request.body);

      // Get budget to verify household access
      const existingBudget = await budgetsService.getBudget(budgetId);
      await requireEditor(request, existingBudget.householdId);

      const budget = await budgetsService.updateBudget(budgetId, input);

      return reply.send({
        success: true,
        data: budget,
      });
    }
  );

  /**
   * DELETE /budgets/:budgetId
   * Delete budget (EDITOR+)
   */
  app.delete<{ Params: { budgetId: string } }>(
    '/:budgetId',
    {
      schema: {
        description: 'Delete budget (EDITOR+)',
        tags: ['Budgets'],
        security: [{ bearerAuth: [] }],
        params: {
          type: 'object',
          required: ['budgetId'],
          properties: {
            budgetId: { type: 'string', format: 'uuid' },
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
      const { budgetId } = budgetIdParamSchema.parse(request.params);

      // Get budget to verify household access
      const existingBudget = await budgetsService.getBudget(budgetId);
      await requireEditor(request, existingBudget.householdId);

      const result = await budgetsService.deleteBudget(budgetId);

      return reply.send({
        success: true,
        data: result,
      });
    }
  );
}

