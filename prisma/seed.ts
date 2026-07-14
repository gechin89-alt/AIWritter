import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  await prisma.campaign.upsert({
    where: { slug: "demo" },
    update: {},
    create: {
      slug: "demo",
      name: "Demo Brand Launch Campaign",
      brandLink: "https://example.com/demo-product",
      prizeInfo:
        "Grand prize: a weekend getaway. Plus 10x RM50 vouchers for lucky participants.",
      termsText:
        "Open to participants who post genuine content about the product on Xiaohongshu or Instagram and submit their post link. One entry per person. Winners selected by random draw.",
      active: true,
    },
  });

  const adminPhone = process.env.SEED_ADMIN_PHONE ?? "0000000000";
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "changeme123";
  const passwordHash = await bcrypt.hash(adminPassword, 10);

  await prisma.user.upsert({
    where: { phone: adminPhone },
    update: {},
    create: {
      name: "Admin",
      phone: adminPhone,
      passwordHash,
      role: "ADMIN",
    },
  });

  console.log("Seeded demo campaign and admin user.");
  console.log(`Admin login: phone=${adminPhone} password=${adminPassword}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
