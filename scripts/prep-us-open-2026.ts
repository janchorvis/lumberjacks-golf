import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const TOURNAMENT_ID = 'cmml7bk2v000gxihq5hv7k0kl';
const LEAGUE_NAME = 'Lumberjacks';

const fieldText = `
Scottie Scheffler +455
Rory McIlroy +940
Jon Rahm +1025
Xander Schauffele +1850
Cameron Young +2000
Matt Fitzpatrick +2500
Tommy Fleetwood +2500
Ludvig Aberg +2600
Bryson DeChambeau +2700
Brooks Koepka +2900
Collin Morikawa +3300
Sam Burns +3700
Russell Henley +3700
Si Woo Kim +3900
Justin Rose +4200
Wyndham Clark +4200
Chris Gotterup +4400
Justin Thomas +4400
Tyrrell Hatton +4500
Patrick Cantlay +4500
Patrick Reed +4800
Viktor Hovland +5300
J.J. Spaun +6000
Hideki Matsuyama +6400
Jordan Spieth +6800
Joaquin Niemann +6800
Ben Griffin +7200
Min Woo Lee +7200
Maverick McNealy +7400
Adam Scott +7400
Shane Lowry +7400
Kurt Kitayama +7800
Robert MacIntyre +7800
Harris English +8600
Kristoffer Reitan +8800
Jake Knapp +9400
David Puig +9400
Nicolai Hojgaard +9600
Alex Smalley +10000
Alex Noren +10000
Aaron Rai +10000
Sepp Straka +10500
Ryan Gerard +11000
Rickie Fowler +11000
Gary Woodland +11500
Alex Fitzpatrick +12000
Jason Day +13000
Akshay Bhatia +13500
Keegan Bradley +14000
Keith Mitchell +15000
Jacob Bridgeman +15500
Jackson Koivun +15500
Dustin Johnson +16000
Cameron Smith +16000
Sahith Theegala +16000
Harry Hall +16500
Nick Taylor +16500
Corey Conners +18000
Pierceson Coody +18500
Sudarshan Yellamaraju +19000
Daniel Berger +20000
Sungjae Im +20000
Benjamin James +21000
Davis Thompson +23000
Brian Harman +23000
Tom Kim +23000
Ryo Hisatsune +23000
Max Greyserman +25000
Lucas Herbert +25000
Jayden Schaper +25000
Ryan Fox +25000
Jackson Suber +27000
Sam Stevens +27000
Michael Brennan +27000
Matt McCarty +28000
Carlos Ortiz +28000
Andrew Putnam +30000
Andrew Novak +31000
Michael Kim +31000
Adrien Dumont De Chassart +37000
John Keefer +38000
Preston Stout +42500
Patrick Rodgers +44000
John Parry +45000
Nico Echavarria +45000
Max McGreevy +45000
Matthias Schmid +45000
Chris Kirk +47000
William Mouw +52500
Nathan Kimsey +55000
Kevin Roy +62500
Cooper Dossey +70000
Emiliano Grillo +72500
Neal Shipley +72500
Billy Horschel +75000
Ben Kohles +77500
Laurie Canter +80000
Adrien Saddier +85000
Ugo Coussaud +85000
Chandler Phillips +110000
Matthew Jordan +110000
Caleb Surratt +125000
Zac Blair +125000
Cole Hammer +140000
Padraig Harrington +140000
Taylor Montgomery +190000
Niklas Norgaard +190000
Dylan Wu +200000
Alejandro Tosti +200000
Carl Yuan +225000
Ben Silverman +225000
Peter Uihlein +225000
Nick Hardy +225000
Arni Sveinsson +250000
Jimmy Stanger +250000
Ethan Fang +250000
Eric Lee +300000
James Nicholas +300000
Graeme McDowell +300000
Taihei Sato +300000
Ryder Cowan +300000
Jackson Herrington +350000
Greyson Leach +350000
Jackson Ormond +400000
Rocco Repetto +400000
Logan Reilly +400000
Mateo Pulcini +450000
Chase Kyes +450000
Marcelo Rozo +450000
Kaito Onishi +450000
Jake Peacock +450000
Jackson Van Paris +450000
J.B. Holmes +450000
Filippo Celli +450000
Manav Shah +500000
Jake Sollon +500000
Brandon Wu +500000
Brandon Holtz +500000
Ryuichi Oiwa +500000
Robbie Higgins +500000
Vaughn Harber +500000
Taek Soo Kim +500000
Matt Robles +500000
Marek Fleming +500000
Hamilton Coleman +500000
Mason Howell N/A
Angel Hidalgo N/A
Bryan Lee N/A
Bud Cauley N/A
Giuseppe Puebla N/A
Harry Higgs N/A
Hennie du Plessis N/A
J.T. Poston N/A
Jack Schoenberger N/A
Miles Russell N/A
Spencer Tibbits N/A
`;

type FieldRow = { name: string; odds: number | null };

function parseField(text: string): FieldRow[] {
  return text.trim().split('\n').filter(Boolean).map((line) => {
    const m = line.trim().match(/^(.+?)\s+(?:\+([0-9]+)|N\/A)$/);
    if (!m) throw new Error(`Could not parse line: ${line}`);
    return { name: m[1].trim(), odds: m[2] ? Number(m[2]) : null };
  });
}

async function main() {
  const rows = parseField(fieldText);
  const uniqueNames = new Set(rows.map((r) => r.name));
  if (rows.length !== uniqueNames.size) throw new Error(`Duplicate field name found: rows=${rows.length} unique=${uniqueNames.size}`);

  const tournament = await prisma.tournament.findUnique({ where: { id: TOURNAMENT_ID } });
  if (!tournament) throw new Error(`Tournament not found: ${TOURNAMENT_ID}`);

  const league = await prisma.league.findFirst({
    where: { name: LEAGUE_NAME },
    include: { members: { include: { user: true } } },
  });
  if (!league) throw new Error(`League not found: ${LEAGUE_NAME}`);
  if (league.members.length !== 4) throw new Error(`Expected 4 league members, found ${league.members.length}`);

  const priorResults = await prisma.weeklyResult.findMany({
    where: { leagueId: league.id, tournament: { name: 'Memorial Tournament' } },
    include: { user: true },
    orderBy: { rank: 'desc' },
  });
  if (priorResults.length !== 4) throw new Error(`Expected 4 Memorial results, found ${priorResults.length}`);
  const draftOrder = priorResults.map((r) => r.userId);

  await prisma.tournament.updateMany({
    where: { startDate: { lt: tournament.startDate } },
    data: { isComplete: true },
  });

  await prisma.tournament.update({
    where: { id: TOURNAMENT_ID },
    data: {
      name: 'U.S. Open',
      course: 'Shinnecock Hills Golf Club',
      location: 'Southampton, NY',
      externalId: '401811952',
      startDate: new Date('2026-06-18T04:00:00.000Z'),
      endDate: new Date('2026-06-21T23:59:59.000Z'),
      // 6:25 AM ET, safely before the broadcast/early tee window.
      pickDeadline: new Date('2026-06-18T10:25:00.000Z'),
      isComplete: false,
    },
  });

  await prisma.tournamentField.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });

  const fieldRows = [] as { tournamentId: string; golferId: string; odds: number | null }[];
  for (const row of rows) {
    let golfer = await prisma.golfer.findFirst({ where: { name: row.name } });
    if (!golfer) {
      golfer = await prisma.golfer.create({ data: { name: row.name } });
    }
    fieldRows.push({ tournamentId: TOURNAMENT_ID, golferId: golfer.id, odds: row.odds });
  }
  await prisma.tournamentField.createMany({ data: fieldRows, skipDuplicates: true });

  await prisma.draft.upsert({
    where: { leagueId_tournamentId: { leagueId: league.id, tournamentId: TOURNAMENT_ID } },
    update: {
      status: 'active',
      currentRound: 1,
      currentPickIndex: 0,
      draftOrder: JSON.stringify(draftOrder),
    },
    create: {
      leagueId: league.id,
      tournamentId: TOURNAMENT_ID,
      status: 'active',
      currentRound: 1,
      currentPickIndex: 0,
      draftOrder: JSON.stringify(draftOrder),
    },
  });

  const draft = await prisma.draft.findUnique({
    where: { leagueId_tournamentId: { leagueId: league.id, tournamentId: TOURNAMENT_ID } },
  });
  const fieldCount = await prisma.tournamentField.count({ where: { tournamentId: TOURNAMENT_ID } });
  const oddsCount = await prisma.tournamentField.count({ where: { tournamentId: TOURNAMENT_ID, odds: { not: null } } });
  const orderNames = priorResults.map((r) => r.user.username);

  console.log(JSON.stringify({
    tournamentId: TOURNAMENT_ID,
    draftId: draft?.id,
    fieldCount,
    oddsCount,
    noOdds: rows.filter((r) => r.odds == null).map((r) => r.name),
    draftOrder: orderNames,
    pickDeadline: '2026-06-18T10:25:00.000Z',
    externalId: '401811952',
  }, null, 2));
}

main().finally(async () => prisma.$disconnect());
