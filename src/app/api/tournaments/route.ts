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

    const activeSeason = await prisma.season.findFirst({
      where: { isActive: true },
      include: {
        tournaments: {
          orderBy: { startDate: 'asc' },
        },
      },
    });

    if (!activeSeason) {
      return NextResponse.json({ season: null, tournaments: [] });
    }

    return NextResponse.json({
      season: {
        id: activeSeason.id,
        name: activeSeason.name,
        year: activeSeason.year,
      },
      tournaments: activeSeason.tournaments,
    });
  } catch (error) {
    console.error('Tournaments list error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
