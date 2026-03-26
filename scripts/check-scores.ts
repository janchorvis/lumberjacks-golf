import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  // Check what scoring models exist - look for TournamentResult or similar
  const models = Object.keys(prisma).filter(k => !k.startsWith('_') && !k.startsWith('$'));
  console.log('Available models:', models.join(', '));

  // Check TournamentResult if it exists
  try {
    const results = await (prisma as any).tournamentResult.findMany({
      where: { tournamentId: 'cmmuryvmt0001qddgppxq74ny' },
      take: 5,
    });
    console.log('\nTournamentResult rows:', results.length);
    if (results.length > 0) console.log('Sample:', JSON.stringify(results[0], null, 2));
  } catch (e: any) { console.log('No TournamentResult model:', e.message?.slice(0, 80)); }

  // Check GolferScore if it exists
  try {
    const scores = await (prisma as any).golferScore.findMany({ take: 5 });
    console.log('\nGolferScore rows:', scores.length);
  } catch (e: any) { console.log('No GolferScore model:', e.message?.slice(0, 80)); }

  // Check leagueStanding
  try {
    const standings = await (prisma as any).leagueStanding.findMany({
      where: { seasonId: 'cmml7bgvn0000xihq3cqppwlx' },
      include: { user: true },
      orderBy: { points: 'desc' },
    });
    console.log('\nLeague Standings:');
    for (const s of standings) {
      console.log(`  ${s.user.username}: ${s.points} pts`);
    }
  } catch (e: any) { console.log('No LeagueStanding model:', e.message?.slice(0, 80)); }

  // Check DraftPick with any score fields
  const pick = await prisma.draftPick.findFirst({ where: { draftId: 'cmmuvffo30001gw48timvxdqy' } });
  console.log('\nSample DraftPick fields:', Object.keys(pick || {}));
}

main().catch(console.error).finally(() => prisma.$disconnect());
