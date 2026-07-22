import {
  PrismaClient,
  Category,
  OrderStatus,
} from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const SALT_ROUNDS = 12;
interface MitraUser {
  id: string;
  email: string;
  store: string;
}

const MITRA_SEEDS = [
  { email: "dapurbuani@lastbite.id", name: "Dapur Bu Ani", store: "Dapur Bu Ani" },
  { email: "rmpadang@lastbite.id", name: "RM Padang Suharti", store: "RM Padang Suharti" },
  { email: "bakeria@lastbite.id", name: "Bakeria", store: "Bakeria" },
  { email: "kopiaroma@lastbite.id", name: "Warung Kopi Aroma", store: "Warung Kopi Aroma" },
  { email: "mieayam@lastbite.id", name: "Mie Ayam Mang Udin", store: "Mie Ayam Mang Udin" },
] as const;

interface MitraProfileSeed {
  email: (typeof MITRA_SEEDS)[number]["email"];
  storeName: string;
  storeDescription: string;
  storeAddress: string;
  storeLat: number;
  storeLng: number;
}

const MITRA_PROFILE_SEEDS: MitraProfileSeed[] = [
  {
    email: "dapurbuani@lastbite.id",
    storeName: "Dapur Bu Ani",
    storeDescription:
      "Katering rumahan dengan menu tradisional khas Jawa. Ayam preksu dan nasi goreng kampung jadi andalan!",
    storeAddress: "Jl. Pandanaran No. 12, Semarang",
    storeLat: -6.9875,
    storeLng: 110.4216,
  },
  {
    email: "rmpadang@lastbite.id",
    storeName: "RM Padang Suharti",
    storeDescription:
      "Rumah Makan Padang dengan resep turun-temurun sejak 1985. Nasi Padang dengan rendang dan ayam pop.",
    storeAddress: "Jl. Gajah Mada No. 45, Semarang",
    storeLat: -6.9694,
    storeLng: 110.4272,
  },
  {
    email: "bakeria@lastbite.id",
    storeName: "Bakeria",
    storeDescription:
      "Bakery artisan dengan roti-roti fresh from the oven setiap hari. Roti coklat dan roti keju favorit pelanggan!",
    storeAddress: "Jl. Pahlawan No. 78, Semarang",
    storeLat: -6.9838,
    storeLng: 110.4163,
  },
  {
    email: "kopiaroma@lastbite.id",
    storeName: "Warung Kopi Aroma",
    storeDescription:
      "Warung kopi legendaris dengan biji kopi lokal pilihan. Kopi susu gula aren signature kami!",
    storeAddress: "Jl. Simpang Lima No. 23, Semarang",
    storeLat: -6.9867,
    storeLng: 110.4223,
  },
  {
    email: "mieayam@lastbite.id",
    storeName: "Mie Ayam Mang Udin",
    storeDescription:
      "Mie ayam porsi komplit dengan topping melimpah. Ayam kecap, pangsit goreng, dan bakso jadi satu!",
    storeAddress: "Jl. Veteran No. 56, Semarang",
    storeLat: -6.9802,
    storeLng: 110.4195,
  },
];

async function ensureMitraUsers(): Promise<MitraUser[]> {
  const mitras: MitraUser[] = [];

  for (const seed of MITRA_SEEDS) {
    let mitra = await prisma.user.findUnique({ where: { email: seed.email } });

    if (!mitra) {
      const passwordHash = await bcrypt.hash("password123", SALT_ROUNDS);
      mitra = await prisma.user.create({
        data: {
          email: seed.email,
          name: seed.name,
          phone: "081234567890",
          role: "MITRA",
          passwordHash,
          isVerified: true,
        },
      });
      console.log(`Created MITRA user: ${seed.email} (${seed.name})`);
    } else {
      console.log(`MITRA user already exists: ${seed.email}`);
    }

    mitras.push({ id: mitra.id, email: mitra.email, store: seed.store });
  }

  return mitras;
}

function getDefaultProducts(mitraMap: Map<string, string>) {
  // Use a fixed future expiry for dev stability (products won't go stale)
  const expiresInHours = (hours: number) =>
    new Date(Date.now() + hours * 60 * 60 * 1000);

  const dapurbuaniId = mitraMap.get("dapurbuani@lastbite.id")!;
  const rmpadangId = mitraMap.get("rmpadang@lastbite.id")!;
  const bakeriaId = mitraMap.get("bakeria@lastbite.id")!;
  const kopiaromaId = mitraMap.get("kopiaroma@lastbite.id")!;
  const mieayamId = mitraMap.get("mieayam@lastbite.id")!;

  return [
    {
      name: "Ayam Preksu",
      description:
        "Ayam geprek pedas dengan sambal bawang khas, dilengkapi lalapan segar dan nasi putih hangat. Paket hemat untuk makan siang!",
      category: "meals" as Category,
      originalPrice: 25000,
      discountedPrice: 15000,
      stock: 5,
      imageUrl: "/uploads/ayam_geprek.png",
      storeName: "Dapur Bu Ani",
      storeAddress: "Jl. Pandanaran No. 12, Semarang",
      storeLat: -6.9875,
      storeLng: 110.4216,
      expiresAt: expiresInHours(4),
      mitraId: dapurbuaniId,
    },
    {
      name: "Nasi Padang",
      description:
        "Paket nasi padang lengkap dengan rendang, ayak pop, sambal lado, dan sayur nangka. Porsi besar!",
      category: "meals" as Category,
      originalPrice: 35000,
      discountedPrice: 25000,
      stock: 3,
      imageUrl: "/uploads/nasi_padang.png",
      storeName: "RM Padang Suharti",
      storeAddress: "Jl. Gajah Mada No. 45, Semarang",
      storeLat: -6.9694,
      storeLng: 110.4272,
      expiresAt: expiresInHours(3),
      mitraId: rmpadangId,
    },
    {
      name: "Roti Coklat",
      description:
        "Roti empuk isi coklat meleleh, fresh from the oven. Cocok untuk teman ngopi sore!",
      category: "bakery" as Category,
      originalPrice: 15000,
      discountedPrice: 8000,
      stock: 8,
      imageUrl: "/uploads/bakery_surplus.png",
      storeName: "Bakeria",
      storeAddress: "Jl. Pahlawan No. 78, Semarang",
      storeLat: -6.9838,
      storeLng: 110.4163,
      expiresAt: expiresInHours(5),
      mitraId: bakeriaId,
    },
    {
      name: "Kopi Susu Gula Aren",
      description:
        "Kopi susu kekinian dengan gula aren asli, menggunakan biji kopi lokal pilihan. Segar!",
      category: "drinks" as Category,
      originalPrice: 22000,
      discountedPrice: 12000,
      stock: 10,
      imageUrl: "/uploads/kopi_susu.png",
      storeName: "Warung Kopi Aroma",
      storeAddress: "Jl. Simpang Lima No. 23, Semarang",
      storeLat: -6.9867,
      storeLng: 110.4223,
      expiresAt: expiresInHours(2),
      mitraId: kopiaromaId,
    },
    {
      name: "Nasi Goreng Kampung",
      description:
        "Nasi goreng kampung dengan bumbu tradisional, telur ceplok, kerupuk, dan acar. Nostalgia!",
      category: "meals" as Category,
      originalPrice: 20000,
      discountedPrice: 13000,
      stock: 6,
      imageUrl: "/uploads/nasi_goreng.png",
      storeName: "Dapur Bu Ani",
      storeAddress: "Jl. Pandanaran No. 12, Semarang",
      storeLat: -6.9875,
      storeLng: 110.4216,
      expiresAt: expiresInHours(3),
      mitraId: dapurbuaniId,
    },
    {
      name: "Roti Keju",
      description:
        "Roti sobek isi keju mozzarella, dipanggang sempurna. Tekstur lembut dan gurih!",
      category: "bakery" as Category,
      originalPrice: 18000,
      discountedPrice: 10000,
      stock: 7,
      imageUrl: "/uploads/bakery_surplus.png",
      storeName: "Bakeria",
      storeAddress: "Jl. Pahlawan No. 78, Semarang",
      storeLat: -6.9838,
      storeLng: 110.4163,
      expiresAt: expiresInHours(4),
      mitraId: bakeriaId,
    },
    {
      name: "Es Teh Tarik",
      description:
        "Es teh tarik segar dengan foam susu creamy. Minuman pelepas dahaga yang pas!",
      category: "drinks" as Category,
      originalPrice: 12000,
      discountedPrice: 7000,
      stock: 12,
      imageUrl: "/uploads/kopi_susu.png",
      storeName: "Warung Kopi Aroma",
      storeAddress: "Jl. Simpang Lima No. 23, Semarang",
      storeLat: -6.9867,
      storeLng: 110.4223,
      expiresAt: expiresInHours(2),
      mitraId: kopiaromaId,
    },
    {
      name: "Mie Ayam Komplit",
      description:
        "Mie ayam dengan topping ayam kecap, pangsit goreng, dan bakso. Porsi lengkap!",
      category: "meals" as Category,
      originalPrice: 20000,
      discountedPrice: 12000,
      stock: 4,
      imageUrl: "/uploads/mie_ayam.png",
      storeName: "Mie Ayam Mang Udin",
      storeAddress: "Jl. Veteran No. 56, Semarang",
      storeLat: -6.9802,
      storeLng: 110.4195,
      expiresAt: expiresInHours(3),
      mitraId: mieayamId,
    },
  ];
}

async function seedProducts(
  mitras: MitraUser[]
): Promise<
  { id: string; name: string; storeName: string; discountedPrice: number; originalPrice: number; imageUrl: string | null }[]
> {
  const mitraMap = new Map(mitras.map((m) => [m.email, m.id]));
  const products = getDefaultProducts(mitraMap);
  const createdProducts: {
    id: string;
    name: string;
    storeName: string;
    discountedPrice: number;
    originalPrice: number;
    imageUrl: string | null;
  }[] = [];

  for (const product of products) {
    const created = await prisma.product.create({ data: product });
    createdProducts.push({
      id: created.id,
      name: created.name,
      storeName: created.storeName,
      discountedPrice: created.discountedPrice,
      originalPrice: created.originalPrice,
      imageUrl: created.imageUrl,
    });
    console.log(`  Created product: ${created.name} (Rp${created.discountedPrice})`);
  }

  console.log(`\nSeeded ${products.length} products successfully!`);
  return createdProducts;
}

function hoursAgo(hours: number): Date {
  return new Date(Date.now() - hours * 60 * 60 * 1000);
}

function hoursFromNow(hours: number): Date {
  return new Date(Date.now() + hours * 60 * 60 * 1000);
}

function generatePickupCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

// ── MitraProfile ──────────────────────────────────────────────────

async function seedMitraProfiles(mitras: MitraUser[]) {
  const emailToMitra = new Map(mitras.map((m) => [m.email, m]));

  for (const seed of MITRA_PROFILE_SEEDS) {
    const mitra = emailToMitra.get(seed.email);
    if (!mitra) continue;

    await prisma.mitraProfile.upsert({
      where: { userId: mitra.id },
      update: {
        storeName: seed.storeName,
        storeDescription: seed.storeDescription,
        storeAddress: seed.storeAddress,
        storeLat: seed.storeLat,
        storeLng: seed.storeLng,
        verificationStatus: "VERIFIED",
      },
      create: {
        userId: mitra.id,
        storeName: seed.storeName,
        storeDescription: seed.storeDescription,
        storeAddress: seed.storeAddress,
        storeLat: seed.storeLat,
        storeLng: seed.storeLng,
        verificationStatus: "VERIFIED",
      },
    });
    console.log(`  MitraProfile: ${seed.storeName} (VERIFIED)`);
  }
  console.log(`Seeded ${MITRA_PROFILE_SEEDS.length} mitra profiles!`);
}

// ── Orders ────────────────────────────────────────────────────────

interface OrderSeedItem {
  productName: string;
  quantity: number;
}

interface OrderSeed {
  storeName: string;
  status: OrderStatus;
  items: OrderSeedItem[];
  hoursAgo: number;
  notes?: string;
  review?: { rating: number; comment: string };
}

const ORDER_SEEDS: OrderSeed[] = [
  // PENDING (3)
  {
    storeName: "Dapur Bu Ani",
    status: OrderStatus.PENDING,
    items: [
      { productName: "Ayam Preksu", quantity: 1 },
      { productName: "Nasi Goreng Kampung", quantity: 1 },
    ],
    hoursAgo: 1,
  },
  {
    storeName: "Bakeria",
    status: OrderStatus.PENDING,
    items: [
      { productName: "Roti Coklat", quantity: 2 },
      { productName: "Roti Keju", quantity: 1 },
    ],
    hoursAgo: 2,
  },
  {
    storeName: "Mie Ayam Mang Udin",
    status: OrderStatus.PENDING,
    items: [{ productName: "Mie Ayam Komplit", quantity: 2 }],
    hoursAgo: 0.5,
  },
  // PROCESSED (2)
  {
    storeName: "RM Padang Suharti",
    status: OrderStatus.PROCESSED,
    items: [{ productName: "Nasi Padang", quantity: 1 }],
    hoursAgo: 3,
  },
  {
    storeName: "Warung Kopi Aroma",
    status: OrderStatus.PROCESSED,
    items: [
      { productName: "Kopi Susu Gula Aren", quantity: 1 },
      { productName: "Es Teh Tarik", quantity: 2 },
    ],
    hoursAgo: 4,
  },
  // READY (2)
  {
    storeName: "Dapur Bu Ani",
    status: OrderStatus.READY,
    items: [{ productName: "Nasi Goreng Kampung", quantity: 2 }],
    hoursAgo: 3,
  },
  {
    storeName: "Bakeria",
    status: OrderStatus.READY,
    items: [{ productName: "Roti Keju", quantity: 2 }],
    hoursAgo: 4,
  },
  // PICKED_UP (3)
  {
    storeName: "Mie Ayam Mang Udin",
    status: OrderStatus.PICKED_UP,
    items: [{ productName: "Mie Ayam Komplit", quantity: 1 }],
    hoursAgo: 6,
    review: {
      rating: 5,
      comment:
        "Mie ayamnya enak banget! Porsi lengkap dengan topping melimpah. Sayang banget kalo dibuang.",
    },
  },
  {
    storeName: "RM Padang Suharti",
    status: OrderStatus.PICKED_UP,
    items: [{ productName: "Nasi Padang", quantity: 2 }],
    hoursAgo: 8,
  },
  {
    storeName: "Warung Kopi Aroma",
    status: OrderStatus.PICKED_UP,
    items: [
      { productName: "Kopi Susu Gula Aren", quantity: 2 },
      { productName: "Es Teh Tarik", quantity: 1 },
    ],
    hoursAgo: 12,
    review: {
      rating: 4,
      comment:
        "Kopi susunya enak, es teh tariknya juga segar. Harga lebih miring dari beli langsung.",
    },
  },
  // CANCELLED (2)
  {
    storeName: "Bakeria",
    status: OrderStatus.CANCELLED,
    items: [{ productName: "Roti Coklat", quantity: 1 }],
    hoursAgo: 10,
  },
  {
    storeName: "Dapur Bu Ani",
    status: OrderStatus.CANCELLED,
    items: [{ productName: "Ayam Preksu", quantity: 1 }],
    hoursAgo: 5,
  },
];

interface ProductInfo {
  id: string;
  name: string;
  storeName: string;
  discountedPrice: number;
  originalPrice: number;
  imageUrl: string | null;
}

async function seedOrders(
  foodSaverId: string,
  productsByName: Map<string, ProductInfo>
) {
  let orderCount = 0;
  let reviewCount = 0;

  for (const seed of ORDER_SEEDS) {
    const createdAt = hoursAgo(seed.hoursAgo);

    let computedTotal = 0;
    let computedOriginal = 0;

    for (const item of seed.items) {
      const product = productsByName.get(item.productName);
      if (!product) {
        console.warn(`  WARN: Product "${item.productName}" not found, skipping order item`);
        continue;
      }
      computedTotal += product.discountedPrice * item.quantity;
      computedOriginal += product.originalPrice * item.quantity;
    }

    const pickupCode = generatePickupCode();
    // Past: PICKED_UP/CANCELLED → expiry already passed; Future: others → expiry ahead
    const isPast = seed.status === OrderStatus.PICKED_UP || seed.status === OrderStatus.CANCELLED;
    const pickupExpiresAt = isPast
      ? new Date(createdAt.getTime() + 2 * 60 * 60 * 1000)
      : hoursFromNow(3);

    const order = await prisma.order.create({
      data: {
        userId: foodSaverId,
        storeName: seed.storeName,
        status: seed.status,
        pickupCode,
        pickupExpiresAt,
        totalAmount: computedTotal,
        savingAmount: computedOriginal - computedTotal,
        buyerName: "Food Saver Test",
        buyerPhone: "081111111111",
        notes: seed.notes ?? null,
        createdAt,
        items: {
          create: seed.items.map((item) => {
            const product = productsByName.get(item.productName)!;
            return {
              productId: product.id,
              name: item.productName,
              storeName: seed.storeName,
              price: product.discountedPrice,
              originalPrice: product.originalPrice,
              quantity: item.quantity,
              imageUrl: product.imageUrl,
            };
          }),
        },
      },
    });
    orderCount++;
    console.log(
      `  Order [${seed.status}]: ${seed.storeName} — Rp${computedTotal} (${pickupCode})`
    );

    // Create review if defined
    if (seed.review) {
      const firstItem = seed.items[0];
      const product = productsByName.get(firstItem.productName);
      if (product) {
        await prisma.review.create({
          data: {
            orderId: order.id,
            userId: foodSaverId,
            productId: product.id,
            rating: seed.review.rating,
            comment: seed.review.comment,
          },
        });
        reviewCount++;
        console.log(`  Review [${seed.review.rating}/5]: ${firstItem.productName}`);
      }
    }
  }

  console.log(`Seeded ${orderCount} orders (${reviewCount} reviews)!`);
}

// ── Cart ──────────────────────────────────────────────────────────

async function seedCart(
  foodSaverId: string,
  productsByName: Map<string, { id: string; name: string }>
) {
  // Food saver's cart across 2 stores
  const ayamPreksu = productsByName.get("Ayam Preksu");
  const rotiCoklat = productsByName.get("Roti Coklat");
  if (!ayamPreksu || !rotiCoklat) {
    console.warn("  WARN: Products for cart not found, skipping cart seed");
    return;
  }

  await prisma.cart.upsert({
    where: { userId: foodSaverId },
    update: {},
    create: {
      userId: foodSaverId,
      storeName: null, // multi-store cart
    },
  });

  // Get the cart
  const cart = await prisma.cart.findUnique({ where: { userId: foodSaverId } });
  if (!cart) return;

  // Create cart items (delete existing first since we upserted above)
  await prisma.cartItem.deleteMany({ where: { cartId: cart.id } });
  await prisma.cartItem.create({
    data: { cartId: cart.id, productId: ayamPreksu.id, quantity: 2 },
  });
  await prisma.cartItem.create({
    data: { cartId: cart.id, productId: rotiCoklat.id, quantity: 1 },
  });

  console.log("  Cart: 2x Ayam Preksu + 1x Roti Coklat");
  console.log("Seeded cart (2 items)!");
}

// ── Wishlist ──────────────────────────────────────────────────────

async function seedWishlist(
  foodSaverId: string,
  productsByName: Map<string, { id: string }>
) {
  const wishlistItems = [
    { productName: "Roti Coklat" },
    { productName: "Kopi Susu Gula Aren" },
    { productName: "Nasi Goreng Kampung" },
  ];

  for (const item of wishlistItems) {
    const product = productsByName.get(item.productName);
    if (!product) {
      console.warn(`  WARN: Product "${item.productName}" not found, skipping wishlist`);
      continue;
    }
    await prisma.wishlistSubscription.upsert({
      where: { userId_productId: { userId: foodSaverId, productId: product.id } },
      update: {},
      create: { userId: foodSaverId, productId: product.id },
    });
  }

  console.log(`Seeded ${wishlistItems.length} wishlist items!`);
}

// ── Notifications ─────────────────────────────────────────────────

interface NotificationSeed {
  title: string;
  body: string;
  type: string;
  isRead: boolean;
  hoursAgo: number;
}

const NOTIFICATION_SEEDS: NotificationSeed[] = [
  {
    title: "Pesanan Diproses",
    body: "Pesanan Mie Ayam Komplit di Mie Ayam Mang Udin sudah diproses oleh mitra.",
    type: "order_status",
    isRead: false,
    hoursAgo: 0.5,
  },
  {
    title: "Promo Akhir Pekan! 🎉",
    body: "Dapatkan diskon tambahan 20% untuk semua produk bakery. Hanya akhir pekan ini!",
    type: "promo",
    isRead: false,
    hoursAgo: 1,
  },
  {
    title: "Pesanan Siap Diambil!",
    body: "Pesananmu di RM Padang Suharti sudah siap diambil. Kode: SGTA4R",
    type: "order_status",
    isRead: true,
    hoursAgo: 4,
  },
  {
    title: "Selamat Datang di LastBite!",
    body: "Terima kasih sudah bergabung. Mulai selamatkan makanan surplus sekarang!",
    type: "general",
    isRead: true,
    hoursAgo: 72,
  },
  {
    title: "Pesanan Berhasil Diambil",
    body: "Terima kasih! Kamu sudah menyelamatkan 1 porsi makanan dari Mie Ayam Mang Udin.",
    type: "order_status",
    isRead: true,
    hoursAgo: 6,
  },
];

async function seedNotifications(foodSaverId: string) {
  for (const notif of NOTIFICATION_SEEDS) {
    await prisma.notification.create({
      data: {
        userId: foodSaverId,
        title: notif.title,
        body: notif.body,
        type: notif.type,
        isRead: notif.isRead,
        createdAt: hoursAgo(notif.hoursAgo),
      },
    });
  }

  const unreadCount = NOTIFICATION_SEEDS.filter((n) => !n.isRead).length;
  console.log(
    `Seeded ${NOTIFICATION_SEEDS.length} notifications (${unreadCount} unread)!`
  );
}

const ADMIN_EMAIL = "admin@lastbite.id";

async function ensureAdminUser(): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`ADMIN user already exists: ${ADMIN_EMAIL}`);
    return existing.id;
  }

  const passwordHash = await bcrypt.hash("admin123", SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: ADMIN_EMAIL,
      name: "Admin LastBite",
      phone: "080000000000",
      role: "ADMIN",
      passwordHash,
      isVerified: true,
    },
  });
  console.log(`Created ADMIN user: ${ADMIN_EMAIL} (password: admin123)`);
  return user.id;
}

const FOOD_SAVER_EMAIL = "foodsaver@lastbite.id";

async function seedFoodSaverUser(): Promise<string> {
  const existing = await prisma.user.findUnique({ where: { email: FOOD_SAVER_EMAIL } });
  if (existing) {
    console.log(`FOOD_SAVER user already exists: ${FOOD_SAVER_EMAIL}`);
    return existing.id;
  }

  const passwordHash = await bcrypt.hash("foodsaver123", SALT_ROUNDS);
  const user = await prisma.user.create({
    data: {
      email: FOOD_SAVER_EMAIL,
      name: "Food Saver Test",
      phone: "081111111111",
      role: "FOOD_SAVER",
      passwordHash,
      isVerified: true,
    },
  });
  console.log(`Created FOOD_SAVER user: ${FOOD_SAVER_EMAIL} (password: foodsaver123)`);
  return user.id;
}

async function cleanupDatabase() {
  // Delete in dependency order: child tables first (respect FK constraints)
  console.log("Cleaning existing data...");
  await prisma.cartItem.deleteMany();
  await prisma.wishlistSubscription.deleteMany();
  await prisma.review.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.orderItem.deleteMany();
  await prisma.order.deleteMany();
  await prisma.cart.deleteMany();
  await prisma.mitraProfile.deleteMany();
  await prisma.product.deleteMany();
  // Users are kept (reusable via findUnique in seed functions)
  console.log("Cleanup complete!\n");
}

async function main() {
  console.log("Seeding database...\n");
  await cleanupDatabase();

  // ── Users & Products ──
  await ensureAdminUser();
  const foodSaverId = await seedFoodSaverUser();
  const mitras = await ensureMitraUsers();
  await seedMitraProfiles(mitras);
  const products = await seedProducts(mitras);

  // Build lookup by product name
  const productsByName = new Map(products.map((p) => [p.name, p]));

  // ── Relational Data ──
  console.log("");
  await seedOrders(foodSaverId, productsByName);
  console.log("");
  await seedCart(foodSaverId, productsByName);
  console.log("");
  await seedWishlist(foodSaverId, productsByName);
  console.log("");
  await seedNotifications(foodSaverId);

  console.log("\n✅ Seed complete! 7 users, 8 products, 5 profiles, 12 orders, 2 reviews, 1 cart (2 items), 3 wishlist, 5 notifications");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
