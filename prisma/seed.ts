import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
});

async function main() {
  console.log('🌱 Seeding users...');

  const hash = '$2b$10$BsQ24f1/iOFCYyMK3gNMeOCDl8p3Hm.ueI4vvXJ2QIbFmocnwhsDy';

  for (let i = 1; i <= 5; i++) {
    const username = `admin${i}`;
    const existing = await prisma.user.findUnique({ where: { username } });

    if (!existing) {
      await prisma.user.create({
        data: {
          username,
          password: hash,
          role: i === 1 ? 'superadmin' : 'admin',
        },
      });
      console.log(`  ✅ Created ${username} (role: ${i === 1 ? 'superadmin' : 'admin'})`);
    } else {
      await prisma.user.update({
        where: { username },
        data: { password: hash },
      });
      console.log(`  🔄 Updated ${username} password hash`);
    }
  }

  console.log('✅ Seed completed successfully');
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
