import { PrismaClient, Category } from "@prisma/client";
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

async function seedProducts(mitras: MitraUser[]) {
  await prisma.product.deleteMany();
  console.log("Cleared existing products");

  const mitraMap = new Map(mitras.map((m) => [m.email, m.id]));
  const products = getDefaultProducts(mitraMap);

  for (const product of products) {
    const created = await prisma.product.create({ data: product });
    console.log(`  Created product: ${created.name} (Rp${created.discountedPrice})`);
  }

  console.log(`\nSeeded ${products.length} products successfully!`);
}

const ADMIN_EMAIL = "admin@lastbite.id";

async function seedAdminUser(): Promise<void> {
  const existing = await prisma.user.findUnique({ where: { email: ADMIN_EMAIL } });
  if (existing) {
    console.log(`ADMIN user already exists: ${ADMIN_EMAIL}`);
    return;
  }

  const passwordHash = await bcrypt.hash("admin123", SALT_ROUNDS);
  await prisma.user.create({
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
}

async function main() {
  console.log("Seeding database...");

  await seedAdminUser();
  const mitras = await ensureMitraUsers();
  await seedProducts(mitras);

  console.log("Seed complete!");
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
