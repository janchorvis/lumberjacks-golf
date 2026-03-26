import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET || 'lumberjacks-cron-2026';

function getSnakeOrder(draftOrder: string[], round: number): string[] {
  const order = [...draftOrder];
  if (round % 2 === 0) order.reverse();
  return order;
}

function getNextDrafter(draftOrder: string[], pickIndex: number): { userId: string; round: number } {
  const totalPlayers = draftOrder.length;
  const round = Math.floor(pickIndex / totalPlayers) + 1;
  const roundOrder = getSnakeOrder(draftOrder, round);
  const indexInRound = pickIndex % totalPlayers;
  return { userId: roundOrder[indexInRound], round };
}

export async function POST(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get('secret');
  if (secret !== CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    // Find tournaments past their pick deadline with active drafts
    const now = new Date();
    const activeDrafts = await prisma.draft.findMany({
      where: {
        status: 'active',
        tournament: { pickDeadline: { lte: now } },
      },
      include: {
        picks: true,
        tournament: {
          include: {
            field: {
              include: { golfer: true },
            },
          },
        },
        league: { include: { members: { include: { user: true } } } },
      },
    });

    if (activeDrafts.length === 0) {
      return NextResponse.json({ message: 'No drafts need auto-completing', drafts: [] });
    }

    const results = [];

    for (const draft of activeDrafts) {
      const draftOrder: string[] = JSON.parse(draft.draftOrder);
      const totalPicks = draftOrder.length * 7; // 4 members × 7 picks
      const fieldGolferIds = draft.tournament.field.map(f => f.golferId);
      const pickedIds = new Set(draft.picks.map(p => p.golferId));
      const autoPicks: { username: string; golferName: string; round: number }[] = [];

      let pickIndex = draft.currentPickIndex;
      let currentRound = draft.currentRound;
      let status = draft.status;

      // Build odds lookup for fallback ordering
      const oddsMap = new Map<string, number>();
      for (const f of draft.tournament.field) {
        if (f.odds !== null) oddsMap.set(f.golferId, f.odds);
      }

      while (status === 'active' && pickedIds.size < totalPicks) {
        const { userId } = getNextDrafter(draftOrder, pickIndex);

        // Try user's queue first
        const queueEntry = await prisma.autoDraftQueue.findUnique({
          where: { draftId_userId: { draftId: draft.id, userId } },
        }).catch(() => null);

        let selectedGolferId: string | null = null;

        // Check queue (regardless of enabled flag - deadline forces it)
        if (queueEntry) {
          const queueOrder: string[] = JSON.parse(queueEntry.queueOrder);
          for (const gid of queueOrder) {
            if (fieldGolferIds.includes(gid) && !pickedIds.has(gid)) {
              selectedGolferId = gid;
              break;
            }
          }
        }

        // Fallback: pick by betting odds (lowest odds = best)
        if (!selectedGolferId) {
          const availableWithOdds = fieldGolferIds
            .filter(id => !pickedIds.has(id) && oddsMap.has(id))
            .sort((a, b) => oddsMap.get(a)! - oddsMap.get(b)!);

          if (availableWithOdds.length > 0) {
            selectedGolferId = availableWithOdds[0];
          }
        }

        // Second fallback: by world ranking
        if (!selectedGolferId) {
          const available = await prisma.golfer.findMany({
            where: {
              id: { in: fieldGolferIds.filter(id => !pickedIds.has(id)) },
              ranking: { not: null },
            },
            orderBy: { ranking: 'asc' },
            take: 1,
          });
          selectedGolferId = available[0]?.id ?? null;
        }

        // Last resort: any available
        if (!selectedGolferId) {
          selectedGolferId = fieldGolferIds.find(id => !pickedIds.has(id)) ?? null;
        }

        if (!selectedGolferId) break; // no golfers left

        const pickNumber = pickedIds.size + 1;
        const newPickIndex = pickIndex + 1;
        const isLastPick = pickNumber === totalPicks;
        const isRoundComplete = newPickIndex % draftOrder.length === 0;
        const newRound = isRoundComplete && !isLastPick ? currentRound + 1 : currentRound;
        const newStatus = isLastPick ? 'complete' : 'active';

        await prisma.$transaction(async (tx) => {
          await tx.draftPick.create({
            data: {
              draftId: draft.id,
              userId,
              golferId: selectedGolferId!,
              round: currentRound,
              pickNumber,
            },
          });
          await tx.draft.update({
            where: { id: draft.id },
            data: {
              currentRound: newRound,
              currentPickIndex: newPickIndex,
              status: newStatus,
            },
          });

          // If complete, copy picks to Pick table
          if (newStatus === 'complete') {
            const allPicks = await tx.draftPick.findMany({
              where: { draftId: draft.id },
              orderBy: { pickNumber: 'asc' },
            });
            const picksByUser: Record<string, typeof allPicks> = {};
            for (const p of allPicks) {
              if (!picksByUser[p.userId]) picksByUser[p.userId] = [];
              picksByUser[p.userId].push(p);
            }
            await tx.pick.deleteMany({
              where: { leagueId: draft.leagueId, tournamentId: draft.tournamentId },
            });
            for (const [uid, userPicks] of Object.entries(picksByUser)) {
              for (let i = 0; i < userPicks.length; i++) {
                await tx.pick.create({
                  data: {
                    leagueId: draft.leagueId,
                    userId: uid,
                    tournamentId: draft.tournamentId,
                    golferId: userPicks[i].golferId,
                    pickOrder: i + 1,
                  },
                });
              }
            }
          }
        });

        pickedIds.add(selectedGolferId);
        pickIndex = newPickIndex;
        currentRound = newRound;
        status = newStatus;

        const golfer = draft.tournament.field.find(f => f.golferId === selectedGolferId)?.golfer;
        const member = draft.league.members.find(m => m.userId === userId);
        autoPicks.push({
          username: member?.user?.username ?? userId,
          golferName: golfer?.name ?? selectedGolferId,
          round: currentRound,
        });
      }

      results.push({
        draftId: draft.id,
        tournament: draft.tournament.name,
        previousPicks: draft.picks.length,
        autoPicksMade: autoPicks.length,
        finalStatus: status,
        autoPicks,
      });
    }

    return NextResponse.json({ message: 'Auto-complete finished', results });
  } catch (error) {
    console.error('Auto-complete draft error:', error);
    return NextResponse.json({ error: 'Failed to auto-complete' }, { status: 500 });
  }
}
