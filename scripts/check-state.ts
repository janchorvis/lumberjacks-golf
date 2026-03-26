import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const draft = await prisma.draft.findUnique({
    where: { id: 'cmmuvffo30001gw48timvxdqy' },
    include: { picks: { include: { golfer: true, user: true }, orderBy: { pickNumber: 'asc' } } }
  });
  console.log('=== DRAFT ===');
  console.log('Status:', draft?.status, '| pickIndex:', draft?.currentPickIndex, '| round:', draft?.currentRound);
  console.log('Total picks:', draft?.picks.length);
  for (const p of draft?.picks || []) {
    console.log(`  #${p.pickNumber} R${p.round} ${p.user.username}: ${p.golfer.name}`);
  }

  const tournament = await prisma.tournament.findUnique({ where: { id: 'cmmuryvmt0001qddgppxq74ny' } });
  console.log('\n=== VALSPAR ===');
  console.log('isComplete:', tournament?.isComplete);

  const fieldWithScores = await prisma.tournamentField.findMany({
    where: { tournamentId: 'cmmuryvmt0001qddgppxq74ny', score: { not: null } },
    include: { golfer: true },
    take: 10
  });
  console.log('Field entries with scores:', fieldWithScores.length);
  for (const f of fieldWithScores.slice(0, 5)) {
    console.log(`  ${f.golfer.name}: score=${f.score} pos=${f.position}`);
  }

  const queues = await prisma.autoDraftQueue.findMany({ where: { draftId: 'cmmuvffo30001gw48timvxdqy' } });
  console.log('\n=== AUTO-DRAFT QUEUES ===');
  for (const q of queues) {
    const user = await prisma.user.findUnique({ where: { id: q.userId } });
    const ids: string[] = JSON.parse(q.queueOrder);
    console.log(`  ${user?.username}: enabled=${q.enabled}, queueLength=${ids.length}`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
