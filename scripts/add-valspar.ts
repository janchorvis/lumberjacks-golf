import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const season = await prisma.season.findFirst({ where: { year: 2026 } });
  if (!season) { console.log('No 2026 season found!'); return; }
  console.log('Season:', season.id, season.year);

  const existing = await prisma.tournament.findFirst({ 
    where: { name: { contains: 'Valspar' } }
  });
  if (existing) {
    console.log('Valspar already exists:', existing.id);
    if (!existing.externalId) {
      await prisma.tournament.update({
        where: { id: existing.id },
        data: { externalId: '401811938' }
      });
      console.log('Updated externalId to 401811938');
    }
    // Check field count
    const fieldCount = await prisma.tournamentField.count({ where: { tournamentId: existing.id }});
    console.log('Field size:', fieldCount);
    return;
  }

  const tournament = await prisma.tournament.create({
    data: {
      name: 'Valspar Championship',
      course: 'Innisbrook Resort (Copperhead Course)',
      location: 'Palm Harbor, FL',
      startDate: new Date('2026-03-19T00:00:00Z'),
      endDate: new Date('2026-03-22T23:59:59Z'),
      pickDeadline: new Date('2026-03-19T11:00:00Z'),
      seasonId: season.id,
      externalId: '401811938',
      isComplete: false,
    }
  });
  console.log('Created Valspar:', tournament.id);

  // Seed field with all golfers (we'll update when ESPN has the real field)
  const golfers = await prisma.golfer.findMany({ select: { id: true, name: true } });
  console.log('Adding', golfers.length, 'golfers to field...');
  await prisma.tournamentField.createMany({
    data: golfers.map(g => ({ tournamentId: tournament.id, golferId: g.id }))
  });
  console.log('Field seeded!');
}

main().catch(console.error).finally(() => prisma.$disconnect());
