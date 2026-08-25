import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TOURNAMENT_NAME = 'TOUR Championship';
const ESPN_ID = '401811964';
const START = new Date('2026-08-27T07:00:00.000Z');
const END = new Date('2026-08-30T23:59:59.000Z');
// Official first tee time is 11:00 AM EDT. Lock picks five minutes early.
const PICK_DEADLINE = new Date('2026-08-27T14:55:00.000Z');

// Official 30-player field after the BMW Championship, verified 2026-08-24.
const field = [
  'Scottie Scheffler','Matt Fitzpatrick','Wyndham Clark','Cameron Young','Si Woo Kim',
  'Chris Gotterup','Collin Morikawa','Sam Burns','Tommy Fleetwood','Ludvig Åberg',
  'Rory McIlroy','Xander Schauffele','Jacob Bridgeman','Russell Henley','Akshay Bhatia',
  'Hideki Matsuyama','Ryan Gerard','Gary Woodland','Patrick Cantlay','Kristoffer Reitan',
  'Min Woo Lee','J.J. Spaun','Alex Smalley','Alex Fitzpatrick','Robert MacIntyre',
  'Viktor Hovland','Justin Rose','Adam Scott','Tom Kim','Ryan Fox',
] as const;

// DraftKings full-field outright odds published by GOLF on 2026-08-24.
const odds: Record<string, number> = {
  'Scottie Scheffler':320,'Rory McIlroy':850,'Ludvig Åberg':1400,
  'Xander Schauffele':1475,'Wyndham Clark':1475,'Sam Burns':1475,
  'Cameron Young':1600,'Matt Fitzpatrick':1650,'Patrick Cantlay':1750,
  'Tommy Fleetwood':1850,'Chris Gotterup':1950,'Collin Morikawa':2150,
  'Si Woo Kim':2300,'Russell Henley':2500,'Viktor Hovland':2700,
  'Hideki Matsuyama':3100,'J.J. Spaun':3800,'Ryan Gerard':4200,
  'Jacob Bridgeman':4300,'Robert MacIntyre':4300,'Min Woo Lee':4600,
  'Justin Rose':4600,'Tom Kim':5000,'Adam Scott':5000,
  'Alex Smalley':5700,'Kristoffer Reitan':6000,'Gary Woodland':6000,
  'Alex Fitzpatrick':7600,'Ryan Fox':8200,'Akshay Bhatia':8400,
};

async function main() {
  if (field.length !== 30 || new Set(field).size !== 30) throw new Error(`Expected 30 unique players, got ${field.length}/${new Set(field).size}`);
  const unknownOdds = Object.keys(odds).filter((name) => !field.includes(name as typeof field[number]));
  const missingOdds = field.filter((name) => odds[name] == null);
  if (unknownOdds.length || missingOdds.length) throw new Error(`Odds mismatch unknown=${unknownOdds.join(',')} missing=${missingOdds.join(',')}`);

  const season = await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) throw new Error('No active season');
  const league = await prisma.league.findFirst({ where: { name: 'Lumberjacks', seasonId: season.id }, include: { members: true } });
  if (!league || league.members.length !== 4) throw new Error('Expected Lumberjacks league with 4 members');

  const priorTournament = await prisma.tournament.findFirst({
    where: { seasonId: season.id, startDate: { lt: START }, weeklyResults: { some: { leagueId: league.id } } },
    orderBy: { startDate: 'desc' },
  });
  if (!priorTournament) throw new Error('No prior scored tournament');
  const priorResults = await prisma.weeklyResult.findMany({
    where: { leagueId: league.id, tournamentId: priorTournament.id }, include: { user: true }, orderBy: [{ rank: 'desc' }, { totalScore: 'desc' }],
  });
  if (priorResults.length !== 4) throw new Error(`Expected four prior results, got ${priorResults.length}`);
  const draftOrder = priorResults.map((r) => r.userId);

  const output = await prisma.$transaction(async (tx) => {
    await tx.tournament.updateMany({ where: { seasonId: season.id, startDate: { lt: START } }, data: { isComplete: true } });
    let tournament = await tx.tournament.findFirst({ where: { seasonId: season.id, OR: [{ externalId: ESPN_ID }, { name: TOURNAMENT_NAME }] } });
    const data = { name: TOURNAMENT_NAME, course: 'East Lake Golf Club', location: 'Atlanta, GA', startDate: START, endDate: END, pickDeadline: PICK_DEADLINE, isComplete: false, externalId: ESPN_ID };
    tournament = tournament ? await tx.tournament.update({ where: { id: tournament.id }, data }) : await tx.tournament.create({ data: { seasonId: season.id, ...data } });

    const existing = await tx.golfer.findMany({ where: { name: { in: [...field] } } });
    const names = new Set(existing.map((g) => g.name));
    await tx.golfer.createMany({ data: field.filter((name) => !names.has(name)).map((name) => ({ name })) });
    const golfers = await tx.golfer.findMany({ where: { name: { in: [...field] } } });
    const byName = new Map(golfers.map((g) => [g.name, g]));
    if (byName.size !== field.length) throw new Error(`Resolved ${byName.size}/${field.length} golfers`);

    await tx.tournamentField.deleteMany({ where: { tournamentId: tournament.id } });
    await tx.tournamentField.createMany({ data: field.map((name) => ({ tournamentId: tournament!.id, golferId: byName.get(name)!.id, odds: odds[name] })) });

    const priorDraft = await tx.draft.findUnique({ where: { leagueId_tournamentId: { leagueId: league.id, tournamentId: tournament.id } }, include: { _count: { select: { picks: true } } } });
    if (priorDraft && priorDraft._count.picks > 0) throw new Error(`Refusing to reset draft with ${priorDraft._count.picks} picks`);
    const draft = await tx.draft.upsert({
      where: { leagueId_tournamentId: { leagueId: league.id, tournamentId: tournament.id } },
      update: { status: 'active', currentRound: 1, currentPickIndex: 0, draftOrder: JSON.stringify(draftOrder) },
      create: { leagueId: league.id, tournamentId: tournament.id, status: 'active', currentRound: 1, currentPickIndex: 0, draftOrder: JSON.stringify(draftOrder) },
    });
    return { tournament, draft };
  }, { timeout: 30000 });

  console.log(JSON.stringify({
    tournamentId: output.tournament.id, externalId: output.tournament.externalId, draftId: output.draft.id,
    fieldCount: await prisma.tournamentField.count({ where: { tournamentId: output.tournament.id } }),
    oddsCount: await prisma.tournamentField.count({ where: { tournamentId: output.tournament.id, odds: { not: null } } }),
    priorTournament: priorTournament.name,
    priorResults: priorResults.map((r) => ({ username: r.user.username, rank: r.rank, totalScore: r.totalScore, points: r.points })),
    draftOrder: priorResults.map((r) => r.user.username), pickDeadline: output.tournament.pickDeadline.toISOString(),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
