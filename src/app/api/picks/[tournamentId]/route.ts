import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { isBeforeDeadline } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tournamentId } = await params;
    const leagueId = request.nextUrl.searchParams.get('leagueId');

    if (!leagueId) {
      return NextResponse.json({ error: 'leagueId query parameter is required' }, { status: 400 });
    }

    const picks = await prisma.pick.findMany({
      where: {
        tournamentId,
        leagueId,
        userId: user.id,
      },
      include: {
        golfer: true,
      },
      orderBy: { pickOrder: 'asc' },
    });

    return NextResponse.json({
      picks: picks.map((p) => ({
        id: p.id,
        golferId: p.golfer.id,
        golferName: p.golfer.name,
        pickOrder: p.pickOrder,
      })),
    });
  } catch (error) {
    console.error('Get picks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { tournamentId } = await params;
    const { leagueId, picks } = await request.json();

    if (!leagueId || !picks) {
      return NextResponse.json(
        { error: 'leagueId and picks are required' },
        { status: 400 }
      );
    }

    if (!Array.isArray(picks) || picks.length !== 7) {
      return NextResponse.json(
        { error: 'Exactly 7 picks are required' },
        { status: 400 }
      );
    }

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

    // Check tournament exists and deadline hasn't passed
    const tournament = await prisma.tournament.findUnique({
      where: { id: tournamentId },
      include: {
        field: true,
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    if (!isBeforeDeadline(tournament.pickDeadline)) {
      return NextResponse.json(
        { error: 'Pick deadline has passed' },
        { status: 400 }
      );
    }

    // Validate all golfers are in the tournament field
    const fieldGolferIds = new Set(tournament.field.map((f) => f.golferId));
    const pickedGolferIds = picks.map((p: { golferId: string }) => p.golferId);

    for (const golferId of pickedGolferIds) {
      if (!fieldGolferIds.has(golferId)) {
        return NextResponse.json(
          { error: `Golfer ${golferId} is not in the tournament field` },
          { status: 400 }
        );
      }
    }

    // Check for duplicate golfers
    const uniqueGolferIds = new Set(pickedGolferIds);
    if (uniqueGolferIds.size !== 7) {
      return NextResponse.json(
        { error: 'All 7 picks must be different golfers' },
        { status: 400 }
      );
    }

    // Delete existing picks and create new ones in a transaction
    await prisma.$transaction(async (tx) => {
      await tx.pick.deleteMany({
        where: {
          tournamentId,
          leagueId,
          userId: user.id,
        },
      });

      await tx.pick.createMany({
        data: picks.map((p: { golferId: string; pickOrder: number }) => ({
          leagueId,
          userId: user.id,
          tournamentId,
          golferId: p.golferId,
          pickOrder: p.pickOrder,
        })),
      });
    });

    return NextResponse.json({ success: true }, { status: 201 });
  } catch (error) {
    console.error('Submit picks error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
