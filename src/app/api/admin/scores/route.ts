import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

interface ScoreInput {
  golferName: string;
  r1?: number | null;
  r2?: number | null;
  r3?: number | null;
  r4?: number | null;
  status?: string;
}

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, '')
    .trim();
}

function fuzzyMatch(input: string, candidate: string): number {
  const a = normalize(input);
  const b = normalize(candidate);

  if (a === b) return 1;
  if (b.includes(a) || a.includes(b)) return 0.9;

  // Compare last names
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  const aLast = aWords[aWords.length - 1];
  const bLast = bWords[bWords.length - 1];

  if (aLast === bLast) return 0.8;

  // Check if any word matches
  for (const w of aWords) {
    if (w.length > 2 && bWords.includes(w)) return 0.6;
  }

  return 0;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { tournamentId, scores } = body as {
      tournamentId: string;
      scores: ScoreInput[];
    };

    if (!tournamentId || !scores || !Array.isArray(scores)) {
      return NextResponse.json(
        { error: 'tournamentId and scores array required' },
        { status: 400 }
      );
    }

    // Get golfers from tournament field if available, otherwise fall back to all golfers
    const fieldEntries = await prisma.tournamentField.findMany({
      where: { tournamentId },
      include: { golfer: true },
    });

    let golferPool: { golferId: string; golferName: string }[];

    if (fieldEntries.length > 0) {
      golferPool = fieldEntries.map((e) => ({
        golferId: e.golfer.id,
        golferName: e.golfer.name,
      }));
    } else {
      // Fall back to all golfers in the database
      const allGolfers = await prisma.golfer.findMany({
        select: { id: true, name: true },
      });
      golferPool = allGolfers.map((g) => ({
        golferId: g.id,
        golferName: g.name,
      }));
    }

    const results: { golferName: string; matched: string | null; status: string }[] = [];

    for (const score of scores) {
      // Fuzzy match golfer name
      let bestMatch: { golferId: string; golferName: string } | null = null;
      let bestScore = 0;

      for (const entry of golferPool) {
        const matchScore = fuzzyMatch(score.golferName, entry.golferName);
        if (matchScore > bestScore) {
          bestScore = matchScore;
          bestMatch = entry;
        }
      }

      if (!bestMatch || bestScore < 0.5) {
        results.push({
          golferName: score.golferName,
          matched: null,
          status: 'not_found',
        });
        continue;
      }

      // Calculate scoreToPar from round scores
      // Assume par 72 per round
      const roundScores = [score.r1, score.r2, score.r3, score.r4].filter(
        (s): s is number => s != null
      );
      const scoreToPar =
        roundScores.length > 0
          ? roundScores.reduce((sum, s) => sum + (s - 72), 0)
          : null;

      // Upsert TournamentResult
      await prisma.tournamentResult.upsert({
        where: {
          tournamentId_golferId: {
            tournamentId,
            golferId: bestMatch.golferId,
          },
        },
        create: {
          tournamentId,
          golferId: bestMatch.golferId,
          r1Score: score.r1 ?? null,
          r2Score: score.r2 ?? null,
          r3Score: score.r3 ?? null,
          r4Score: score.r4 ?? null,
          scoreToPar,
          status: score.status || 'active',
        },
        update: {
          r1Score: score.r1 ?? null,
          r2Score: score.r2 ?? null,
          r3Score: score.r3 ?? null,
          r4Score: score.r4 ?? null,
          scoreToPar,
          status: score.status || 'active',
        },
      });

      results.push({
        golferName: score.golferName,
        matched: bestMatch.golferName,
        status: 'updated',
      });
    }

    const updated = results.filter((r) => r.status === 'updated').length;
    const notFound = results.filter((r) => r.status === 'not_found').length;

    return NextResponse.json({
      message: `Processed ${scores.length} scores: ${updated} updated, ${notFound} not found`,
      results,
    });
  } catch (error) {
    console.error('Admin scores error:', error);
    return NextResponse.json(
      { error: 'Failed to process scores' },
      { status: 500 }
    );
  }
}
