import { PrismaClient } from '@prisma/client';
import fs from 'node:fs';

const prisma = new PrismaClient();
const TOURNAMENT_ID = 'cmml7bkw0000kxihqj1b2cwxi';
const LEAGUE_NAME = 'Lumberjacks';
const ESPN_ID = '401811957';

// Covers' live opening-odds table, retrieved July 12, 2026. The remaining
// field members are intentionally left without odds rather than guessed.
const odds: Record<string, number> = {
  'Scottie Scheffler': 400,
  'Rory McIlroy': 900,
  'Jon Rahm': 1400,
  'Bryson DeChambeau': 1800,
  'Ludvig Åberg': 2000,
  'Tommy Fleetwood': 2000,
  'Xander Schauffele': 2000,
  'Robert MacIntyre': 3000,
  'Tyrrell Hatton': 3000,
  'Collin Morikawa': 3500,
  'Viktor Hovland': 3500,
};

type PgaPlayer = { firstName: string; lastName: string; owgr: string | null; status: string };

async function main() {
  const source = JSON.parse(fs.readFileSync('/tmp/field.json', 'utf8')) as { players: PgaPlayer[] };
  const players = source.players.filter((p) => p.status === 'IN');
  const names = players.map((p) => `${p.firstName} ${p.lastName}`);
  if (new Set(names).size !== names.length) throw new Error('Duplicate field names in PGA Tour source');
  if (players.length < 140) throw new Error(`Unexpectedly small Open field: ${players.length}`);

  const tournament = await prisma.tournament.findUnique({ where: { id: TOURNAMENT_ID } });
  if (!tournament) throw new Error(`Tournament not found: ${TOURNAMENT_ID}`);
  const league = await prisma.league.findFirst({ where: { name: LEAGUE_NAME }, include: { members: { include: { user: true } } } });
  if (!league || league.members.length !== 4) throw new Error(`Expected Lumberjacks league with 4 members`);

  const priorResults = await prisma.weeklyResult.findMany({
    where: { leagueId: league.id, tournament: { name: 'U.S. Open' } },
    include: { user: true },
    orderBy: { rank: 'desc' },
  });
  if (priorResults.length !== 4) throw new Error(`Expected 4 U.S. Open results, found ${priorResults.length}`);
  const draftOrder = priorResults.map((r) => r.userId);

  await prisma.tournament.updateMany({ where: { startDate: { lt: tournament.startDate } }, data: { isComplete: true } });
  await prisma.tournament.update({ where: { id: TOURNAMENT_ID }, data: {
    name: 'The Open Championship', course: 'Royal Birkdale Golf Club', location: 'Southport, England',
    externalId: ESPN_ID, startDate: new Date('2026-07-16T07:00:00.000Z'), endDate: new Date('2026-07-19T23:59:59.000Z'),
    pickDeadline: new Date('2026-07-16T09:55:00.000Z'), isComplete: false,
  } });

  const existing = await prisma.golfer.findMany({ where: { name: { in: names } } });
  const existingNames = new Set(existing.map((g) => g.name));
  await prisma.golfer.createMany({ data: players.filter((p) => !existingNames.has(`${p.firstName} ${p.lastName}`)).map((p) => ({
    name: `${p.firstName} ${p.lastName}`, ranking: p.owgr ? Number(p.owgr) : null,
  })) });
  const golfers = await prisma.golfer.findMany({ where: { name: { in: names } } });
  const byName = new Map(golfers.map((g) => [g.name, g]));
  await prisma.tournamentField.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  await prisma.tournamentField.createMany({ data: players.map((p) => {
    const name = `${p.firstName} ${p.lastName}`;
    const golfer = byName.get(name);
    if (!golfer) throw new Error(`Golfer missing after batch create: ${name}`);
    return { tournamentId: TOURNAMENT_ID, golferId: golfer.id, odds: odds[name] ?? null };
  }) });

  const draft = await prisma.draft.upsert({
    where: { leagueId_tournamentId: { leagueId: league.id, tournamentId: TOURNAMENT_ID } },
    update: { status: 'active', currentRound: 1, currentPickIndex: 0, draftOrder: JSON.stringify(draftOrder) },
    create: { leagueId: league.id, tournamentId: TOURNAMENT_ID, status: 'active', currentRound: 1, currentPickIndex: 0, draftOrder: JSON.stringify(draftOrder) },
  });
  const count = await prisma.tournamentField.count({ where: { tournamentId: TOURNAMENT_ID } });
  const oddsCount = await prisma.tournamentField.count({ where: { tournamentId: TOURNAMENT_ID, odds: { not: null } } });
  console.log(JSON.stringify({ tournamentId: TOURNAMENT_ID, externalId: ESPN_ID, draftId: draft.id, fieldCount: count, oddsCount, draftOrder: priorResults.map((r) => r.user.username), pickDeadline: '2026-07-16T09:55:00.000Z' }, null, 2));
}

main().finally(() => prisma.$disconnect());
