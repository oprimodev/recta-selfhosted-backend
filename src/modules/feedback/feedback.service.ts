import { prisma } from '../../shared/db/prisma.js';
import type { CreateFeedbackInput } from './feedback.schema.js';

/**
 * Create a new user feedback
 */
export async function createFeedback(input: CreateFeedbackInput, email: string) {
  const feedback = await prisma.userFeedback.create({
    data: {
      email,
      score: input.score,
      feedbackContent: input.feedbackContent || null,
    },
  });

  return feedback;
}
