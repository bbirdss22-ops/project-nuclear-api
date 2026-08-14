import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding dev database...');

  // ล้างข้อมูลเก่า (dev only)
  await prisma.customer.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.userProfile.deleteMany({});

  // Test customers
  const customerA = await prisma.customer.create({
    data: {
      code: 'NC00001',
      firstName: 'ทดสอบ',
      lastName: 'ลูกค้า',
      phone: '0812345678',
      lineUserId: 'test-line-user-a',
      bankStatus: 'approved',
    },
  });

  const customerB = await prisma.customer.create({
    data: {
      code: 'NC00002',
      firstName: 'เพื่อน',
      lastName: 'ทดสอบ',
      phone: '0898765432',
      lineUserId: 'test-line-user-b',
      referrerId: customerA.id,
      bankStatus: 'pending',
    },
  });

  // Admin user
  const admin = await prisma.user.create({
    data: {
      username: 'admin',
      passwordHash: '$2b$10$placeholder-placeholder-placeholder', // ใส่ bcrypt hash จริงใน local
      role: 'superadmin',
    },
  });

  console.log(`✅ Seed complete: ${customerA.code}, ${customerB.code}, admin ${admin.username}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
