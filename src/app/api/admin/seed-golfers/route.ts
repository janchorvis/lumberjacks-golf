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
    if (!user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const { golfers } = await request.json();

    if (!Array.isArray(golfers) || golfers.length === 0) {
      return NextResponse.json(
        { error: 'golfers array is required and must not be empty' },
        { status: 400 }
      );
    }

    const created = await prisma.golfer.createMany({
      data: golfers.map((g: { name: string; ranking?: number }) => ({
        name: g.name,
        ranking: g.ranking ?? null,
      })),
      skipDuplicates: true,
    });

    return NextResponse.json({
      success: true,
      count: created.count,
    }, { status: 201 });
  } catch (error) {
    console.error('Seed golfers error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
