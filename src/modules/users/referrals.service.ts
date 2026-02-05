import { prisma } from '../../shared/db/prisma.js';
import { isProduction } from '../../shared/config/env.js';
import { NotFoundError, BadRequestError } from '../../shared/errors/index.js';

/**
 * Process referral code when a new user signs up
 * Returns the referrer user ID if valid, null otherwise
 */
export async function processReferralCode(
  referralCode: string,
  newUserId: string
): Promise<string | null> {
  if (!referralCode || !referralCode.trim()) {
    if (!isProduction) console.log('[Referral] Empty referral code provided');
    return null;
  }

  const code = referralCode.trim().toUpperCase();
  if (!isProduction) console.log('[Referral] Processing referral code');

  // Find user by referral code
  const referrer = await prisma.user.findFirst({
    where: {
      referralCode: code,
    },
    select: {
      id: true,
    },
  });

  if (!referrer) {
    if (!isProduction) console.log('[Referral] Referral code not found');
    return null;
  }

  // Don't allow self-referral
  if (referrer.id === newUserId) {
    if (!isProduction) console.log('[Referral] Self-referral detected, skipping');
    return null;
  }

  // Check if referral already exists (prevent duplicates)
  const existingReferral = await prisma.referral.findUnique({
    where: {
      referredId: newUserId,
    },
  });

  if (existingReferral) {
    return existingReferral.referrerId;
  }

  try {
    const referral = await prisma.referral.create({
      data: {
        referrerId: referrer.id,
        referredId: newUserId,
        referralCode: code,
      },
    });
    if (!isProduction) console.log('[Referral] Referral record created:', referral.id);
    return referrer.id;
  } catch (error) {
    if (!isProduction) console.error('[Referral] Error creating referral record:', error);
    throw error;
  }
}

/**
 * Get referral count for a user
 */
export async function getReferralCount(userId: string): Promise<number> {
  const count = await prisma.referral.count({
    where: {
      referrerId: userId,
    },
  });

  return count;
}
