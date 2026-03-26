import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const DRAFT_ID = 'cmmuvffo30001gw48timvxdqy';
const TOURNAMENT_ID = 'cmmuryvmt0001qddgppxq74ny';

const USERS: Record<string, string> = {
  'cmmlxtw8t0000rdlgtcty75wd': 'Spenny',
  'cmmm2ehvq0000132mt1i3e2mp': 'Kramer',
  'cmml7bn46007bxihqdfx67tf6': 'Jacob',
  'cmmlcv48700002pn8xbo7k3cm': 'Bolger',
};

async function main() {
  const picks = await prisma.draftPick.findMany({
    where: { draftId: DRAFT_ID },
    include: { golfer: true },
  });

  const results = await prisma.tournamentResult.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    include: { golfer: true },
  });

  const resultByGolfer: Record<string, typeof results[0]> = {};
  for (const r of results) resultByGolfer[r.golferId] = r;

  console.log(`TournamentResult rows: ${results.length}`);
  console.log(`Total picks: ${picks.length}\n`);

  // Group picks by user, calculate scores (best 4 of 7)
  const byUser: Record<string, { golfer: string; score: number | null; position: number | null; status: string }[]> = {};
  for (const p of picks) {
    if (!byUser[p.userId]) byUser[p.userId] = [];
    const r = resultByGolfer[p.golferId];
    byUser[p.userId].push({
      golfer: p.golfer.name,
      score: r?.scoreToPar ?? null,
      position: r?.position ?? null,
      status: r?.status ?? 'no data',
    });
  }

  const leaderboard: { name: string; total: number; best4: number[] }[] = [];

  for (const [userId, golfers] of Object.entries(byUser)) {
    const name = USERS[userId] || userId;
    console.log(`${name}:`);
    const scores: number[] = [];
    for (const g of golfers) {
      const scoreStr = g.score === null ? 'N/A' : (g.score > 0 ? `+${g.score}` : `${g.score}`);
      const posStr = g.position ? `T${g.position}` : '--';
      console.log(`  ${g.golfer.padEnd(25)} ${scoreStr.padStart(5)} (${posStr}) [${g.status}]`);
      if (g.score !== null) scores.push(g.score);
    }
    scores.sort((a, b) => a - b);
    const best4 = scores.slice(0, 4);
    const total = best4.reduce((s, v) => s + v, 0);
    console.log(`  Best 4: ${best4.map(s => s > 0 ? `+${s}` : `${s}`).join(', ')} = ${total > 0 ? '+' : ''}${total}\n`);
    leaderboard.push({ name, total, best4 });
  }

  leaderboard.sort((a, b) => a.total - b.total);
  console.log('=== STANDINGS ===');
  leaderboard.forEach((e, i) => console.log(`  ${i+1}. ${e.name}: ${e.total > 0 ? '+' : ''}${e.total}`));
}

main().catch(console.error).finally(() => prisma.$disconnect());
