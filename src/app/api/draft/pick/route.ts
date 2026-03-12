import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

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

// Perform a single auto-pick: find top available golfer from queue, make the pick
// Returns updated draft state or null if can't auto-pick
async function performAutoPick(
  draftId: string,
  userId: string,
  fieldGolferIds: string[],
  pickedGolferIds: Set<string>,
  currentPickIndex: number,
  currentRound: number,
  draftOrder: string[],
  leagueId: string,
  tournamentId: string,
  totalPicks: number
): Promise<{ newPickIndex: number; newRound: number; status: string; pickedGolferId: string } | null> {
  // Load user's queue
  const queueEntry = await prisma.autoDraftQueue.findUnique({
    where: { draftId_userId: { draftId, userId } },
  });

  if (!queueEntry || !queueEntry.enabled) return null;

  const queueOrder: string[] = JSON.parse(queueEntry.queueOrder);

  // Find first available golfer from queue
  let selectedGolferId: string | null = null;

  for (const gid of queueOrder) {
    if (fieldGolferIds.includes(gid) && !pickedGolferIds.has(gid)) {
      selectedGolferId = gid;
      break;
    }
  }

  // Fallback: pick highest-ranked available golfer not in queue
  if (!selectedGolferId) {
    const available = await prisma.golfer.findMany({
      where: {
        id: { in: fieldGolferIds.filter(id => !pickedGolferIds.has(id)) },
        ranking: { not: null },
      },
      orderBy: { ranking: 'asc' },
      take: 1,
    });
    selectedGolferId = available[0]?.id ?? null;
  }

  // Last resort: any available golfer
  if (!selectedGolferId) {
    const remaining = fieldGolferIds.find(id => !pickedGolferIds.has(id));
    selectedGolferId = remaining ?? null;
  }

  if (!selectedGolferId) return null;

  const pickNumber = pickedGolferIds.size + 1;
  const newPickIndex = currentPickIndex + 1;
  const isLastPick = pickNumber === totalPicks;
  const isRoundComplete = newPickIndex % draftOrder.length === 0;
  const newRound = isRoundComplete && !isLastPick ? currentRound + 1 : currentRound;
  const status = isLastPick ? 'complete' : 'active';

  await prisma.$transaction(async (tx) => {
    await tx.draftPick.create({
      data: { draftId, userId, golferId: selectedGolferId!, round: currentRound, pickNumber },
    });
    await tx.draft.update({
      where: { id: draftId },
      data: { currentRound: newRound, currentPickIndex: newPickIndex, status },
    });

    if (status === 'complete') {
      const allPicks = await tx.draftPick.findMany({
        where: { draftId },
        orderBy: { pickNumber: 'asc' },
      });
      const picksByUser: Record<string, typeof allPicks> = {};
      for (const p of allPicks) {
        if (!picksByUser[p.userId]) picksByUser[p.userId] = [];
        picksByUser[p.userId].push(p);
      }
      await tx.pick.deleteMany({ where: { leagueId, tournamentId } });
      for (const [uid, userPicks] of Object.entries(picksByUser)) {
        for (let i = 0; i < userPicks.length; i++) {
          await tx.pick.create({
            data: { leagueId, userId: uid, tournamentId, golferId: userPicks[i].golferId, pickOrder: i + 1 },
          });
        }
      }
    }
  });

  return { newPickIndex, newRound, status, pickedGolferId: selectedGolferId };
}

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { draftId, golferId } = await request.json();
    if (!draftId || !golferId) {
      return NextResponse.json({ error: 'draftId and golferId are required' }, { status: 400 });
    }

    const draft = await prisma.draft.findUnique({
      where: { id: draftId },
      include: {
        picks: true,
        tournament: { include: { field: true } },
        league: { include: { members: true } },
      },
    });

    if (!draft) return NextResponse.json({ error: 'Draft not found' }, { status: 404 });
    if (draft.status !== 'active') return NextResponse.json({ error: 'Draft is not active' }, { status: 400 });

    const draftOrder: string[] = JSON.parse(draft.draftOrder);
    const roundOrder = getSnakeOrder(draftOrder, draft.currentRound);
    const indexInRound = draft.currentPickIndex % draftOrder.length;
    const expectedUserId = roundOrder[indexInRound];

    if (user.id !== expectedUserId) {
      return NextResponse.json({ error: 'It is not your turn to pick' }, { status: 403 });
    }

    const fieldGolferIds = draft.tournament.field.map(f => f.golferId);
    const inField = fieldGolferIds.includes(golferId);
    if (!inField) return NextResponse.json({ error: 'Golfer is not in the tournament field' }, { status: 400 });

    const alreadyDrafted = draft.picks.some(p => p.golferId === golferId);
    if (alreadyDrafted) return NextResponse.json({ error: 'Golfer has already been drafted' }, { status: 400 });

    const pickNumber = draft.picks.length + 1;
    const newPickIndex = draft.currentPickIndex + 1;
    const isLastPick = pickNumber === 28;
    const isRoundComplete = newPickIndex % draftOrder.length === 0;
    const nextRound = isRoundComplete && !isLastPick ? draft.currentRound + 1 : draft.currentRound;
    const nextStatus = isLastPick ? 'complete' : 'active';

    const result = await prisma.$transaction(async (tx) => {
      const pick = await tx.draftPick.create({
        data: { draftId: draft.id, userId: user.id, golferId, round: draft.currentRound, pickNumber },
      });
      const updatedDraft = await tx.draft.update({
        where: { id: draft.id },
        data: { currentRound: nextRound, currentPickIndex: newPickIndex, status: nextStatus },
      });

      if (nextStatus === 'complete') {
        const allPicks = await tx.draftPick.findMany({
          where: { draftId: draft.id },
          orderBy: { pickNumber: 'asc' },
        });
        const allWithCurrent = allPicks.find(p => p.id === pick.id) ? allPicks : [...allPicks, pick];
        const picksByUser: Record<string, typeof allWithCurrent> = {};
        for (const p of allWithCurrent) {
          if (!picksByUser[p.userId]) picksByUser[p.userId] = [];
          picksByUser[p.userId].push(p);
        }
        await tx.pick.deleteMany({ where: { leagueId: draft.leagueId, tournamentId: draft.tournamentId } });
        for (const [uid, userPicks] of Object.entries(picksByUser)) {
          for (let i = 0; i < userPicks.length; i++) {
            await tx.pick.create({
              data: { leagueId: draft.leagueId, userId: uid, tournamentId: draft.tournamentId, golferId: userPicks[i].golferId, pickOrder: i + 1 },
            });
          }
        }
      }
      return { pick, updatedDraft };
    });

    // Auto-draft cascade: keep picking for users with auto-queue enabled
    let cascadePickIndex = newPickIndex;
    let cascadeRound = nextRound;
    let cascadeStatus = nextStatus;
    const pickedIds = new Set<string>([...draft.picks.map(p => p.golferId), golferId]);
    const autoPicks: { username: string; golferName: string }[] = [];

    while (cascadeStatus === 'active') {
      const { userId: nextUserId } = getNextDrafter(draftOrder, cascadePickIndex);
      const autoPick = await performAutoPick(
        draft.id, nextUserId, fieldGolferIds, pickedIds,
        cascadePickIndex, cascadeRound, draftOrder,
        draft.leagueId, draft.tournamentId, 28
      );
      if (!autoPick) break;

      pickedIds.add(autoPick.pickedGolferId);
      cascadePickIndex = autoPick.newPickIndex;
      cascadeRound = autoPick.newRound;
      cascadeStatus = autoPick.status;

      const golfer = await prisma.golfer.findUnique({ where: { id: autoPick.pickedGolferId } });
      const nextUser = await prisma.user.findUnique({ where: { id: nextUserId } });
      if (golfer && nextUser) {
        autoPicks.push({ username: nextUser.username, golferName: golfer.name });
      }
    }

    return NextResponse.json({
      pick: result.pick,
      draft: {
        status: cascadeStatus,
        currentRound: cascadeRound,
        currentPickIndex: cascadePickIndex,
      },
      autoPicks, // list of auto-picks that cascaded
    });
  } catch (error) {
    console.error('Error making draft pick:', error);
    return NextResponse.json({ error: 'Failed to make pick' }, { status: 500 });
  }
}
