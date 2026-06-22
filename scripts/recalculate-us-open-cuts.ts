import { PrismaClient } from '@prisma/client';
import { calculateWeeklyResults, type TeamPicks, type GolferScore } from '../src/lib/scoring';

const prisma = new PrismaClient();
const TOURNAMENT_ID = 'cmml7bk2v000gxihq5hv7k0kl';
const MAJORS = new Set(['Masters Tournament', 'PGA Championship', 'U.S. Open', 'The Open Championship']);

async function main() {
  const tournament = await prisma.tournament.findUnique({ where: { id: TOURNAMENT_ID } });
  if (!tournament) throw new Error('U.S. Open tournament not found');

  const cutCandidates = await prisma.tournamentResult.findMany({
    where: {
      tournamentId: TOURNAMENT_ID,
      status: 'active',
      r1Score: { not: null },
      r2Score: { not: null },
      r3Score: null,
      r4Score: null,
    },
    include: { golfer: true },
  });

  await prisma.tournamentResult.updateMany({
    where: {
      tournamentId: TOURNAMENT_ID,
      status: 'active',
      r1Score: { not: null },
      r2Score: { not: null },
      r3Score: null,
      r4Score: null,
    },
    data: { status: 'cut' },
  });

  const leaguesWithPicks = await prisma.pick.findMany({
    where: { tournamentId: TOURNAMENT_ID },
    select: { leagueId: true },
    distinct: ['leagueId'],
  });

  const results = await prisma.tournamentResult.findMany({ where: { tournamentId: TOURNAMENT_ID } });
  const resultMap = new Map(results.map((r) => [r.golferId, r]));
  const winnerResult = results.find((r) => r.position === 1 && r.status === 'active');
  const winnerGolferId = winnerResult?.golferId ?? null;

  const summaries: unknown[] = [];
  for (const { leagueId } of leaguesWithPicks) {
    const picks = await prisma.pick.findMany({
      where: { leagueId, tournamentId: TOURNAMENT_ID },
      include: { golfer: true, user: true },
    });

    const userPicksMap = new Map<string, typeof picks>();
    for (const pick of picks) {
      const existing = userPicksMap.get(pick.userId) || [];
      existing.push(pick);
      userPicksMap.set(pick.userId, existing);
    }

    const teams: TeamPicks[] = Array.from(userPicksMap.entries()).map(([userId, userPicks]) => ({
      userId,
      golfers: userPicks.map((p): GolferScore => {
        const result = resultMap.get(p.golferId);
        return {
          golferId: p.golferId,
          golferName: p.golfer.name,
          scoreToPar: result?.scoreToPar ?? null,
          status: (result?.status as GolferScore['status']) ?? 'active',
        };
      }),
    }));

    const weeklyResults = calculateWeeklyResults(teams, winnerGolferId).map((wr) => {
      const hasWinner = winnerGolferId
        ? [...wr.bestFour, ...wr.dropped].some((g) => g.golferId === winnerGolferId)
        : false;
      const winnerBonus = hasWinner ? 100 : 0;
      const finishPoints = wr.points - winnerBonus;
      return { ...wr, points: MAJORS.has(tournament.name) ? finishPoints * 2 + winnerBonus : wr.points };
    });

    for (const wr of weeklyResults) {
      await prisma.weeklyResult.upsert({
        where: { leagueId_userId_tournamentId: { leagueId, userId: wr.userId, tournamentId: TOURNAMENT_ID } },
        create: { leagueId, userId: wr.userId, tournamentId: TOURNAMENT_ID, totalScore: wr.totalScore, rank: wr.rank, points: wr.points },
        update: { totalScore: wr.totalScore, rank: wr.rank, points: wr.points },
      });
    }

    const users = new Map(picks.map((p) => [p.userId, p.user.username]));
    summaries.push(...weeklyResults.map((wr) => ({
      user: users.get(wr.userId),
      totalScore: wr.totalScore,
      rank: wr.rank,
      points: wr.points,
      bestFour: wr.bestFour.map((g) => `${g.golferName} ${g.status === 'cut' ? 'CUT ' : ''}${g.scoreToPar}`),
      dropped: wr.dropped.map((g) => `${g.golferName} ${g.status === 'cut' ? 'CUT ' : ''}${g.scoreToPar}`),
    })));
  }

  console.log(JSON.stringify({
    cutMarked: cutCandidates.length,
    cutPicked: cutCandidates.filter((r) => r.golfer).map((r) => r.golfer.name).slice(0, 200),
    summaries,
  }, null, 2));
}

main().finally(async () => prisma.$disconnect());
