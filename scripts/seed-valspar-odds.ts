import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// FanDuel odds as of March 17, 2026
const ODDS: Record<string, number> = {
  'Xander Schauffele': 1100,
  'Matt Fitzpatrick': 1300,
  'Viktor Hovland': 1700,
  'Akshay Bhatia': 1900,
  'Justin Thomas': 1900,
  'Jacob Bridgeman': 2000,
  'Jordan Spieth': 2500,
  'Brooks Koepka': 2500,
  'Patrick Cantlay': 2500,
  'Ryo Hisatsune': 2500,
  'Corey Conners': 2700,
  'J.J. Spaun': 3000,
  'Ben Griffin': 3300,
  'Nicolai Højgaard': 3300,
  'Sahith Theegala': 3500,
  'Nick Taylor': 4000,
  'Austin Smotherman': 4000,
  'Taylor Pendrith': 4500,
  'Aaron Rai': 4500,
  'Keegan Bradley': 4500,
  'Davis Thompson': 5000,
  'Rasmus Højgaard': 5000,
  'Wyndham Clark': 5500,
  'Matt McCarty': 6000,
  'Alex Smalley': 6000,
  'Ricky Castillo': 6000,
  'Taylor Moore': 7000,
  'Pierceson Coody': 7000,
  'Max Greyserman': 7000,
  'Patrick Rodgers': 7000,
  'Max McGreevy': 7000,
  'Bud Cauley': 7000,
  'Mac Meissner': 7000,
  'Christiaan Bezuidenhout': 7000,
  'Thorbjørn Olesen': 7500,
  'Kristoffer Reitan': 7500,
  'Max Homa': 7500,
  'Rico Hoey': 8000,
  'Rasmus Neergaard-Petersen': 8000,
  'Marco Penge': 8000,
  'Sungjae Im': 8000,
};

async function main() {
  const tournamentId = 'cmmuryvmt0001qddgppxq74ny'; // Valspar

  const field = await prisma.tournamentField.findMany({
    where: { tournamentId },
    include: { golfer: true },
  });

  console.log(`Updating odds for ${field.length} field entries...`);
  let updated = 0;
  let skipped = 0;

  for (const entry of field) {
    const name = entry.golfer.name;
    const odds = ODDS[name];
    if (odds) {
      await prisma.tournamentField.update({
        where: { id: entry.id },
        data: { odds },
      });
      updated++;
    } else {
      skipped++;
    }
  }

  console.log(`Updated: ${updated}, No odds found: ${skipped}`);

  // Show what got odds vs not
  const withOdds = field.filter(e => ODDS[e.golfer.name]);
  const withoutOdds = field.filter(e => !ODDS[e.golfer.name]);
  console.log('\nPlayers WITHOUT odds (will sort to bottom):');
  withoutOdds.forEach(e => console.log(' -', e.golfer.name));
}

main().catch(console.error).finally(() => prisma.$disconnect());
