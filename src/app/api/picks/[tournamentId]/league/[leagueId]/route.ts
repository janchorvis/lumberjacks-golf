import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { isBeforeDeadline } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { tournamentId: string; leagueId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tournamentId, leagueId } = await params;

    // Verify user is a member of the league
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

    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    const beforeDeadline = isBeforeDeadline(tournament.pickDeadline);

    // Get all league members
    const members = await prisma.leagueMember.findMany({
      where: { leagueId },
      include: { user: { select: { id: true, username: true } } },
    });

    // Get all picks for this tournament and league
    const allPicks = await prisma.pick.findMany({
      where: { tournamentId, leagueId },
      include: {
        golfer: true,
      },
      orderBy: { pickOrder: 'asc' },
    });

    const memberPicks = members.map((member) => {
      const isCurrentUser = member.userId === user.id;

      // Before deadline, only show the current user's picks
      if (beforeDeadline && !isCurrentUser) {
        return {
          userId: member.user.id,
          username: member.user.username,
          hasPicked: allPicks.some((p) => p.userId === member.userId),
          picks: [],
        };
      }

      const userPicks = allPicks
        .filter((p) => p.userId === member.userId)
        .map((p) => ({
          id: p.id,
          golferId: p.golfer.id,
          golferName: p.golfer.name,
          pickOrder: p.pickOrder,
        }));

      return {
        userId: member.user.id,
        username: member.user.username,
        hasPicked: userPicks.length > 0,
        picks: userPicks,
      };
    });

    return NextResponse.json({
      tournamentId,
      leagueId,
      beforeDeadline,
      members: memberPicks,
    });
  } catch (error) {
    console.error('League picks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
