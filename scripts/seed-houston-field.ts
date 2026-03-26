import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const TOURNAMENT_ID = 'cmn2kyqkk000110dvzqy62qbz';

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
  // Clear any partial field entries from failed first run
  const deleted = await prisma.tournamentField.deleteMany({ where: { tournamentId: TOURNAMENT_ID } });
  console.log('Cleared existing field entries:', deleted.count);

  const allGolfers = await prisma.golfer.findMany({ select: { id: true, name: true } });
  console.log('Golfers in DB:', allGolfers.length);

  const usedGolferIds = new Set<string>();
  let matched = 0, created = 0, newNames: string[] = [];

  for (const name of FIELD) {
    let bestMatch: { id: string; name: string } | null = null;
    let bestScore = 0;
    for (const g of allGolfers) {
      if (usedGolferIds.has(g.id)) continue; // don't double-assign
      const score = fuzzyMatch(name, g.name);
      if (score > bestScore) { bestScore = score; bestMatch = g; }
    }

    let golferId: string;
    if (bestMatch && bestScore >= 0.8) {
      golferId = bestMatch.id;
      matched++;
    } else {
      const newGolfer = await prisma.golfer.create({ data: { name } });
      allGolfers.push({ id: newGolfer.id, name: newGolfer.name });
      golferId = newGolfer.id;
      created++;
      newNames.push(name);
      if (bestScore >= 0.5) console.log(`  Low confidence (${bestScore.toFixed(2)}): "${name}" → closest: "${bestMatch?.name}" — created new`);
    }

    usedGolferIds.add(golferId);
    await prisma.tournamentField.create({ data: { tournamentId: TOURNAMENT_ID, golferId } });
  }

  console.log(`\nDone: ${FIELD.length} field entries`);
  console.log(`  Matched existing: ${matched}`);
  console.log(`  Created new: ${created} —`, newNames);
}

main().catch(console.error).finally(() => prisma.$disconnect());
