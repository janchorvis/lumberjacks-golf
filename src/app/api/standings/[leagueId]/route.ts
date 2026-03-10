import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { leagueId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { leagueId } = await params;

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

    // Get league with members
    const league = await prisma.league.findUnique({
      where: { id: leagueId },
      include: {
        members: {
          include: { user: { select: { id: true, username: true } } },
        },
      },
    });

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Get all weekly results for this league
    const weeklyResults = await prisma.weeklyResult.findMany({
      where: { leagueId },
      include: {
        tournament: { select: { id: true, name: true } },
      },
    });

    // Build standings per user
    const standings = league.members.map((member) => {
      const userResults = weeklyResults.filter((r) => r.userId === member.userId);
      const totalPoints = userResults.reduce((sum, r) => sum + r.points, 0);

      return {
        userId: member.user.id,
        username: member.user.username,
        totalPoints,
        weeklyResults: userResults.map((r) => ({
          tournamentId: r.tournament.id,
          tournamentName: r.tournament.name,
          points: r.points,
          rank: r.rank,
          totalScore: r.totalScore,
        })),
      };
    });

    // Sort by total points descending
    standings.sort((a, b) => b.totalPoints - a.totalPoints);

    return NextResponse.json({ standings });
  } catch (error) {
    console.error('Standings error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
