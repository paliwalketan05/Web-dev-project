import { AttemptStatus } from '@prisma/client';
import { prisma } from '../utils/prisma';
import { submitAttempt } from '../services/attempt';

const GRACE_PERIOD_MS = 5000;

export const expireOverdueAttempts = async () => {
  const cutoffTime = new Date(Date.now() - GRACE_PERIOD_MS);

  try {
    const expiredAttempts = await prisma.attempt.findMany({
      where: {
        status: AttemptStatus.IN_PROGRESS,
        expiresAt: { lt: cutoffTime },
      },
      select: { id: true },
    });

    if (expiredAttempts.length > 0) {
      console.log(`[ExpireJob] Found ${expiredAttempts.length} expired attempts to finalize.`);
      for (const attempt of expiredAttempts) {
        try {
          await submitAttempt(attempt.id, undefined, true);
          console.log(`[ExpireJob] Successfully auto-submitted attempt ${attempt.id}`);
        } catch (err) {
          console.error(`[ExpireJob] Failed to auto-submit attempt ${attempt.id}:`, err);
        }
      }
    }
  } catch (error) {
    console.error('[ExpireJob] Error querying expired attempts:', error);
  }
};

export const startExpireAttemptsJob = (intervalMs = 60000) => {
  const interval = setInterval(expireOverdueAttempts, intervalMs);
  return () => clearInterval(interval);
};
