import type { FastifyInstance } from 'fastify';
import { authMiddleware } from '../../shared/middleware/auth.middleware.js';
import {
  requireHouseholdMember,
  ensurePersonalHousehold,
} from '../../shared/middleware/authorization.middleware.js';
import { dashboardOverviewQuerySchema } from './dashboard.schema.js';
import * as dashboardService from './dashboard.service.js';

export async function dashboardRoutes(app: FastifyInstance) {
  // All routes require authentication
  app.addHook('preHandler', authMiddleware());

  /**
   * GET /dashboard/overview
   * Get complete dashboard overview with all aggregated data
   */
  app.get('/overview', {
    schema: {
      description: 'Get complete dashboard overview with all aggregated data',
      tags: ['Dashboard'],
      security: [{ bearerAuth: [] }],
      querystring: {
        type: 'object',
        required: ['month'],
        properties: {
          householdId: { type: 'string', format: 'uuid' },
          month: { type: 'string', pattern: '^\\d{4}-\\d{2}$' },
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
                summary: {
                  type: 'object',
                  properties: {
                    totalIncome: { type: 'number' },
                    totalExpense: { type: 'number' },
                    balance: { type: 'number' },
                  },
                },
                trend: {
                  type: 'object',
                  properties: {
                    incomeChange: { type: 'number' },
                    expenseChange: { type: 'number' },
                    balanceChange: { type: 'number' },
                    incomeTrend: { type: 'string' },
                    expenseTrend: { type: 'string' },
                  },
                },
                forecast: {
                  type: 'object',
                  properties: {
                    predictedIncome: { type: 'number' },
                    predictedExpense: { type: 'number' },
                    predictedBalance: { type: 'number' },
                  },
                },
                categoryBreakdown: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      name: { type: 'string' },
                      income: { type: 'number' },
                      expense: { type: 'number' },
                      total: { type: 'number' },
                    },
                  },
                },
                monthlyComparison: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      month: { type: 'string' },
                      income: { type: 'number' },
                      expense: { type: 'number' },
                    },
                  },
                },
                balanceEvolution: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      month: { type: 'string' },
                      balance: { type: 'number' },
                    },
                  },
                },
                fixedVsVariable: {
                  type: 'object',
                  properties: {
                    fixed: { type: 'number' },
                    variable: { type: 'number' },
                    fixedPercentage: { type: 'number' },
                    variablePercentage: { type: 'number' },
                  },
                },
                budgetVsRealized: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      category: { type: 'string' },
                      type: { type: 'string' },
                      budgeted: { type: 'number' },
                      spent: { type: 'number' },
                      remaining: { type: 'number' },
                      percentage: { type: 'number' },
                      status: { type: 'string' },
                    },
                  },
                },
                heatmap: {
                  type: 'object',
                  properties: {
                    month: { type: 'string' },
                    data: {
                      type: 'array',
                      items: {
                        type: 'object',
                        properties: {
                          day: { type: 'number' },
                          amount: { type: 'number' },
                        },
                      },
                    },
                    total: { type: 'number' },
                    daysInMonth: { type: 'number' },
                  },
                },
              },
            },
          },
        },
      },
    },
  }, async (request, reply) => {
    const query = dashboardOverviewQuerySchema.parse(request.query);

    // If no householdId provided, ensure user has a personal household
    const householdId = query.householdId || await ensurePersonalHousehold(request);

    await requireHouseholdMember(request, householdId);

    const data = await dashboardService.getDashboardOverview({
      ...query,
      householdId,
    });

    return reply.send({
      success: true,
      data,
    });
  });
}
