import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const FIELD = ["Zach Bauchou", "Christiaan Bezuidenhout", "Akshay Bhatia", "Zac Blair", "Chandler Blanchet", "Keegan Bradley", "Michael Brennan", "Jacob Bridgeman", "Blades Brown", "Dan Brown", "Brian Campbell", "Rafael Campos", "Patrick Cantlay", "Ricky Castillo", "Bud Cauley", "Davis Chatfield", "Luke Clanton", "Wyndham Clark", "Eric Cole", "Corey Conners", "Pierceson Coody", "Cam Davis", "Zecheng Dou", "Adrien Dumont de Chassart", "Nick Dunlap", "Austin Eckroat", "A.J. Ewart", "Tony Finau", "Patrick Fishburn", "Steven Fisk", "Matt Fitzpatrick", "David Ford", "Brice Garnett", "Doug Ghim", "Lucas Glover", "Max Greyserman", "Ben Griffin", "Emiliano Grillo", "Luke Guthrie", "Adam Hadwin", "Garrick Higgo", "Joe Highsmith", "Kensei Hirata", "Ryo Hisatsune", "Lee Hodges", "Rico Hoey", "Charley Hoffman", "Nicolai Højgaard", "Rasmus Højgaard", "Max Homa", "Billy Horschel", "Beau Hossler", "Viktor Hovland", "Mark Hubbard", "Mackenzie Hughes", "Sungjae Im", "Stephan Jaeger", "Takumi Kanaya", "Jeffrey Kang", "Johnny Keefer", "Michael Kim", "S.H. Kim", "Tom Kim", "Patton Kizzire", "Greg Koch", "Brooks Koepka", "Matt Kuchar", "Hank Lebioda", "David Lipsky", "Justin Lower", "Peter Malnati", "Denny McCarthy", "Matt McCarty", "Max McGreevy", "Mac Meissner", "Taylor Moore", "Rasmus Neergaard-Petersen", "Henrik Norlander", "Andrew Novak", "Pontus Nyholm", "Thorbjørn Olesen", "John Parry", "Jeremy Paul", "Matthieu Pavon", "Taylor Pendrith", "Marco Penge", "Paul Peterson", "Chandler Phillips", "Seamus Power", "Andrew Putnam", "Aaron Rai", "Chad Ramey", "Kristoffer Reitan", "Davis Riley", "Patrick Rodgers", "Kevin Roy", "Marcelo Rozo", "Adrien Saddier", "Isaiah Salinda", "Gordon Sargent", "Xander Schauffele", "Adam Schenk", "Matti Schmid", "Neal Shipley", "Webb Simpson", "David Skinns", "Alex Smalley", "Jordan Smith", "Austin Smotherman", "Brandt Snedeker", "J.J. Spaun", "Jordan Spieth", "Jimmy Stanger", "Kevin Streelman", "Jackson Suber", "Adam Svensson", "Jesper Svensson", "Nick Taylor", "Sahith Theegala", "Justin Thomas", "Davis Thompson", "Alejandro Tosti", "Erik van Rooyen", "John VanDerLaan", "Kris Ventura", "Karl Vilips", "Danny Walker", "Matt Wallace", "Paul Waring", "Vince Whaley", "Tyler Wilkes", "Danny Willett", "Gary Woodland", "Dylan Wu", "Kevin Yu", "Joel Dahmen", "Sam Ryder", "Lanto Griffin", "Rikuya Hoshino", "Frankie Capan III", "Carson Young", "Chan Kim", "Hayden Springer", "Harry Higgs", "Greyson Sigg"];

async function main() {
  // Find the Valspar tournament
  const tournament = await prisma.tournament.findFirst({
    where: { name: { contains: 'Valspar' } },
    include: { field: true },
  });
  if (!tournament) throw new Error('Valspar tournament not found');
  console.log(`Found tournament: ${tournament.name} (${tournament.id})`);
  console.log(`Current field size: ${tournament.field.length}`);

  // Clear existing field
  await prisma.tournamentField.deleteMany({ where: { tournamentId: tournament.id } });
  console.log('Cleared existing field');

  // Fetch all existing golfers in one query
  const existingGolfers = await prisma.golfer.findMany({
    select: { id: true, name: true },
  });
  const golferMap = new Map(existingGolfers.map(g => [g.name.toLowerCase(), g.id]));
  console.log(`Existing golfers in DB: ${existingGolfers.length}`);

  // Identify missing golfers and create them in batch
  const missing = FIELD.filter(name => !golferMap.has(name.toLowerCase()));
  console.log(`Creating ${missing.length} new golfers...`);
  if (missing.length > 0) {
    await prisma.golfer.createMany({
      data: missing.map(name => ({ name, ranking: null })),
      skipDuplicates: true,
    });
    // Re-fetch to get IDs
    const newGolfers = await prisma.golfer.findMany({
      where: { name: { in: missing } },
      select: { id: true, name: true },
    });
    newGolfers.forEach(g => golferMap.set(g.name.toLowerCase(), g.id));
  }

  // Build field entries
  const fieldEntries = FIELD
    .map(name => golferMap.get(name.toLowerCase()))
    .filter(Boolean)
    .map(golferId => ({ tournamentId: tournament.id, golferId: golferId! }));

  await prisma.tournamentField.createMany({ data: fieldEntries, skipDuplicates: true });
  console.log(`Done: ${fieldEntries.length} field entries added, ${missing.length} new golfers created`);
  
  // Verify
  const count = await prisma.tournamentField.count({ where: { tournamentId: tournament.id } });
  console.log(`Final field size: ${count}`);
}

main().catch(console.error).finally(() => prisma.$disconnect());
