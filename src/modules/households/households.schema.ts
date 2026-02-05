import { z } from 'zod';
import { HouseholdRole } from '../../shared/enums/index.js';

/**
 * Household role enum
 */
export const householdRoleEnum = z.nativeEnum(HouseholdRole);

/**
 * Create household request
 */
export const createHouseholdSchema = z.object({
  name: z.string().min(1).max(100).trim(),
});

export type CreateHouseholdInput = z.infer<typeof createHouseholdSchema>;

/**
 * Update household request
 */
export const updateHouseholdSchema = z.object({
  name: z.string().min(1).max(100).trim().optional(),
});

export type UpdateHouseholdInput = z.infer<typeof updateHouseholdSchema>;

/**
 * Invite member request
 */
export const inviteMemberSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(HouseholdRole).refine(
    (val) => val === HouseholdRole.EDITOR || val === HouseholdRole.VIEWER,
    'Role must be EDITOR or VIEWER'
  ).default(HouseholdRole.VIEWER),
});

export type InviteMemberInput = z.infer<typeof inviteMemberSchema>;

/**
 * Update member role request
 */
export const updateMemberRoleSchema = z.object({
  role: z.nativeEnum(HouseholdRole).refine(
    (val) => val === HouseholdRole.EDITOR || val === HouseholdRole.VIEWER,
    'Role must be EDITOR or VIEWER'
  ),
});

export type UpdateMemberRoleInput = z.infer<typeof updateMemberRoleSchema>;

/**
 * Household ID param
 */
export const householdIdParamSchema = z.object({
  householdId: z.string().uuid(),
});

export type HouseholdIdParam = z.infer<typeof householdIdParamSchema>;

/**
 * Member ID param
 */
export const memberIdParamSchema = z.object({
  householdId: z.string().uuid(),
  memberId: z.string().uuid(),
});

export type MemberIdParam = z.infer<typeof memberIdParamSchema>;

/**
 * Update member personal account access permission
 */
export const updatePersonalAccountAccessSchema = z.object({
  allowPersonalAccountAccess: z.boolean(),
});

export type UpdatePersonalAccountAccessInput = z.infer<typeof updatePersonalAccountAccessSchema>;

/**
 * Update shared account IDs request
 */
export const updateSharedAccountIdsSchema = z.object({
  sharedAccountIds: z.array(z.string().uuid()).default([]),
});

export type UpdateSharedAccountIdsInput = z.infer<typeof updateSharedAccountIdsSchema>;







