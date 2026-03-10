import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await params;

    const league = await prisma.league.findUnique({
      where: { id },
      include: {
        members: {
          include: { user: { select: { id: true, username: true } } },
        },
        season: { select: { id: true, name: true, year: true } },
      },
    });

    if (!league) {
      return NextResponse.json({ error: 'League not found' }, { status: 404 });
    }

    // Verify user is a member
    const isMember = league.members.some((m) => m.userId === user.id);
    if (!isMember) {
      return NextResponse.json(
        { error: 'You are not a member of this league' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name,
        inviteCode: league.inviteCode,
        season: league.season,
        members: league.members.map((m) => ({
          userId: m.user.id,
          username: m.user.username,
          joinedAt: m.joinedAt,
        })),
      },
    });
  } catch (error) {
    console.error('League detail error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
