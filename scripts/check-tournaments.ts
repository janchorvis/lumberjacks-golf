import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const tournaments = await prisma.tournament.findMany({
    orderBy: { startDate: 'asc' },
    select: { id: true, name: true, startDate: true, endDate: true, isComplete: true, externalId: true }
  });
  console.table(tournaments.map(t => ({
    name: t.name,
    start: t.startDate.toISOString().split('T')[0],
    end: t.endDate.toISOString().split('T')[0],
    isComplete: t.isComplete,
    externalId: t.externalId
  })));
}

main().catch(console.error).finally(() => prisma.$disconnect());
