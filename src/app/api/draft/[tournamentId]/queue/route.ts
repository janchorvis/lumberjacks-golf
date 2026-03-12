import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

// GET — fetch current user's auto-draft queue for this tournament
export async function GET(
  _req: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const draft = await prisma.draft.findFirst({
    where: { tournamentId: params.tournamentId },
  });
  if (!draft) return NextResponse.json({ queue: null });

  const queue = await prisma.autoDraftQueue.findUnique({
    where: { draftId_userId: { draftId: draft.id, userId: user.id } },
  });

  return NextResponse.json({
    queue: queue
      ? { enabled: queue.enabled, golferIds: JSON.parse(queue.queueOrder) }
      : { enabled: false, golferIds: [] },
  });
}

// PUT — save queue (and enable autodraft)
export async function PUT(
  req: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { golferIds, enabled } = await req.json() as {
    golferIds?: string[];
    enabled?: boolean;
  };

  const draft = await prisma.draft.findFirst({
    where: { tournamentId: params.tournamentId },
  });
  if (!draft) return NextResponse.json({ error: 'No draft found' }, { status: 404 });

  const queue = await prisma.autoDraftQueue.upsert({
    where: { draftId_userId: { draftId: draft.id, userId: user.id } },
    create: {
      draftId: draft.id,
      userId: user.id,
      enabled: enabled ?? true,
      queueOrder: JSON.stringify(golferIds ?? []),
    },
    update: {
      ...(golferIds !== undefined && { queueOrder: JSON.stringify(golferIds) }),
      ...(enabled !== undefined && { enabled }),
    },
  });

  return NextResponse.json({
    queue: { enabled: queue.enabled, golferIds: JSON.parse(queue.queueOrder) },
  });
}

// DELETE — clear queue / disable
export async function DELETE(
  _req: NextRequest,
  { params }: { params: { tournamentId: string } }
) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const draft = await prisma.draft.findFirst({
    where: { tournamentId: params.tournamentId },
  });
  if (!draft) return NextResponse.json({ ok: true });

  await prisma.autoDraftQueue.deleteMany({
    where: { draftId: draft.id, userId: user.id },
  });

  return NextResponse.json({ ok: true });
}
