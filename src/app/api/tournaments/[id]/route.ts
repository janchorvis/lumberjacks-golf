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

    const tournament = await prisma.tournament.findUnique({
      where: { id },
      include: {
        field: {
          include: {
            golfer: true,
          },
        },
        results: {
          include: {
            golfer: true,
          },
          orderBy: { position: 'asc' },
        },
      },
    });

    if (!tournament) {
      return NextResponse.json({ error: 'Tournament not found' }, { status: 404 });
    }

    return NextResponse.json({
      ...tournament,
      field: tournament.field.map((f) => ({
        id: f.id,
        golferId: f.golfer.id,
        golferName: f.golfer.name,
        ranking: f.golfer.ranking,
      })),
      results: tournament.results.map((r) => ({
        golferId: r.golfer.id,
        golferName: r.golfer.name,
        position: r.position,
        scoreToPar: r.scoreToPar,
        r1Score: r.r1Score,
        r2Score: r.r2Score,
        r3Score: r.r3Score,
        r4Score: r.r4Score,
        status: r.status,
        thru: r.thru,
      })),
    });
  } catch (error) {
    console.error('Tournament detail error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
