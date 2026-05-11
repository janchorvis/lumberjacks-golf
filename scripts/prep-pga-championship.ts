import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TOURNAMENT_NAME = 'PGA Championship';
const ESPN_ID = '401811947';
const LEAGUE_NAME = 'Lumberjacks';
const FIELD_ODDS: Record<string, number> = {
  'Scottie Scheffler': 450,
  'Rory McIlroy': 850,
  'Cameron Young': 1200,
  'Jon Rahm': 1600,
  'Bryson DeChambeau': 1800,
  'Xander Schauffele': 1800,
  'Ludvig Åberg': 2000,
  'Matt Fitzpatrick': 2200,
  'Tommy Fleetwood': 2200,
  'Brooks Koepka': 4000,
  'Collin Morikawa': 4000,
  'Justin Thomas': 4000,
  'Justin Rose': 4500,
  'Patrick Cantlay': 4500,
  'Tyrrell Hatton': 4500,
  'Rickie Fowler': 5000,
  'Russell Henley': 5000,
  'Viktor Hovland': 5000,
  'Chris Gotterup': 6000,
  'Hideki Matsuyama': 6600,
  'J.J. Spaun': 6600,
  'Jordan Spieth': 6600,
  'Nicolai Højgaard': 6600,
  'Patrick Reed': 6600,
  'Robert MacIntyre': 6600,
  'Sam Burns': 6600,
  'Si Woo Kim': 6600,
  'Min Woo Lee': 6600,
  'Sepp Straka': 6600,
  'Shane Lowry': 6600,
  'Akshay Bhatia': 8000,
  'Jake Knapp': 8000,
  'Joaquin Niemann': 8000,
  'Kristoffer Reitan': 8000,
  'Keegan Bradley': 9000,
  'Maverick McNealy': 9000,
  'Adam Scott': 10000,
  'Alex Fitzpatrick': 10000,
  'Ben Griffin': 10000,
  'Corey Conners': 10000,
  'Gary Woodland': 10000,
  'Harris English': 10000,
  'Jason Day': 10000,
  'Kurt Kitayama': 10000,
  'Sungjae Im': 10000,
  'Jacob Bridgeman': 10000,
  'Aaron Rai': 12500,
  'Alex Noren': 12500,
  'Marco Penge': 12500,
  'Thomas Detry': 12500,
  'Wyndham Clark': 12500,
  'Alex Smalley': 15000,
  'David Puig': 15000,
  'Dustin Johnson': 15000,
  'Harry Hall': 15000,
  'Matt McCarty': 15000,
  'Michael Thorbjornsen': 15000,
  'Sahith Theegala': 15000,
  'Sudarshan Yellamaraju': 15000,
  'Brian Harman': 17500,
  'Nick Taylor': 17500,
  'Rasmus Højgaard': 17500,
  'Ryan Gerard': 17500,
  'Cameron Smith': 20000,
  'Daniel Berger': 20000,
  'Jayden Schaper': 20000,
  'Keith Mitchell': 20000,
  'Max Homa': 20000,
  'Michael Brennan': 20000,
  'Pierceson Coody': 20000,
  'Sam Stevens': 20000,
  'Aldrich Potgieter': 25000,
  'Andrew Novak': 25000,
  'Angel Ayora': 25000,
  'Bud Cauley': 25000,
  'Daniel Hillier': 25000,
  'Denny McCarthy': 25000,
  'J.T. Poston': 25000,
  'Matt Wallace': 25000,
  'Michael Kim': 25000,
  'Ryan Fox': 25000,
  'Ryo Hisatsune': 25000,
  'Taylor Pendrith': 25000,
  'Tom McKibbin': 25000,
  'Andrew Putnam': 30000,
  'Bernd Wiesberger': 30000,
  'Billy Horschel': 30000,
  'Christiaan Bezuidenhout': 30000,
  'Haotong Li': 30000,
  'Jordan Smith': 30000,
  'Max Greyserman': 30000,
  'Mikael Lindberg': 30000,
  'Patrick Rodgers': 30000,
  'Rasmus Neergaard-Petersen': 30000,
  'Rico Hoey': 30000,
  'John Parry': 35000,
  'Lucas Glover': 35000,
  'Sami Valimaki': 35000,
  'Stewart Cink': 35000,
  'Austin Smotherman': 40000,
  'Brandt Snedeker': 40000,
  'Chris Kirk': 40000,
  'Elvis Smylie': 40000,
  'Ian Holt': 40000,
  'John Keefer': 40000,
  'Matti Schmid': 40000,
  'Max McGreevy': 40000,
  'Nico Echavarria': 40000,
  'Ricky Castillo': 40000,
  'Stephan Jaeger': 40000,
  'Steven Fisk': 40000,
  'William Mouw': 40000,
  'Adrien Saddier': 50000,
  'Casey Jarvis': 50000,
  'Emiliano Grillo': 50000,
  'Garrick Higgo': 50000,
  'Jhonattan Vegas': 50000,
  'Kouta Kaneko': 50000,
  'Travis Smyth': 50000,
  'Daniel Brown': 60000,
  'David Lipsky': 60000,
  'Adam Schenk': 75000,
  'Andy Sullivan': 75000,
  'Brian Campbell': 75000,
  'Davis Riley': 75000,
  'Joe Highsmith': 75000,
  'Chandler Blanchet': 100000,
  'Kazuki Higa': 100000,
  'Martin Kaymer': 100000,
  'Padraig Harrington': 100000,
  'Jordan Gumberg': 150000,
  'Austin Hurt': 200000,
  'Ben Kern': 200000,
  'Ben Polland': 200000,
  'Braden Shattuck': 200000,
  'Bryce Fisher': 200000,
  'Chris Gabriele': 200000,
  'Derek Berg': 200000,
  'Francisco Bide': 200000,
  'Garrett Sapp': 200000,
  'Jared Jones': 200000,
  'Jason Dufner': 200000,
  'Jesse Droemer': 200000,
  'Jimmy Walker': 200000,
  'Luke Donald': 200000,
  'Mark Geddes': 200000,
  'Michael Block': 200000,
  'Michael Kartrude': 200000,
  'Paul McClure': 200000,
  'Ryan Lenahan': 200000,
  'Ryan Vermeer': 200000,
  'Timothy Wiseman': 200000,
  'Tyler Collet': 200000,
  'Y.E. Yang': 200000,
  'Zach Haynes': 200000,
  'Shaun Micheel': 250000,
};

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, '').trim();
}
function scoreMatch(a: string, b: string) {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1;
  if (nb.includes(na) || na.includes(nb)) return 0.9;
  const aw = na.split(/\s+/), bw = nb.split(/\s+/);
  if (aw.at(-1) === bw.at(-1)) return 0.8;
  return 0;
}
async function findOrCreateGolfer(name: string, allGolfers: {id:string;name:string}[]) {
  let best: {id:string;name:string}|null = null, bestScore = 0;
  for (const g of allGolfers) {
    const s = scoreMatch(name, g.name);
    if (s > bestScore) { bestScore = s; best = g; }
  }
  if (best && bestScore >= 0.8) return { golfer: best, created: false, matchedAs: best.name, score: bestScore };
  const created = await prisma.golfer.create({ data: { name } });
  allGolfers.push({ id: created.id, name: created.name });
  return { golfer: { id: created.id, name: created.name }, created: true, matchedAs: null, score: bestScore };
}
async function main() {
  const tournament = await prisma.tournament.findFirst({ where: { name: TOURNAMENT_NAME } });
  if (!tournament) throw new Error(`${TOURNAMENT_NAME} not found`);
  const league = await prisma.league.findFirst({ where: { name: LEAGUE_NAME }, include: { members: { include: { user: true } } } });
  if (!league) throw new Error(`${LEAGUE_NAME} league not found`);

  const names = Object.keys(FIELD_ODDS);
  const allGolfers = await prisma.golfer.findMany({ select: { id: true, name: true } });
  let matched = 0, created = 0;
  await prisma.$transaction([
    prisma.tournamentField.deleteMany({ where: { tournamentId: tournament.id } }),
    prisma.tournamentResult.deleteMany({ where: { tournamentId: tournament.id } }),
  ]);
  const fieldEntries: { tournamentId: string; golferId: string; odds: number }[] = [];
  const createdNames: string[] = [];
  const lowConfidence: string[] = [];
  for (const name of names) {
    const result = await findOrCreateGolfer(name, allGolfers);
    if (result.created) { created++; createdNames.push(name); }
    else matched++;
    if (!result.created && result.matchedAs !== name && result.score < 1) lowConfidence.push(`${name} -> ${result.matchedAs} (${result.score})`);
    fieldEntries.push({ tournamentId: tournament.id, golferId: result.golfer.id, odds: FIELD_ODDS[name] });
  }
  await prisma.tournamentField.createMany({ data: fieldEntries, skipDuplicates: true });

  await prisma.tournament.update({
    where: { id: tournament.id },
    data: {
      course: 'Aronimink Golf Club',
      location: 'Newtown Square, PA',
      externalId: ESPN_ID,
      pickDeadline: new Date('2026-05-14T11:00:00.000Z'),
      isComplete: false,
    },
  });

  const masters = await prisma.tournament.findFirst({ where: { name: 'Masters Tournament' } });
  if (!masters) throw new Error('Masters Tournament not found');
  const mastersResults = await prisma.weeklyResult.findMany({ where: { tournamentId: masters.id, leagueId: league.id }, orderBy: { rank: 'desc' } });
  let draftOrder = mastersResults.map(r => r.userId); // reverse prior-week standings: last first
  if (draftOrder.length !== league.members.length) {
    const known = new Set(draftOrder);
    draftOrder = [...draftOrder, ...league.members.map(m => m.userId).filter(id => !known.has(id))];
  }
  if (draftOrder.length !== 4) throw new Error(`Expected 4 draft members, got ${draftOrder.length}`);

  const existingDraft = await prisma.draft.findUnique({ where: { leagueId_tournamentId: { leagueId: league.id, tournamentId: tournament.id } } });
  const draft = existingDraft
    ? await prisma.draft.update({ where: { id: existingDraft.id }, data: { status: 'active', currentRound: 1, currentPickIndex: 0, draftOrder: JSON.stringify(draftOrder) } })
    : await prisma.draft.create({ data: { leagueId: league.id, tournamentId: tournament.id, status: 'active', currentRound: 1, currentPickIndex: 0, draftOrder: JSON.stringify(draftOrder) } });

  const users = new Map(league.members.map(m => [m.userId, m.user.username]));
  const verifyTournament = await prisma.tournament.findUnique({ where: { id: tournament.id }, include: { _count: { select: { field: true, results: true, picks: true, drafts: true } } } });
  const topOdds = await prisma.tournamentField.findMany({ where: { tournamentId: tournament.id }, orderBy: { odds: 'asc' }, take: 12, include: { golfer: true } });
  console.log(JSON.stringify({
    tournament: verifyTournament,
    field: { requested: names.length, matched, created, createdNames, lowConfidence, topOdds: topOdds.map(e => `${e.golfer.name} +${e.odds}`) },
    draft: { id: draft.id, status: draft.status, currentRound: draft.currentRound, currentPickIndex: draft.currentPickIndex, order: draftOrder.map(id => users.get(id) || id) },
    scoring: { majorDoublePointsExpected: true, baseMajorPayout: { 1: 400, 2: 200, 3: 100, 4: 0 } }
  }, null, 2));
}
main().catch(e => { console.error(e); process.exit(1); }).finally(() => prisma.$disconnect());
