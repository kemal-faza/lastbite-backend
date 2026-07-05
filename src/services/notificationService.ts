import { prisma } from '../lib/prisma.js';
import { sendPush } from '../lib/fcm.js';

export class NotificationError extends Error {
  constructor(message: string, public code: string) {
    super(message);
    this.name = 'NotificationError';
  }
}

export interface CreateNotificationInput {
  userId: string;
  title: string;
  body: string;
  type: string;
  data?: Record<string, string>;
}

export async function createNotification(input: CreateNotificationInput) {
  return prisma.notification.create({
    data: {
      userId: input.userId,
      title: input.title,
      body: input.body,
      type: input.type,
      data: input.data || {},
    },
  });
}

/**
 * Send FCM push notification to all devices registered for a user.
 * Silently handles errors and empty device lists so callers don't need try/catch.
 */
export async function sendNotificationPush(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<void> {
  try {
    const devices = await prisma.deviceToken.findMany({
      where: { userId },
      select: { token: true },
    });

    if (devices.length === 0) return;

    await sendPush(
      devices.map((d) => d.token),
      { title, body, data }
    );
  } catch (err) {
    // Push notification failure should not break the main flow
    console.error('[Notification] Failed to send push:', err);
  }
}

export async function getNotifications(
  userId: string,
  options?: { unreadOnly?: boolean; limit?: number; offset?: number }
) {
  const where: any = { userId };
  if (options?.unreadOnly) where.isRead = false;

  const [notifications, unreadCount] = await Promise.all([
    prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: options?.limit || 50,
      skip: options?.offset || 0,
    }),
    prisma.notification.count({ where: { userId, isRead: false } }),
  ]);

  return { notifications, unreadCount };
}

export async function markAsRead(userId: string, notificationId: string) {
  const notification = await prisma.notification.findFirst({
    where: { id: notificationId, userId },
  });

  if (!notification) {
    throw new NotificationError('Notifikasi tidak ditemukan', 'NOTIFICATION_NOT_FOUND');
  }

  return prisma.notification.update({
    where: { id: notificationId },
    data: { isRead: true },
  });
}
