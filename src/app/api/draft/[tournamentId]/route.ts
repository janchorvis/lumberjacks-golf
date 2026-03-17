import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function getSnakeOrder(draftOrder: string[], round: number): string[] {
  const order = [...draftOrder];
  // Even rounds reverse the order (snake)
  if (round % 2 === 0) {
    order.reverse();
  }
  return order;
}

function getCurrentDrafter(
  draftOrder: string[],
  currentRound: number,
  currentPickIndex: number
): string | null {
  const roundOrder = getSnakeOrder(draftOrder, currentRound);
  const indexInRound = currentPickIndex % 4;
  return roundOrder[indexInRound] || null;
}

export async function GET(
  request: Request,
  { params }: { params: { tournamentId: string } }
) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const leagueId = searchParams.get('leagueId');

    // Find draft - if leagueId provided use it, otherwise find any draft for this tournament the user is in
    let draft;
    if (leagueId) {
      draft = await prisma.draft.findUnique({
        where: {
          leagueId_tournamentId: {
            leagueId,
            tournamentId: params.tournamentId,
          },
        },
        include: {
          picks: {
            include: {
              golfer: true,
              user: true,
            },
            orderBy: { pickNumber: 'asc' },
          },
          league: {
            include: {
              members: {
                include: { user: true },
              },
            },
          },
          tournament: {
            include: {
              field: {
                include: { golfer: true },
              },
            },
          },
        },
      });
    } else {
      // Find a draft for this tournament where the user is a member
      const memberLeagues = await prisma.leagueMember.findMany({
        where: { userId: user.id },
        select: { leagueId: true },
      });
      const leagueIds = memberLeagues.map((m) => m.leagueId);

      draft = await prisma.draft.findFirst({
        where: {
          tournamentId: params.tournamentId,
          leagueId: { in: leagueIds },
        },
        include: {
          picks: {
            include: {
              golfer: true,
              user: true,
            },
            orderBy: { pickNumber: 'asc' },
          },
          league: {
            include: {
              members: {
                include: { user: true },
              },
            },
          },
          tournament: {
            include: {
              field: {
                include: { golfer: true },
              },
            },
          },
        },
      });
    }

    if (!draft) {
      return NextResponse.json({ error: 'No draft found' }, { status: 404 });
    }

    const draftOrder: string[] = JSON.parse(draft.draftOrder);

    // Build player info map
    const players = draft.league.members.map((m) => ({
      userId: m.userId,
      username: m.user.username,
    }));

    // Build picks by round
    const picksByRound: Record<
      number,
      { userId: string; golferId: string; golferName: string; pickNumber: number }[]
    > = {};
    for (let r = 1; r <= 7; r++) {
      picksByRound[r] = [];
    }
    for (const pick of draft.picks) {
      picksByRound[pick.round].push({
        userId: pick.userId,
        golferId: pick.golferId,
        golferName: pick.golfer.name,
        pickNumber: pick.pickNumber,
      });
    }

    // Drafted golfer IDs
    const draftedGolferIds = new Set(draft.picks.map((p) => p.golferId));

    // Available golfers (in field, not drafted)
    const availableGolfers = draft.tournament.field
      .filter((f) => !draftedGolferIds.has(f.golferId))
      .map((f) => ({
        golferId: f.golferId,
        name: f.golfer.name,
        ranking: f.golfer.ranking,
        odds: f.odds ?? null,
      }))
      .sort((a, b) => (a.odds ?? 999999) - (b.odds ?? 999999));

    // Current drafter
    const currentDrafter =
      draft.status === 'active'
        ? getCurrentDrafter(draftOrder, draft.currentRound, draft.currentPickIndex)
        : null;

    // Build full snake order for display
    const fullSnakeOrder: { round: number; position: number; userId: string }[] = [];
    for (let r = 1; r <= 7; r++) {
      const roundOrder = getSnakeOrder(draftOrder, r);
      roundOrder.forEach((userId, idx) => {
        fullSnakeOrder.push({ round: r, position: idx, userId });
      });
    }

    return NextResponse.json({
      draft: {
        id: draft.id,
        leagueId: draft.leagueId,
        tournamentId: draft.tournamentId,
        tournamentName: draft.tournament.name,
        status: draft.status,
        currentRound: draft.currentRound,
        currentPickIndex: draft.currentPickIndex,
        draftOrder,
        players,
        picksByRound,
        availableGolfers,
        currentDrafter,
        totalPicks: draft.picks.length,
        fullSnakeOrder,
      },
    });
  } catch (error) {
    console.error('Error fetching draft:', error);
    return NextResponse.json({ error: 'Failed to fetch draft' }, { status: 500 });
  }
}
