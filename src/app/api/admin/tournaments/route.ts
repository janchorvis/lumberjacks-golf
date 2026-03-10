import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';
import type { Tournament } from '@prisma/client';

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

    const { id, name, course, location, startDate, endDate, pickDeadline, seasonId, field } =
      await request.json();

    if (!name || !course || !location || !startDate || !endDate || !pickDeadline || !seasonId) {
      return NextResponse.json(
        { error: 'All tournament fields are required: name, course, location, startDate, endDate, pickDeadline, seasonId' },
        { status: 400 }
      );
    }

    // Verify season exists
    const season = await prisma.season.findUnique({ where: { id: seasonId } });
    if (!season) {
      return NextResponse.json({ error: 'Season not found' }, { status: 404 });
    }

    let tournament: Tournament;

    if (id) {
      // Update existing tournament
      tournament = await prisma.tournament.update({
        where: { id },
        data: {
          name,
          course,
          location,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          pickDeadline: new Date(pickDeadline),
          seasonId,
        },
      });

      // Update field if provided
      if (Array.isArray(field)) {
        await prisma.$transaction(async (tx) => {
          await tx.tournamentField.deleteMany({
            where: { tournamentId: id },
          });

          if (field.length > 0) {
            await tx.tournamentField.createMany({
              data: field.map((golferId: string) => ({
                tournamentId: id,
                golferId,
              })),
            });
          }
        });
      }
    } else {
      // Create new tournament
      tournament = await prisma.tournament.create({
        data: {
          name,
          course,
          location,
          startDate: new Date(startDate),
          endDate: new Date(endDate),
          pickDeadline: new Date(pickDeadline),
          seasonId,
        },
      });

      // Add field if provided
      if (Array.isArray(field) && field.length > 0) {
        await prisma.tournamentField.createMany({
          data: field.map((golferId: string) => ({
            tournamentId: tournament.id,
            golferId,
          })),
        });
      }
    }

    return NextResponse.json({ tournament }, { status: id ? 200 : 201 });
  } catch (error) {
    console.error('Admin tournament error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
