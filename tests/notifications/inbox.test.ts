import { describe, it, expect, beforeEach } from 'vitest';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';

const app = createApp();

describe('GET /notifications', () => {
  let accessToken: string;
  let userId: string;
  let otherToken: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `notif-test-${Date.now()}@test.com`,
        name: 'Notif Tester',
        passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHlbDqsOeABC123XYZ4567890abcdefghij',
        isVerified: true,
      },
    });
    userId = user.id;
    accessToken = signAccessToken({ userId: user.id, email: user.email });

    const other = await prisma.user.create({
      data: {
        email: `other-notif-${Date.now()}@test.com`,
        name: 'Other',
        passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHlbDqsOeABC123XYZ4567890abcdefghij',
        isVerified: true,
      },
    });
    otherToken = signAccessToken({ userId: other.id, email: other.email });

    await prisma.notification.createMany({
      data: [
        { userId, title: 'Pesanan Diproses', body: 'Pesanan sedang diproses', type: 'order_status' },
        { userId, title: 'Stok Tersedia', body: 'Produk tersedia kembali', type: 'stock_alert' },
      ],
    });

    await prisma.notification.create({
      data: { userId: other.id, title: 'Other', body: 'Isolated', type: 'general' },
    });
  });

  it('should return notifications for authenticated user', async () => {
    const res = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.notifications).toHaveLength(2);
    expect(res.body.unreadCount).toBe(2);
  });

  it('should filter by unread', async () => {
    const allNotifs = await prisma.notification.findMany({ where: { userId } });
    await prisma.notification.update({ where: { id: allNotifs[0].id }, data: { isRead: true } });

    const res = await request(app)
      .get('/notifications?unread=true')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.unreadCount).toBe(1);
  });

  it('should not leak other users notifications', async () => {
    const res = await request(app)
      .get('/notifications')
      .set('Authorization', `Bearer ${otherToken}`);
    expect(res.body.notifications).toHaveLength(1);
    expect(res.body.notifications[0].title).toBe('Other');
  });

  it('should require auth', async () => {
    const res = await request(app).get('/notifications');
    expect(res.status).toBe(401);
  });
});

describe('PATCH /notifications/:id/read', () => {
  let accessToken: string;
  let notifId: string;

  beforeEach(async () => {
    const user = await prisma.user.create({
      data: {
        email: `markread-${Date.now()}@test.com`,
        name: 'MarkRead',
        passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHlbDqsOeABC123XYZ4567890abcdefghij',
        isVerified: true,
      },
    });
    accessToken = signAccessToken({ userId: user.id, email: user.email });

    const notif = await prisma.notification.create({
      data: { userId: user.id, title: 'Test', body: 'Body', type: 'general' },
    });
    notifId = notif.id;
  });

  it('should mark notification as read', async () => {
    const res = await request(app)
      .patch(`/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.notification.isRead).toBe(true);
  });

  it('should return 404 for non-existent notification', async () => {
    const res = await request(app)
      .patch('/notifications/00000000-0000-0000-0000-000000000000/read')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(res.status).toBe(404);
  });

  it('should return 404 for other users notification', async () => {
    const other = await prisma.user.create({
      data: {
        email: `other-markread-${Date.now()}@test.com`,
        name: 'Other',
        passwordHash: '$2a$12$LJ3m4ys3Lk0TSwHlbDqsOeABC123XYZ4567890abcdefghij',
        isVerified: true,
      },
    });
    const otherTokenLocal = signAccessToken({ userId: other.id, email: other.email });

    const res = await request(app)
      .patch(`/notifications/${notifId}/read`)
      .set('Authorization', `Bearer ${otherTokenLocal}`);
    expect(res.status).toBe(404);
  });
});
