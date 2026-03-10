import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const { inviteCode } = await request.json();

    if (!inviteCode) {
      return NextResponse.json(
        { error: 'Invite code is required' },
        { status: 400 }
      );
    }

    const league = await prisma.league.findUnique({
      where: { inviteCode: inviteCode.toUpperCase() },
    });

    if (!league) {
      return NextResponse.json(
        { error: 'Invalid invite code' },
        { status: 404 }
      );
    }

    // Check if already a member
    const existing = await prisma.leagueMember.findUnique({
      where: {
        leagueId_userId: { leagueId: league.id, userId: user.id },
      },
    });

    if (existing) {
      return NextResponse.json(
        { error: 'You are already a member of this league' },
        { status: 409 }
      );
    }

    await prisma.leagueMember.create({
      data: {
        leagueId: league.id,
        userId: user.id,
      },
    });

    return NextResponse.json({
      league: {
        id: league.id,
        name: league.name,
      },
    }, { status: 201 });
  } catch (error) {
    console.error('Join league error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
