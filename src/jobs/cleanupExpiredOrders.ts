import { prisma } from '../lib/prisma.js';
import { cancelExpiredOrdersForUser } from '../services/orderCleanupService.js';

const CLEANUP_INTERVAL_MS = 5 * 60 * 1000; // Every 5 minutes

/**
 * Start background cleanup of expired orders.
 * Finds all expired orders across all users and cancels them with stock restore.
 * Runs immediately on startup, then every 5 minutes.
 */
export function startExpiredOrderCleanup(): NodeJS.Timeout {
  async function run() {
    try {
      const expiredUserIds = await prisma.order.findMany({
        where: {
          status: { notIn: ['PICKED_UP', 'CANCELLED'] },
          pickupExpiresAt: { lt: new Date() },
        },
        select: { userId: true },
        distinct: ['userId'],
      });

      if (expiredUserIds.length === 0) return;

      let totalCancelled = 0;
      for (const { userId } of expiredUserIds) {
        const count = await cancelExpiredOrdersForUser(userId);
        totalCancelled += count;
      }

      console.log(`[Cleanup] Cancelled ${totalCancelled} expired orders for ${expiredUserIds.length} users`);
    } catch (err) {
      console.error('[Cleanup] Error:', (err as Error).message);
    }
  }

  // Run immediately on startup, then on interval
  run();
  return setInterval(run, CLEANUP_INTERVAL_MS);
}
