import { PrismaClient, Role } from '../generated/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const BCRYPT_ROUNDS = 10;

  const users = [
    {
      email: 'Andy@enpas.de',
      password: 'Berlin00',
      role: Role.PLAYER,
    },
    {
      email: 'admin@test.com',
      password: 'AdminPass123!',
      role: Role.ADMIN,
    },
    {
      email: 'coach@test.com',
      password: 'CoachPass123!',
      role: Role.COACH,
    },
    {
      email: 'player@test.com',
      password: 'PlayerPass123!',
      role: Role.PLAYER,
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

  const clubs = ['Rio Pinar Golf Academy', 'BGC Stolper Heide Akademie'];
  for (const name of clubs) {
    await prisma.club.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log('✅ Seeded clubs successfully');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
