import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'lumberjacks-cron-2026';

function getSnakeOrder(draftOrder: string[], round: number): string[] {
  const order = [...draftOrder];
  if (round % 2 === 0) order.reverse();
  return order;
}

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const draft = await prisma.draft.findFirst({
      where: {
        status: 'active',
        tournament: {
          isComplete: false,
          season: { isActive: true },
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        league: {
          include: {
            members: {
              include: { user: true },
            },
          },
        },
        tournament: true,
        picks: {
          orderBy: { pickNumber: 'asc' },
          include: {
            user: true,
            golfer: true,
          },
        },
      },
    });

    if (!draft) {
      return NextResponse.json({ active: false, draft: null });
    }

    const draftOrder: string[] = JSON.parse(draft.draftOrder);
    const roundOrder = getSnakeOrder(draftOrder, draft.currentRound);
    const indexInRound = draft.currentPickIndex % draftOrder.length;
    const currentDrafterId = roundOrder[indexInRound] || null;
    const membersById = new Map(
      draft.league.members.map((member) => [
        member.userId,
        {
          userId: member.userId,
          username: member.user.username,
          email: member.user.email,
        },
      ])
    );

    const currentDrafter = currentDrafterId ? membersById.get(currentDrafterId) ?? null : null;
    const lastPick = draft.picks.length > 0 ? draft.picks[draft.picks.length - 1] : null;

    return NextResponse.json({
      active: true,
      draft: {
        id: draft.id,
        status: draft.status,
        currentRound: draft.currentRound,
        currentPickIndex: draft.currentPickIndex,
        pickNumber: draft.picks.length + 1,
        totalPicks: draft.league.members.length * 7,
        draftOrder: draftOrder.map((userId) => membersById.get(userId) ?? { userId, username: userId, email: null }),
        currentDrafter,
        lastPick: lastPick
          ? {
              id: lastPick.id,
              pickNumber: lastPick.pickNumber,
              round: lastPick.round,
              drafter: {
                userId: lastPick.userId,
                username: lastPick.user.username,
                email: lastPick.user.email,
              },
              golfer: {
                id: lastPick.golferId,
                name: lastPick.golfer.name,
              },
            }
          : null,
        tournament: {
          id: draft.tournament.id,
          name: draft.tournament.name,
          pickDeadline: draft.tournament.pickDeadline,
        },
        league: {
          id: draft.league.id,
          name: draft.league.name,
        },
      },
    });
  } catch (error) {
    console.error('Draft status error:', error);
    return NextResponse.json({ error: 'Failed to fetch draft status' }, { status: 500 });
  }
}
