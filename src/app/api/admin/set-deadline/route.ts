import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'lumberjacks-cron-2026';

/**
 * POST /api/admin/set-deadline?secret=...
 * Body: { tournamentId: string, pickDeadline: string (ISO 8601) }
 * 
 * Sets the pick deadline for a tournament.
 * Called by Jarvis after looking up R1 first tee time each week.
 */
export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { tournamentId, pickDeadline } = await request.json();

    if (!tournamentId || !pickDeadline) {
      return NextResponse.json({ error: 'tournamentId and pickDeadline required' }, { status: 400 });
    }

    const deadline = new Date(pickDeadline);
    if (isNaN(deadline.getTime())) {
      return NextResponse.json({ error: 'Invalid pickDeadline format' }, { status: 400 });
    }

    const tournament = await prisma.tournament.update({
      where: { id: tournamentId },
      data: { pickDeadline: deadline },
      select: { id: true, name: true, pickDeadline: true, startDate: true },
    });

    return NextResponse.json({
      message: `Pick deadline set for ${tournament.name}`,
      tournament,
    });
  } catch (error) {
    console.error('Set deadline error:', error);
    return NextResponse.json({ error: 'Failed to set deadline' }, { status: 500 });
  }
}
