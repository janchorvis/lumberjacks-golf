import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import { generateInviteCode } from '@/lib/utils';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const memberships = await prisma.leagueMember.findMany({
      where: { userId: user.id },
      include: {
        league: {
          include: {
            members: {
              include: { user: { select: { id: true, username: true } } },
            },
            season: { select: { id: true, name: true, year: true } },
          },
        },
      },
    });

    const leagues = memberships.map((m) => ({
      id: m.league.id,
      name: m.league.name,
      inviteCode: m.league.inviteCode,
      season: m.league.season,
      members: m.league.members.map((mem) => ({
        userId: mem.user.id,
        username: mem.user.username,
      })),
    }));

    return NextResponse.json({ leagues });
  } catch (error) {
    console.error('List leagues error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { name } = await request.json();

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: 'League name is required' },
        { status: 400 }
      );
    }

    // Get active season
    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true },
    });

    if (!activeSeason) {
      return NextResponse.json(
        { error: 'No active season found' },
        { status: 400 }
      );
    }

    const inviteCode = generateInviteCode();

    const league = await prisma.$transaction(async (tx) => {
      const newLeague = await tx.league.create({
        data: {
          name: name.trim(),
          inviteCode,
          seasonId: activeSeason.id,
          createdBy: user.id,
        },
      });

      // Auto-join creator
      await tx.leagueMember.create({
        data: {
          leagueId: newLeague.id,
          userId: user.id,
        },
      });

      return newLeague;
    });

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name,
        inviteCode: league.inviteCode,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Create league error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
