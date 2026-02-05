import { z } from 'zod';

/**
 * Create feedback request
 */
export const createFeedbackSchema = z.object({
  score: z.number().int().min(1).max(5),
  feedbackContent: z.string().max(5000).optional(),
});

export type CreateFeedbackInput = z.infer<typeof createFeedbackSchema>;
