import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const SEASON_ID = 'cmml7bgvn0000xihq3cqppwlx';

// Full field from thegolfnewsnet.com (135 players, minus 2 Monday qualifiers TBD)
const FIELD: string[] = [
  'Zach Bauchou', 'Christiaan Bezuidenhout', 'Chandler Blanchet', 'Michael Brennan',
  'Dan Brown', 'Bronson Burgoon', 'Sam Burns', 'Brian Campbell', 'Rafael Campos',
  'Ricky Castillo', 'Bud Cauley', 'Davis Chatfield', 'Luke Clanton', 'Wyndham Clark',
  'Eric Cole', 'Pierceson Coody', 'Cam Davis', 'Jason Day', 'Zecheng Dou',
  'Adrien Dumont de Chassart', 'Nick Dunlap', 'Nico Echavarria', 'Austin Eckroat',
  'Harris English', 'A.J. Ewart', 'Tony Finau', 'Patrick Fishburn', 'Steven Fisk',
  'David Ford', 'Rickie Fowler', 'Ryan Fox', 'Brice Garnett', 'Ryan Gerard',
  'Lucas Glover', 'Chris Gotterup', 'Max Greyserman', 'Ben Griffin', 'Emiliano Grillo',
  'Harry Hall', 'Cole Hammer', 'Garrick Higgo', 'Joe Highsmith', 'Kensei Hirata',
  'Ryo Hisatsune', 'Lee Hodges', 'Rico Hoey', 'Charley Hoffman', 'Tom Hoge',
  'Nicolai Højgaard', 'Rasmus Højgaard', 'Billy Horschel', 'Beau Hossler',
  'Mason Howell', 'Mark Hubbard', 'Mackenzie Hughes', 'Sungjae Im', 'Stephan Jaeger',
  'Takumi Kanaya', 'Jeffrey Kang', 'Johnny Keefer', 'Michael Kim', 'S.H. Kim',
  'Tom Kim', 'Chris Kirk', 'Kurt Kitayama', 'Patton Kizzire', 'Jake Knapp',
  'Brooks Koepka', 'Christo Lamprecht', 'Hank Lebioda', 'K.H. Lee', 'Min Woo Lee',
  'Haotong Li', 'David Lipsky', 'Shane Lowry', 'Peter Malnati', 'Denny McCarthy',
  'Matt McCarty', 'Max McGreevy', 'Mac Meissner', 'Keith Mitchell', 'William Mouw',
  'Trey Mullinax', 'Petersen Neergaard', 'Pontus Nyholm', 'Thorbjørn Olesen',
  'John Parry', 'Matthieu Pavon', 'Taylor Pendrith', 'Marco Penge', 'Chandler Phillips',
  'J.T. Poston', 'Aldrich Potgieter', 'Aaron Rai', 'Chad Ramey', 'Kristoffer Reitan',
  'Davis Riley', 'Patrick Rodgers', 'Kevin Roy', 'Marcelo Rozo', 'Casey Russell',
  'Adrien Saddier', 'Isaiah Salinda', 'Gordon Sargent', 'Scottie Scheffler',
  'Adam Schenk', 'Matti Schmid', 'Adam Scott', 'Neal Shipley', 'Alex Smalley',
  'Jordan Smith', 'Austin Smotherman', 'Sam Stevens', 'Adam Svensson', 'Sahith Theegala',
  'Davis Thompson', 'Michael Thorbjornsen', 'Alejandro Tosti', 'Erik van Rooyen',
  'John VanDerLaan', 'Jhonattan Vegas', 'Karl Vilips', 'Danny Walker', 'Matt Wallace',
  'Vince Whaley', 'Aaron Wise', 'Gary Woodland', 'Dylan Wu', 'Sudarshan Yellamaraju',
  'Kevin Yu', 'Will Zalatoris',
];

function normalize(s: string) {
  return s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z ]/g, '').trim();
}

function fuzzyMatch(a: string, b: string): number {
  const na = normalize(a), nb = normalize(b);
  if (na === nb) return 1;
  if (nb.includes(na) || na.includes(nb)) return 0.9;
  const aWords = na.split(/\s+/), bWords = nb.split(/\s+/);
  if (aWords[aWords.length-1] === bWords[bWords.length-1]) return 0.8;
  for (const w of aWords) if (w.length > 2 && bWords.includes(w)) return 0.6;
  return 0;
}

async function main() {
  // Create tournament
  const tournament = await prisma.tournament.create({
    data: {
      name: "Texas Children's Houston Open",
      startDate: new Date('2026-03-26'),
      endDate: new Date('2026-03-29'),
      externalId: '401811939',
      course: 'Memorial Park Golf Course',
      location: 'Houston, TX',
      pickDeadline: new Date('2026-03-26T11:00:00Z'), // 6am CT Thursday
      isComplete: false,
      seasonId: SEASON_ID,
    },
  });
  console.log('Created tournament:', tournament.id, tournament.name);

  // Load all existing golfers
  const allGolfers = await prisma.golfer.findMany({ select: { id: true, name: true } });
  console.log('Existing golfers in DB:', allGolfers.length);

  let matched = 0, created = 0, notFound: string[] = [];

  for (const name of FIELD) {
    // Try fuzzy match first
    let bestMatch: { id: string; name: string } | null = null;
    let bestScore = 0;
    for (const g of allGolfers) {
      const score = fuzzyMatch(name, g.name);
      if (score > bestScore) { bestScore = score; bestMatch = g; }
    }

    let golferId: string;
    if (bestMatch && bestScore >= 0.8) {
      golferId = bestMatch.id;
      matched++;
    } else {
      // Create new golfer
      const newGolfer = await prisma.golfer.create({ data: { name } });
      allGolfers.push({ id: newGolfer.id, name: newGolfer.name });
      golferId = newGolfer.id;
      created++;
      if (bestScore < 0.5) notFound.push(name);
      else console.log(`  Created (low confidence match ${bestScore.toFixed(2)}): ${name} (closest: ${bestMatch?.name})`);
    }

    await prisma.tournamentField.create({
      data: { tournamentId: tournament.id, golferId },
    });
  }

  console.log(`\nField seeded: ${FIELD.length} players`);
  console.log(`  Matched existing: ${matched}`);
  console.log(`  Created new: ${created}`);
  if (notFound.length) console.log(`  Truly new golfers:`, notFound);

  console.log('\nTournament ID:', tournament.id);
  console.log('ESPN ID: 401811939');
}

main().catch(console.error).finally(() => prisma.$disconnect());
