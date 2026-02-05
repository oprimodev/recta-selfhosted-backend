import { z } from 'zod';

/**
 * Notification type enum
 */
export enum NotificationType {
  HOUSEHOLD_INVITE = 'HOUSEHOLD_INVITE',
  BUDGET_ALERT = 'BUDGET_ALERT',
  TRANSACTION_REMINDER = 'TRANSACTION_REMINDER',
  GOAL_UPDATE = 'GOAL_UPDATE',
}

/**
 * Notification status enum
 */
export enum NotificationStatus {
  UNREAD = 'UNREAD',
  READ = 'READ',
  ARCHIVED = 'ARCHIVED',
}

/**
 * List notifications query parameters
 */
export const listNotificationsQuerySchema = z.object({
  status: z.enum(['UNREAD', 'READ', 'ARCHIVED']).optional(),
  type: z.nativeEnum(NotificationType).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  cursor: z.string().uuid().optional(),
});

export type ListNotificationsQuery = z.infer<typeof listNotificationsQuerySchema>;

/**
 * Mark notification as read/unread/archived
 */
export const updateNotificationStatusSchema = z.object({
  status: z.enum(['UNREAD', 'READ', 'ARCHIVED']),
});

export type UpdateNotificationStatusInput = z.infer<typeof updateNotificationStatusSchema>;

/**
 * Notification ID parameter
 */
export const notificationIdParamSchema = z.object({
  notificationId: z.string().uuid(),
});
