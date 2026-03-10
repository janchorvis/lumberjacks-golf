import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    // Find the next upcoming or in-progress tournament
    const tournament = await prisma.tournament.findFirst({
      where: {
        isComplete: false,
        season: { isActive: true },
      },
      orderBy: { startDate: 'asc' },
      include: {
        field: {
          include: { golfer: true },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ tournament: null });
    }

    return NextResponse.json({
      tournament: {
        ...tournament,
        field: tournament.field.map((f) => ({
          id: f.id,
          golferId: f.golfer.id,
          golferName: f.golfer.name,
          ranking: f.golfer.ranking,
        })),
      },
    });
  } catch (error) {
    console.error('Current tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
