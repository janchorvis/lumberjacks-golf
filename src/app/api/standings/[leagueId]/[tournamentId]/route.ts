import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { calculateBestFour } from '@/lib/scoring';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { leagueId: string; tournamentId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { leagueId, tournamentId } = await params;

    // Verify user is a member
    const membership = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: { leagueId, userId: user.id },
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this league' },
        { status: 403 }
      );
    }

    // Get all picks for this league/tournament
    const picks = await prisma.pick.findMany({
      where: { leagueId, tournamentId },
      include: {
        golfer: true,
        user: { select: { id: true, username: true } },
      },
      orderBy: { pickOrder: 'asc' },
    });

    // Get tournament results
    const results = await prisma.tournamentResult.findMany({
      where: { tournamentId },
    });

    const resultMap = new Map(
      results.map((r) => [r.golferId, r])
    );

    const winnerResult = results.find((r) => r.position === 1 && r.status === 'active');
    const winnerGolferId = winnerResult?.golferId ?? null;

    // Get weekly results for ranking info
    const weeklyResults = await prisma.weeklyResult.findMany({
      where: { leagueId, tournamentId },
    });

    const weeklyResultMap = new Map(
      weeklyResults.map((r) => [r.userId, r])
    );

    // Group picks by user
    const userPicksMap = new Map<string, typeof picks>();
    for (const pick of picks) {
      const existing = userPicksMap.get(pick.userId) || [];
      existing.push(pick);
      userPicksMap.set(pick.userId, existing);
    }

    const breakdown = Array.from(userPicksMap.entries()).map(([userId, userPicks]) => {
      const golferScores = userPicks.map((p) => {
        const result = resultMap.get(p.golferId);
        return {
          golferId: p.golfer.id,
          golferName: p.golfer.name,
          pickOrder: p.pickOrder,
          scoreToPar: result?.scoreToPar ?? null,
          status: (result?.status ?? 'active') as 'active' | 'cut' | 'wd' | 'dq',
          position: result?.position ?? null,
          r1Score: result?.r1Score ?? null,
          r2Score: result?.r2Score ?? null,
          r3Score: result?.r3Score ?? null,
          r4Score: result?.r4Score ?? null,
        };
      });

      const { bestFour, totalScore } = calculateBestFour(
        golferScores.map((g) => ({
          golferId: g.golferId,
          golferName: g.golferName,
          scoreToPar: g.scoreToPar,
          status: g.status,
        }))
      );

      const bestFourIds = new Set(bestFour.map((g) => g.golferId));
      const weeklyResult = weeklyResultMap.get(userId);

      return {
        userId,
        username: userPicks[0]?.user.username ?? '',
        rank: weeklyResult?.rank ?? 0,
        points: weeklyResult?.points ?? 0,
        totalScore,
        picks: golferScores.map((g) => ({
          ...g,
          isBestFour: bestFourIds.has(g.golferId),
          isWinner: winnerGolferId !== null && g.golferId === winnerGolferId,
        })),
      };
    });

    // Sort by rank (or totalScore if no weekly results yet)
    breakdown.sort((a, b) => {
      if (a.rank && b.rank) return a.rank - b.rank;
      return a.totalScore - b.totalScore;
    });

    return NextResponse.json({ breakdown });
  } catch (error) {
    console.error('Weekly breakdown error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
