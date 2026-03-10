import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { calculateWeeklyResults, type TeamPicks, type GolferScore } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

export async function POST(
  request: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { tournamentId } = await params;
    const { results } = await request.json();

    if (!Array.isArray(results)) {
      return NextResponse.json(
        { error: 'results array is required' },
        { status: 400 }
      );
    }

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    // Upsert all results
    await prisma.$transaction(async (tx) => {
      for (const result of results) {
        await tx.tournamentResult.upsert({
          where: {
            tournamentId_golferId: {
              tournamentId,
              golferId: result.golferId,
            },
          },
          create: {
            tournamentId,
            golferId: result.golferId,
            position: result.position ?? null,
            scoreToPar: result.scoreToPar ?? null,
            r1Score: result.r1Score ?? null,
            r2Score: result.r2Score ?? null,
            r3Score: result.r3Score ?? null,
            r4Score: result.r4Score ?? null,
            status: result.status ?? 'active',
          },
          update: {
            position: result.position ?? null,
            scoreToPar: result.scoreToPar ?? null,
            r1Score: result.r1Score ?? null,
            r2Score: result.r2Score ?? null,
            r3Score: result.r3Score ?? null,
            r4Score: result.r4Score ?? null,
            status: result.status ?? 'active',
          },
        });
      }
    });

    // Recalculate weekly results for all leagues that have picks for this tournament
    const leaguesWithPicks = await prisma.pick.findMany({
      where: { tournamentId },
      select: { leagueId: true },
      distinct: ['leagueId'],
    });

    // Get the updated results
    const tournamentResults = await prisma.tournamentResult.findMany({
      where: { tournamentId },
      include: { golfer: true },
    });

    const resultMap = new Map(
      tournamentResults.map((r) => [r.golferId, r])
    );

    for (const { leagueId } of leaguesWithPicks) {
      // Get all picks for this league/tournament grouped by user
      const picks = await prisma.pick.findMany({
        where: { leagueId, tournamentId },
        include: { golfer: true },
      });

      // Group picks by user
      const userPicksMap = new Map<string, typeof picks>();
      for (const pick of picks) {
        const existing = userPicksMap.get(pick.userId) || [];
        existing.push(pick);
        userPicksMap.set(pick.userId, existing);
      }

      // Build TeamPicks for scoring engine
      const teams: TeamPicks[] = Array.from(userPicksMap.entries()).map(
        ([userId, userPicks]) => ({
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
        })
      );

      const weeklyResults = calculateWeeklyResults(teams);

      // Upsert weekly results
      for (const wr of weeklyResults) {
        await prisma.weeklyResult.upsert({
          where: {
            leagueId_userId_tournamentId: {
              leagueId,
              userId: wr.userId,
              tournamentId,
            },
          },
          create: {
            leagueId,
            userId: wr.userId,
            tournamentId,
            totalScore: wr.totalScore,
            rank: wr.rank,
            points: wr.points,
          },
          update: {
            totalScore: wr.totalScore,
            rank: wr.rank,
            points: wr.points,
          },
        });
      }
    }

    return NextResponse.json({
      success: true,
      resultsUpdated: results.length,
      leaguesRecalculated: leaguesWithPicks.length,
    });
  } catch (error) {
    console.error('Sync results error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
