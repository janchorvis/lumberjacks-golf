import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();
const TOURNAMENT_NAME = 'FedEx St. Jude Championship';
const ESPN_ID = '401811962';
const START = new Date('2026-08-13T07:00:00.000Z');
const END = new Date('2026-08-16T23:59:59.000Z');
// 6:40 AM CDT, five minutes before the prior-year opening tee time. The 2026
// PGA Tour tee-time page had not published pairings as of Monday morning.
const PICK_DEADLINE = new Date('2026-08-13T11:40:00.000Z');

// Official PGA Tour field page on 2026-08-10. Daniel Berger qualified but did
// not enter, leaving 69 players.
const field = [
  'Ludvig Åberg','Akshay Bhatia','Michael Brennan','Jacob Bridgeman','Sam Burns',
  'Patrick Cantlay','Ricky Castillo','Bud Cauley','Wyndham Clark','Eric Cole',
  'Corey Conners','Pierceson Coody','Nico Echavarria','Harris English','Alex Fitzpatrick',
  'Matt Fitzpatrick','Tommy Fleetwood','Rickie Fowler','Ryan Fox','Ryan Gerard',
  'Chris Gotterup','Ben Griffin','Harry Hall','Brian Harman','Russell Henley',
  'Ryo Hisatsune','Nicolai Højgaard','Max Homa','Viktor Hovland','Sungjae Im',
  'Michael Kim','Si Woo Kim','Tom Kim','Kurt Kitayama','Jake Knapp',
  'Jackson Koivun','Min Woo Lee','Shane Lowry','Robert MacIntyre','Hideki Matsuyama',
  'Matt McCarty','Rory McIlroy','Maverick McNealy','Keith Mitchell','Collin Morikawa',
  'Alex Noren','J.T. Poston','Aldrich Potgieter','Aaron Rai','Kristoffer Reitan',
  'Patrick Rodgers','Justin Rose','Xander Schauffele','Scottie Scheffler','Matti Schmid',
  'Adam Scott','Alex Smalley','Jordan Smith','J.J. Spaun','Jordan Spieth',
  'Sam Stevens','Sepp Straka','Nick Taylor','Sahith Theegala','Justin Thomas',
  'Michael Thorbjornsen','Gary Woodland','Sudarshan Yellamaraju','Cameron Young',
] as const;

// DraftKings full-field outright odds published 2026-08-09. Steven Fisk was
// listed by DK but is not in the official PGA Tour field, so he is excluded.
// Michael Brennan had no listed price and is intentionally left null.
const odds: Record<string, number> = {
  'Scottie Scheffler':445,'Rory McIlroy':950,'Xander Schauffele':1900,'Tommy Fleetwood':1950,
  'Sam Burns':2000,'Matt Fitzpatrick':2100,'Cameron Young':2100,'Ludvig Åberg':2300,
  'Collin Morikawa':2600,'Chris Gotterup':3000,'Patrick Cantlay':3100,'Si Woo Kim':3300,
  'Hideki Matsuyama':3300,'Wyndham Clark':3700,'Robert MacIntyre':3900,'Russell Henley':4000,
  'Justin Thomas':4100,'Jackson Koivun':4100,'Viktor Hovland':4100,'Min Woo Lee':4700,
  'Justin Rose':4800,'Ben Griffin':5300,'J.J. Spaun':5400,'Tom Kim':5400,
  'Kurt Kitayama':5600,'Michael Thorbjornsen':5600,'Maverick McNealy':5900,'Nicolai Højgaard':6500,
  'Kristoffer Reitan':6500,'Jake Knapp':6600,'Alex Noren':6700,'Akshay Bhatia':6800,
  'Ryan Gerard':7000,'Rickie Fowler':7000,'Alex Smalley':7000,'Shane Lowry':7200,
  'Jacob Bridgeman':7200,'Keith Mitchell':7600,'Jordan Spieth':8000,'Adam Scott':8000,
  'Aaron Rai':8200,'Jordan Smith':8800,'Ryan Fox':9000,'Harris English':9000,
  'Alex Fitzpatrick':9600,'Sahith Theegala':10500,'Gary Woodland':10500,'Bud Cauley':11000,
  'Sungjae Im':11000,'Eric Cole':11500,'Corey Conners':11500,'Harry Hall':12500,
  'Michael Kim':13000,'Ryo Hisatsune':14500,'Brian Harman':14500,'J.T. Poston':15500,
  'Nico Echavarria':16000,'Max Homa':16000,'Sudarshan Yellamaraju':19500,'Ricky Castillo':20000,
  'Matt McCarty':21000,'Nick Taylor':22000,'Sam Stevens':23000,'Pierceson Coody':24000,
  'Sepp Straka':29000,'Matti Schmid':31000,'Aldrich Potgieter':32500,'Patrick Rodgers':52500,
};

async function main() {
  if (new Set(field).size !== field.length || field.length !== 69) {
    throw new Error(`Expected 69 unique official field names, got ${field.length}/${new Set(field).size}`);
  }
  const unknownOdds = Object.keys(odds).filter((name) => !field.includes(name as typeof field[number]));
  if (unknownOdds.length) throw new Error(`Odds names outside official field: ${unknownOdds.join(', ')}`);

  const season = await prisma.season.findFirst({ where: { isActive: true } });
  if (!season) throw new Error('No active season');
  const league = await prisma.league.findFirst({
    where: { name: 'Lumberjacks', seasonId: season.id },
    include: { members: { include: { user: true } } },
  });
  if (!league || league.members.length !== 4) throw new Error(`Expected Lumberjacks league with 4 members`);

  const priorTournament = await prisma.tournament.findFirst({
    where: { seasonId: season.id, startDate: { lt: START }, weeklyResults: { some: { leagueId: league.id } } },
    orderBy: { startDate: 'desc' },
  });
  if (!priorTournament) throw new Error('No prior scored tournament found');
  const priorResults = await prisma.weeklyResult.findMany({
    where: { leagueId: league.id, tournamentId: priorTournament.id },
    include: { user: true },
    orderBy: { rank: 'desc' },
  });
  if (priorResults.length !== 4) throw new Error(`Expected 4 prior results, found ${priorResults.length}`);
  const draftOrder = priorResults.map((r) => r.userId);

  const output = await prisma.$transaction(async (tx) => {
    await tx.tournament.updateMany({
      where: { seasonId: season.id, startDate: { lt: START } },
      data: { isComplete: true },
    });

    let tournament = await tx.tournament.findFirst({
      where: { seasonId: season.id, OR: [{ externalId: ESPN_ID }, { name: TOURNAMENT_NAME }] },
    });
    if (tournament) {
      tournament = await tx.tournament.update({
        where: { id: tournament.id },
        data: { name: TOURNAMENT_NAME, course: 'TPC Southwind', location: 'Memphis, TN', startDate: START, endDate: END, pickDeadline: PICK_DEADLINE, isComplete: false, externalId: ESPN_ID },
      });
    } else {
      tournament = await tx.tournament.create({
        data: { seasonId: season.id, name: TOURNAMENT_NAME, course: 'TPC Southwind', location: 'Memphis, TN', startDate: START, endDate: END, pickDeadline: PICK_DEADLINE, isComplete: false, externalId: ESPN_ID },
      });
    }

    const existing = await tx.golfer.findMany({ where: { name: { in: [...field] } } });
    const existingNames = new Set(existing.map((g) => g.name));
    await tx.golfer.createMany({
      data: field.filter((name) => !existingNames.has(name)).map((name) => ({ name })),
    });
    const golfers = await tx.golfer.findMany({ where: { name: { in: [...field] } } });
    const byName = new Map(golfers.map((g) => [g.name, g]));
    if (byName.size !== field.length) throw new Error(`Only resolved ${byName.size}/${field.length} golfers`);

    await tx.tournamentField.deleteMany({ where: { tournamentId: tournament.id } });
    await tx.tournamentField.createMany({ data: field.map((name) => ({
      tournamentId: tournament!.id,
      golferId: byName.get(name)!.id,
      odds: odds[name] ?? null,
    })) });

    const draft = await tx.draft.upsert({
      where: { leagueId_tournamentId: { leagueId: league.id, tournamentId: tournament.id } },
      update: { status: 'active', currentRound: 1, currentPickIndex: 0, draftOrder: JSON.stringify(draftOrder) },
      create: { leagueId: league.id, tournamentId: tournament.id, status: 'active', currentRound: 1, currentPickIndex: 0, draftOrder: JSON.stringify(draftOrder) },
    });
    const existingPicks = await tx.draftPick.count({ where: { draftId: draft.id } });
    if (existingPicks !== 0) throw new Error(`Refusing to reset draft with ${existingPicks} existing picks`);

    return { tournament, draft };
  }, { timeout: 30000 });

  const fieldCount = await prisma.tournamentField.count({ where: { tournamentId: output.tournament.id } });
  const oddsCount = await prisma.tournamentField.count({ where: { tournamentId: output.tournament.id, odds: { not: null } } });
  console.log(JSON.stringify({
    tournamentId: output.tournament.id,
    externalId: output.tournament.externalId,
    draftId: output.draft.id,
    fieldCount,
    oddsCount,
    missingOdds: field.filter((name) => odds[name] == null),
    priorTournament: priorTournament.name,
    draftOrder: priorResults.map((r) => r.user.username),
    pickDeadline: output.tournament.pickDeadline.toISOString(),
  }, null, 2));
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(() => prisma.$disconnect());
