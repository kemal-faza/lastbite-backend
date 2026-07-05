import { describe, it, expect, beforeEach } from 'vitest';
import { prisma } from '../setup.js';
import { signAccessToken } from '../../src/lib/jwt.js';
import request from 'supertest';
import { createApp } from '../../src/app.js';
import { createReviewSchema, reviewQuerySchema } from '../../src/validators/reviews.js';

const app = createApp();

describe('Review Validation', () => {

  describe('createReviewSchema', () => {
    it('should accept valid review input', () => {
      const result = createReviewSchema.safeParse({
        rating: 4,
        comment: 'Enak banget, masih segar!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject rating below 1', () => {
      const result = createReviewSchema.safeParse({ rating: 0 });
      expect(result.success).toBe(false);
    });

    it('should reject rating above 5', () => {
      const result = createReviewSchema.safeParse({ rating: 6 });
      expect(result.success).toBe(false);
    });

    it('should accept rating of 3 as minimum valid', () => {
      const result = createReviewSchema.safeParse({ rating: 3 });
      expect(result.success).toBe(true);
    });

    it('should accept review without comment', () => {
      const result = createReviewSchema.safeParse({ rating: 5 });
      expect(result.success).toBe(true);
    });

    it('should accept review with imageUrl', () => {
      const result = createReviewSchema.safeParse({
        rating: 4,
        imageUrl: 'https://example.com/img.jpg',
      });
      expect(result.success).toBe(true);
    });

    it('should reject imageUrl that is not a valid URL', () => {
      const result = createReviewSchema.safeParse({
        rating: 4,
        imageUrl: 'not-a-url',
      });
      expect(result.success).toBe(false);
    });

    it('should reject comment longer than 1000 characters', () => {
      const result = createReviewSchema.safeParse({
        rating: 3,
        comment: 'x'.repeat(1001),
      });
      expect(result.success).toBe(false);
    });

    it('should accept comment at exactly 1000 characters', () => {
      const result = createReviewSchema.safeParse({
        rating: 3,
        comment: 'x'.repeat(1000),
      });
      expect(result.success).toBe(true);
    });
  });

  describe('reviewQuerySchema', () => {
    it('should accept empty query params with defaults', () => {
      const result = reviewQuerySchema.safeParse({});
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(1);
        expect(result.data.limit).toBe(10);
      }
    });

    it('should parse page and limit as numbers', () => {
      const result = reviewQuerySchema.safeParse({ page: '2', limit: '10' });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.page).toBe(2);
        expect(result.data.limit).toBe(10);
      }
    });

    it('should reject limit larger than 50', () => {
      const result = reviewQuerySchema.safeParse({ limit: '100' });
      expect(result.success).toBe(false);
    });
  });
});

describe('Review API', () => {
  let userAccessToken: string;
  let userId: string;
  let productId: string;
  let orderId: string;
  let pickupCode: string;

  beforeEach(async () => {
    await prisma.review.deleteMany();
    await prisma.orderItem.deleteMany();
    await prisma.order.deleteMany();
    await prisma.product.deleteMany();
    await prisma.user.deleteMany();

    const user = await prisma.user.create({
      data: {
        email: 'review-test@example.com',
        name: 'Review Tester',
        passwordHash: 'hash',
        role: 'FOOD_SAVER',
        isVerified: true,
      },
    });
    userId = user.id;
    userAccessToken = signAccessToken({ userId: user.id, email: user.email });

    const product = await prisma.product.create({
      data: {
        name: 'Test Nasi Goreng',
        category: 'meals',
        originalPrice: 25000,
        discountedPrice: 15000,
        stock: 5,
        storeName: 'Warung Test',
        expiresAt: new Date(Date.now() + 86400000),
      },
    });
    productId = product.id;
    pickupCode = 'LAST-TEST';

    const order = await prisma.order.create({
      data: {
        userId: user.id,
        storeName: 'Warung Test',
        status: 'PICKED_UP',
        pickupCode,
        pickupExpiresAt: new Date(Date.now() + 7200000),
        totalAmount: 15000,
        savingAmount: 10000,
        buyerName: 'Reviewer',
        buyerPhone: '08123456789',
        items: {
          create: {
            productId: product.id,
            name: product.name,
            storeName: 'Warung Test',
            price: 15000,
            originalPrice: 25000,
            quantity: 1,
          },
        },
      },
    });
    orderId = order.id;
  });

  describe('POST /reviews/orders/:id/review', () => {
    it('should create a review for a picked-up order', async () => {
      const res = await request(app)
        .post(`/reviews/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ rating: 4, comment: 'Enak banget!' });

      expect(res.status).toBe(201);
      expect(res.body.review).toBeDefined();
      expect(res.body.review.rating).toBe(4);
      expect(res.body.review.comment).toBe('Enak banget!');
      expect(res.body.review.userId).toBe(userId);
      expect(res.body.review.orderId).toBe(orderId);
    });

    it('should reject duplicate review for same order', async () => {
      await request(app)
        .post(`/reviews/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ rating: 4 })
        .expect(201);

      const res = await request(app)
        .post(`/reviews/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ rating: 3 });

      expect(res.status).toBe(409);
      expect(res.body.code).toBe('DUPLICATE_REVIEW');
    });

    it('should reject review for non-picked-up order', async () => {
      const pendingOrder = await prisma.order.create({
        data: {
          userId,
          storeName: 'Warung Test',
          status: 'PENDING',
          pickupCode: 'LAST-PEND',
          pickupExpiresAt: new Date(Date.now() + 7200000),
          totalAmount: 15000,
          savingAmount: 10000,
          buyerName: 'Pending Reviewer',
          buyerPhone: '08123456788',
        },
      });

      const res = await request(app)
        .post(`/reviews/orders/${pendingOrder.id}/review`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ rating: 3 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('ORDER_NOT_PICKED_UP');
    });

    it('should require authentication', async () => {
      const res = await request(app)
        .post(`/reviews/orders/${orderId}/review`)
        .send({ rating: 3 });

      expect(res.status).toBe(401);
    });

    it('should return 404 for non-existent order', async () => {
      const fakeId = '00000000-0000-0000-0000-000000000000';
      const res = await request(app)
        .post(`/reviews/orders/${fakeId}/review`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ rating: 3 });

      expect(res.status).toBe(404);
      expect(res.body.code).toBe('ORDER_NOT_FOUND');
    });

    it('should reject invalid UUID in route param', async () => {
      const res = await request(app)
        .post('/reviews/orders/not-a-uuid/review')
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ rating: 3 });

      expect(res.status).toBe(400);
      expect(res.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /products/:id/reviews', () => {
    it('should return empty array when no reviews', async () => {
      const res = await request(app)
        .get(`/reviews/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reviews).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
      expect(res.body.avgRating).toBeNull();
      expect(res.body.ratingDistribution).toEqual({ 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 });
    });

    it('should return reviews with pagination and avg rating', async () => {
      await request(app)
        .post(`/reviews/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ rating: 4, comment: 'OK' })
        .expect(201);

      const res = await request(app)
        .get(`/reviews/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.reviews[0].rating).toBe(4);
      expect(res.body.reviews[0].comment).toBe('OK');
      expect(res.body.avgRating).toBe(4);
      expect(res.body.totalReviews).toBe(1);
      expect(res.body.pagination.total).toBe(1);
    });

    it('should compute rating distribution correctly', async () => {
      await request(app)
        .post(`/reviews/orders/${orderId}/review`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ rating: 4 })
        .expect(201);

      const user2 = await prisma.user.create({
        data: {
          email: 'reviewer2@example.com',
          name: 'Reviewer 2',
          passwordHash: 'hash',
          role: 'FOOD_SAVER',
          isVerified: true,
        },
      });
      const token2 = signAccessToken({ userId: user2.id, email: user2.email });
      const order2 = await prisma.order.create({
        data: {
          userId: user2.id,
          storeName: 'Warung Test',
          status: 'PICKED_UP',
          pickupCode: 'LAST-RVW2',
          pickupExpiresAt: new Date(Date.now() + 7200000),
          totalAmount: 15000,
          savingAmount: 10000,
          buyerName: 'Reviewer 2',
          buyerPhone: '08987654321',
          items: {
            create: {
              productId,
              name: 'Test Nasi Goreng',
              storeName: 'Warung Test',
              price: 15000,
              originalPrice: 25000,
              quantity: 1,
            },
          },
        },
      });

      await request(app)
        .post(`/reviews/orders/${order2.id}/review`)
        .set('Authorization', `Bearer ${token2}`)
        .send({ rating: 2 })
        .expect(201);

      const res = await request(app)
        .get(`/reviews/products/${productId}/reviews`)
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.avgRating).toBe(3);
      expect(res.body.totalReviews).toBe(2);
      expect(res.body.ratingDistribution).toEqual({ 1: 0, 2: 1, 3: 0, 4: 1, 5: 0 });
    });
  });

  describe('GET /mitra/:id/reviews', () => {
    it('should return empty when mitra has no products', async () => {
      const mitraUser = await prisma.user.create({
        data: {
          email: 'mitra-reviews@example.com',
          name: 'Mitra Reviews',
          passwordHash: 'hash',
          role: 'MITRA',
          isVerified: true,
        },
      });

      const res = await request(app)
        .get(`/reviews/mitra/${mitraUser.id}/reviews`)
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reviews).toEqual([]);
      expect(res.body.pagination.total).toBe(0);
    });

    it('should return reviews for mitras products', async () => {
      // Create a mitra with a product
      const mitraUser = await prisma.user.create({
        data: {
          email: 'mitra-with-reviews@example.com',
          name: 'Mitra With Reviews',
          passwordHash: 'hash',
          role: 'MITRA',
          isVerified: true,
        },
      });

      const mitraProduct = await prisma.product.create({
        data: {
          name: 'Mitra Product',
          category: 'bakery',
          originalPrice: 30000,
          discountedPrice: 20000,
          stock: 10,
          storeName: 'Toko Mitra',
          mitraId: mitraUser.id,
          expiresAt: new Date(Date.now() + 86400000),
        },
      });

      // Order this product and review it
      const mitraOrder = await prisma.order.create({
        data: {
          userId,
          storeName: 'Toko Mitra',
          status: 'PICKED_UP',
          pickupCode: 'LAST-MITRA',
          pickupExpiresAt: new Date(Date.now() + 7200000),
          totalAmount: 20000,
          savingAmount: 10000,
          buyerName: 'Reviewer',
          buyerPhone: '08123456789',
          items: {
            create: {
              productId: mitraProduct.id,
              name: mitraProduct.name,
              storeName: 'Toko Mitra',
              price: 20000,
              originalPrice: 30000,
              quantity: 1,
            },
          },
        },
      });

      await request(app)
        .post(`/reviews/orders/${mitraOrder.id}/review`)
        .set('Authorization', `Bearer ${userAccessToken}`)
        .send({ rating: 5, comment: 'Produk mitra bagus!' })
        .expect(201);

      const res = await request(app)
        .get(`/reviews/mitra/${mitraUser.id}/reviews`)
        .set('Authorization', `Bearer ${userAccessToken}`);

      expect(res.status).toBe(200);
      expect(res.body.reviews).toHaveLength(1);
      expect(res.body.reviews[0].rating).toBe(5);
      expect(res.body.reviews[0].comment).toBe('Produk mitra bagus!');
      expect(res.body.reviews[0].product).toBeDefined();
      expect(res.body.reviews[0].product.id).toBe(mitraProduct.id);
      expect(res.body.reviews[0].product.name).toBe('Mitra Product');
      expect(res.body.totalReviews).toBe(1);
      expect(res.body.avgRating).toBe(5);
    });
  });
});
