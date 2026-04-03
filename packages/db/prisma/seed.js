const { PrismaClient } = require('../generated/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  const BCRYPT_ROUNDS = 10;

  const users = [
    {
      email: 'Andy@enpas.de',
      password: 'Berlin00',
      role: 'PLAYER',
    },
    {
      email: 'admin@test.com',
      password: 'AdminPass123!',
      role: 'ADMIN',
    },
    {
      email: 'coach@test.com',
      password: 'CoachPass123!',
      role: 'COACH',
    },
    {
      email: 'player@test.com',
      password: 'PlayerPass123!',
      role: 'PLAYER',
    },
  ];

  for (const u of users) {
    const passwordHash = await bcrypt.hash(u.password, BCRYPT_ROUNDS);
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        password: passwordHash,
        role: u.role,
      },
    });
  }

  console.log('✅ Seeded users successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
