import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { getCurrentUser } from '@/lib/auth';

export const dynamic = 'force-dynamic';

const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';

function parseScoreToPar(display: string): number {
  if (!display || display === 'E') return 0;
  const n = parseInt(display.replace('+', ''), 10);
  return isNaN(n) ? 0 : n;
}

function parseStatus(espnStatus: string | undefined): string {
  if (!espnStatus) return 'active';
  const s = espnStatus.toLowerCase();
  if (s.includes('cut') || s.includes('mc')) return 'cut';
  if (s.includes('wd') || s.includes('withdrew')) return 'wd';
  if (s.includes('dq') || s.includes('disqualif')) return 'dq';
  return 'active';
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
  const aWords = a.split(/\s+/);
  const bWords = b.split(/\s+/);
  const aLast = aWords[aWords.length - 1];
  const bLast = bWords[bWords.length - 1];
  if (aLast === bLast) return 0.8;
  for (const w of aWords) {
    if (w.length > 2 && bWords.includes(w)) return 0.6;
  }
  return 0;
}

export async function POST(request: NextRequest) {
  // Allow cron secret (header or query param) or admin user
  const authHeader = request.headers.get('authorization');
  const { searchParams } = new URL(request.url);
  const querySecret = searchParams.get('secret');
  const cronSecret = process.env.CRON_SECRET;
  const isCron = cronSecret && (
    authHeader === `Bearer ${cronSecret}` ||
    querySecret === cronSecret
  );

  if (!isCron) {
    const user = await getCurrentUser();
    if (!user || !user.isAdmin) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 403 });
    }
  }

  try {
    // Find active (non-complete) tournament with an ESPN externalId
    const tournament = await prisma.tournament.findFirst({
      where: { isComplete: false, externalId: { not: null } },
      orderBy: { startDate: 'asc' },
    });

    if (!tournament) {
      return NextResponse.json({ message: 'No active tournament with ESPN ID found' });
    }

    // Fetch ESPN scoreboard
    const res = await fetch(ESPN_SCOREBOARD, { next: { revalidate: 0 } });
    if (!res.ok) throw new Error(`ESPN fetch failed: ${res.status}`);
    const data = await res.json();

    const espnEvent = data.events?.find(
      (e: { id: string }) => e.id === tournament.externalId
    );

    if (!espnEvent) {
      return NextResponse.json({
        message: `ESPN event ${tournament.externalId} not found in scoreboard`,
      });
    }

    const competition = espnEvent.competitions?.[0];
    if (!competition) {
      return NextResponse.json({ message: 'No competition data in ESPN event' });
    }

    const competitors: {
      id?: string;
      athlete: { displayName: string };
      score: string;
      status?: string;
      order?: number;
      linescores?: { period: number; value?: number; displayValue?: string }[];
    }[] = competition.competitors ?? [];

    // Load tournament field for fuzzy matching
    const fieldEntries = await prisma.tournamentField.findMany({
      where: { tournamentId: tournament.id },
      include: { golfer: true },
    });

    const golferPool = fieldEntries.map((e) => ({
      golferId: e.golfer.id,
      golferName: e.golfer.name,
    }));

    let notFound = 0;

    // Build all upsert data first (pure JS, no DB calls)
    type UpsertData = {
      golferId: string;
      r1Score: number | null;
      r2Score: number | null;
      r3Score: number | null;
      r4Score: number | null;
      scoreToPar: number;
      status: string;
      position: number | null;
      thru: number | null;
    };
    const toUpsert: UpsertData[] = [];

    for (const comp of competitors) {
      const name = comp.athlete?.displayName;
      if (!name) continue;

      // Fuzzy match to golfer in field
      let bestMatch: { golferId: string; golferName: string } | null = null;
      let bestScore = 0;
      for (const entry of golferPool) {
        const score = fuzzyMatch(name, entry.golferName);
        if (score > bestScore) {
          bestScore = score;
          bestMatch = entry;
        }
      }

      if (!bestMatch || bestScore < 0.5) {
        notFound++;
        continue;
      }

      // Parse round scores from linescores
      const rounds: Record<number, number | null> = { 1: null, 2: null, 3: null, 4: null };
      for (const ls of comp.linescores ?? []) {
        if (ls.period >= 1 && ls.period <= 4) {
          const strokes = ls.displayValue ? parseInt(ls.displayValue, 10) : null;
          rounds[ls.period] = strokes && !isNaN(strokes) ? strokes : null;
        }
      }

      const completedRounds = (comp.linescores ?? []).filter(ls => ls.displayValue).length;

      toUpsert.push({
        golferId: bestMatch.golferId,
        r1Score: rounds[1],
        r2Score: rounds[2],
        r3Score: rounds[3],
        r4Score: rounds[4],
        scoreToPar: parseScoreToPar(comp.score),
        status: parseStatus(comp.status),
        position: comp.order ?? null,
        thru: completedRounds > 0 ? 18 : null,
      });
    }

    // Batch upsert in a single transaction
    await prisma.$transaction(
      toUpsert.map((d) =>
        prisma.tournamentResult.upsert({
          where: { tournamentId_golferId: { tournamentId: tournament.id, golferId: d.golferId } },
          create: { tournamentId: tournament.id, ...d },
          update: d,
        })
      )
    );

    return NextResponse.json({
      message: `Synced ${toUpsert.length} golfers from ESPN (${notFound} not matched)`,
      tournament: tournament.name,
      espnEvent: espnEvent.name,
      updated: toUpsert.length,
      notFound,
    });
  } catch (error) {
    console.error('ESPN sync error:', error);
    return NextResponse.json({ error: String(error) }, { status: 500 });
  }
}

// Also allow GET for easy manual trigger from browser
export async function GET(request: NextRequest) {
  return POST(request);
}
