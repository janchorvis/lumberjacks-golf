import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TOURNAMENT_NAME = 'BMW Championship';
const ESPN_ID = '401811963';
const START = new Date('2026-08-20T07:00:00.000Z');
const END = new Date('2026-08-23T23:59:59.000Z');
// Official Round 1 pairings were still TBA on Tuesday afternoon. Use a
// conservative 7:55 AM CDT deadline, before ESPN's 10:00 AM ET coverage.
const PICK_DEADLINE = new Date('2026-08-20T12:55:00.000Z');

// Official PGA Tour BMW Championship field page, verified 2026-08-18.
const field = [
  'Ludvig Åberg','Akshay Bhatia','Michael Brennan','Jacob Bridgeman','Sam Burns',
  'Patrick Cantlay','Bud Cauley','Wyndham Clark','Eric Cole','Nico Echavarria',
  'Alex Fitzpatrick','Matt Fitzpatrick','Tommy Fleetwood','Rickie Fowler','Ryan Fox',
  'Ryan Gerard','Chris Gotterup','Ben Griffin','Russell Henley','Ryo Hisatsune',
  'Nicolai Højgaard','Viktor Hovland','Sungjae Im','Si Woo Kim','Tom Kim',
  'Kurt Kitayama','Jake Knapp','Min Woo Lee','Robert MacIntyre','Hideki Matsuyama',
  'Matt McCarty','Rory McIlroy','Maverick McNealy','Collin Morikawa','Alex Noren',
  'J.T. Poston','Aaron Rai','Kristoffer Reitan','Justin Rose','Xander Schauffele',
  'Scottie Scheffler','Adam Scott','Alex Smalley','J.J. Spaun','Sepp Straka',
  'Sahith Theegala','Justin Thomas','Michael Thorbjornsen','Gary Woodland','Cameron Young',
] as const;

// FanDuel full-field outright odds published by CBS Sports on 2026-08-18.
const odds: Record<string, number> = {
  'Scottie Scheffler':300,'Rory McIlroy':1600,'Xander Schauffele':1800,'Ludvig Åberg':1800,
  'Sam Burns':2000,'Cameron Young':2000,'Tommy Fleetwood':2000,'Matt Fitzpatrick':2200,
  'Chris Gotterup':2700,'Si Woo Kim':2700,'Hideki Matsuyama':3000,'Viktor Hovland':3000,
  'Patrick Cantlay':3000,'Wyndham Clark':3000,'Collin Morikawa':3500,'Justin Thomas':4000,
  'Jake Knapp':4000,'Russell Henley':4500,'Maverick McNealy':4500,'Kurt Kitayama':4500,
  'Tom Kim':4500,'Min Woo Lee':5000,'Michael Thorbjornsen':5000,'Ryan Gerard':5000,
  'J.J. Spaun':5500,'Adam Scott':6000,'Robert MacIntyre':6000,'Michael Brennan':6000,
  'Sungjae Im':6500,'Ben Griffin':6500,'Nicolai Højgaard':6500,'Justin Rose':7000,
  'Rickie Fowler':7000,'Alex Noren':7000,'Jacob Bridgeman':8000,'Kristoffer Reitan':8000,
  'Bud Cauley':8000,'Ryan Fox':10000,'Alex Smalley':10000,'Aaron Rai':10000,
  'Akshay Bhatia':10000,'Alex Fitzpatrick':10000,'Gary Woodland':10000,'Nico Echavarria':12500,
  'J.T. Poston':12500,'Eric Cole':12500,'Ryo Hisatsune':15000,'Sahith Theegala':17500,
  'Matt McCarty':22500,'Sepp Straka':22500,
};

async function main() {
  if (field.length !== 50 || new Set(field).size !== 50) throw new Error(`Expected 50 unique players, got ${field.length}/${new Set(field).size}`);
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
    const data = { name: TOURNAMENT_NAME, course: 'Bellerive Country Club', location: 'St. Louis, MO', startDate: START, endDate: END, pickDeadline: PICK_DEADLINE, isComplete: false, externalId: ESPN_ID };
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
