import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOURNAMENT_NAME = 'Memorial Tournament';
const ESPN_ID = '401811950';
const LEAGUE_NAME = 'Lumberjacks';
const ESPN_SCOREBOARD = 'https://site.api.espn.com/apis/site/v2/sports/golf/pga/scoreboard';

const FIELD_ODDS: Record<string, number> = {
  'Scottie Scheffler': 265,
  'Rory McIlroy': 870,
  'Cameron Young': 1275,
  'Xander Schauffele': 1700,
  'Matt Fitzpatrick': 2000,
  'Ludvig Åberg': 2000,
  'Si Woo Kim': 2200,
  'Patrick Cantlay': 2500,
  'Tommy Fleetwood': 2600,
  'Russell Henley': 2700,
  'Robert MacIntyre': 3100,
  'Rickie Fowler': 3700,
  'Min Woo Lee': 3700,
  'Sam Burns': 3800,
  'Jordan Spieth': 4500,
  'Ben Griffin': 4600,
  'Adam Scott': 4700,
  'Maverick McNealy': 4900,
  'Chris Gotterup': 4900,
  'Hideki Matsuyama': 5100,
  'Justin Thomas': 5200,
  'Nicolai Højgaard': 5400,
  'Kurt Kitayama': 5400,
  'Jake Knapp': 5600,
  'Harris English': 5600,
  'Justin Rose': 5700,
  'J.J. Spaun': 5900,
  'Jason Day': 6500,
  'Sepp Straka': 6600,
  'Shane Lowry': 7200,
  'Jacob Bridgeman': 7200,
  'Akshay Bhatia': 7200,
  'Aaron Rai': 7400,
  'Wyndham Clark': 8200,
  'Gary Woodland': 8200,
  'Alex Smalley': 8600,
  'Sahith Theegala': 8800,
  'Kristoffer Reitan': 8800,
  'Ryo Hisatsune': 9200,
  'Sam Stevens': 9800,
  'Sudarshan Yellamaraju': 10000,
  'Harry Hall': 10000,
  'Keegan Bradley': 11000,
  'J.T. Poston': 11000,
  'Corey Conners': 11000,
  'Alex Noren': 11000,
  'Ryan Gerard': 11500,
  'Nick Taylor': 11500,
  'Daniel Berger': 12000,
  'Bud Cauley': 13500,
  'Ryan Fox': 14000,
  'Sungjae Im': 15000,
  'Denny McCarthy': 15000,
  'Alex Fitzpatrick': 15000,
  'Taylor Pendrith': 16500,
  'Matt McCarty': 16500,
  'Brian Harman': 17500,
  'Tony Finau': 18000,
  'Michael Kim': 20000,
  'Andrew Novak': 20000,
  'Patrick Rodgers': 21000,
  'Zach Bauchou': 42000,
  'Nico Echavarria': 42500,
  'Jhonattan Vegas': 44000,
  'Billy Horschel': 46000,
  'Jackson Suber': 48000,
  'Brandt Snedeker': 50000,
  'Lucas Glover': 55000,
  'Tom Hoge': 77500,
  'Mark Hubbard': 77500,
  'Brian Campbell': 160000,
};

function normalize(name: string) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z ]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function main() {
  const tournament = await prisma.tournament.findFirst({ where: { name: TOURNAMENT_NAME } });
  if (!tournament) throw new Error(`${TOURNAMENT_NAME} not found`);

  const league = await prisma.league.findFirst({
    where: { name: LEAGUE_NAME },
    include: { members: { include: { user: true } } },
  });
  if (!league) throw new Error(`${LEAGUE_NAME} league not found`);
  if (league.members.length !== 4) throw new Error(`Expected 4 league members, got ${league.members.length}`);

  const response = await fetch(ESPN_SCOREBOARD);
  if (!response.ok) throw new Error(`ESPN scoreboard failed: ${response.status}`);
  const data = await response.json();
  const event = data.events?.find((e: { id: string }) => e.id === ESPN_ID);
  if (!event) throw new Error(`ESPN event ${ESPN_ID} not found`);
  const competitors: { id?: string; athlete?: { displayName?: string } }[] =
    event.competitions?.[0]?.competitors ?? [];
  if (competitors.length < 60) throw new Error(`Unexpected small ESPN field: ${competitors.length}`);

  const allGolfers = await prisma.golfer.findMany({ select: { id: true, name: true, externalId: true } });
  const byExternalId = new Map(allGolfers.filter(g => g.externalId).map(g => [g.externalId!, g]));
  const byName = new Map(allGolfers.map(g => [normalize(g.name), g]));
  const oddsByName = new Map(Object.entries(FIELD_ODDS).map(([name, odds]) => [normalize(name), odds]));

  await prisma.$transaction([
    prisma.tournamentField.deleteMany({ where: { tournamentId: tournament.id } }),
    prisma.tournamentResult.deleteMany({ where: { tournamentId: tournament.id } }),
  ]);

  const fieldRows: { tournamentId: string; golferId: string; odds: number | null }[] = [];
  const created: string[] = [];
  const missingOdds: string[] = [];

  for (const comp of competitors) {
    const name = comp.athlete?.displayName;
    if (!name) continue;
    const espnGolferId = comp.id ?? null;
    let golfer = espnGolferId ? byExternalId.get(espnGolferId) : undefined;

    if (!golfer) golfer = byName.get(normalize(name));

    if (golfer && espnGolferId && !golfer.externalId) {
      golfer = await prisma.golfer.update({ where: { id: golfer.id }, data: { externalId: espnGolferId } });
    }

    if (!golfer) {
      golfer = await prisma.golfer.create({ data: { name, externalId: espnGolferId } });
      created.push(name);
    }

    const odds = oddsByName.get(normalize(name)) ?? null;
    if (odds == null) missingOdds.push(name);
    fieldRows.push({ tournamentId: tournament.id, golferId: golfer.id, odds });
  }

  await prisma.tournamentField.createMany({ data: fieldRows, skipDuplicates: true });

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: {
      course: 'Muirfield Village Golf Club',
      location: 'Dublin, OH',
      externalId: ESPN_ID,
      pickDeadline: new Date('2026-06-04T11:40:00.000Z'),
      isComplete: false,
    },
  });

  const pga = await prisma.tournament.findFirst({ where: { name: 'PGA Championship' } });
  if (!pga) throw new Error('PGA Championship not found');
  const pgaResults = await prisma.weeklyResult.findMany({
    where: { tournamentId: pga.id, leagueId: league.id },
    orderBy: { rank: 'desc' },
  });

  let draftOrder = pgaResults.map(r => r.userId);
  if (draftOrder.length !== league.members.length) {
    const known = new Set(draftOrder);
    draftOrder = [...draftOrder, ...league.members.map(m => m.userId).filter(id => !known.has(id))];
  }
  if (draftOrder.length !== 4) throw new Error(`Expected 4 draft members, got ${draftOrder.length}`);

  const existingDraft = await prisma.draft.findUnique({
    where: { leagueId_tournamentId: { leagueId: league.id, tournamentId: tournament.id } },
    include: { picks: true },
  });
  if (existingDraft?.picks.length) throw new Error(`Memorial draft already has ${existingDraft.picks.length} picks`);

  const draft = existingDraft
    ? await prisma.draft.update({
        where: { id: existingDraft.id },
        data: { status: 'active', currentRound: 1, currentPickIndex: 0, draftOrder: JSON.stringify(draftOrder) },
      })
    : await prisma.draft.create({
        data: { leagueId: league.id, tournamentId: tournament.id, status: 'active', currentRound: 1, currentPickIndex: 0, draftOrder: JSON.stringify(draftOrder) },
      });

  const users = new Map(league.members.map(m => [m.userId, m.user.username]));
  const verify = await prisma.tournament.findUnique({
    where: { id: tournament.id },
    include: { _count: { select: { field: true, results: true, drafts: true, weeklyResults: true } } },
  });
  const topOdds = await prisma.tournamentField.findMany({
    where: { tournamentId: tournament.id, odds: { not: null } },
    orderBy: { odds: 'asc' },
    take: 12,
    include: { golfer: true },
  });

  console.log(JSON.stringify({
    tournament: verify,
    espnEvent: event.name,
    fieldCount: fieldRows.length,
    oddsCount: fieldRows.filter(r => r.odds != null).length,
    created,
    missingOdds,
    topOdds: topOdds.map(row => `${row.golfer.name} +${row.odds}`),
    draft: {
      id: draft.id,
      status: draft.status,
      currentRound: draft.currentRound,
      currentPickIndex: draft.currentPickIndex,
      order: draftOrder.map(id => users.get(id) || id),
    },
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
