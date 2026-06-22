// Pure scoring engine — no DB imports

export interface GolferScore {
  golferId: string;
  golferName?: string;
  scoreToPar: number | null;
  status: 'active' | 'cut' | 'wd' | 'dq';
}

export interface TeamPicks {
  userId: string;
  golfers: GolferScore[];
}

export interface WeeklyTeamResult {
  userId: string;
  bestFour: GolferScore[];
  dropped: GolferScore[];
  totalScore: number;
  rank: number;
  points: number;
}

const POINTS_MAP: Record<number, number> = {
  1: 200,
  2: 100,
  3: 50,
  4: 0,
};

export function getEffectiveScoreToPar(golfer: GolferScore): number | null {
  if (golfer.scoreToPar === null) return null;

  // Lumberjacks missed-cut rule:
  // a player who misses the cut should not keep their two-round score as if it
  // were a final 72-hole result. Treat all CUT/WD/DQ golfers as a blow-up score
  // so they fall behind every player who completed the tournament.
  if (golfer.status === 'cut' || golfer.status === 'wd' || golfer.status === 'dq') {
    return 99;
  }

  return golfer.scoreToPar;
}

function sortGolfersByScore(golfers: GolferScore[]): GolferScore[] {
  return [...golfers].sort((a, b) => {
    const aScore = getEffectiveScoreToPar(a);
    const bScore = getEffectiveScoreToPar(b);
    if (aScore === null && bScore === null) return 0;
    if (aScore === null) return 1;
    if (bScore === null) return -1;
    return aScore - bScore;
  });
}

export function calculateBestFour(golfers: GolferScore[]): {
  bestFour: GolferScore[];
  dropped: GolferScore[];
  totalScore: number;
} {
  const sorted = sortGolfersByScore(golfers);
  const bestFour = sorted.slice(0, 4);
  const dropped = sorted.slice(4);
  const totalScore = bestFour.reduce((sum, g) => sum + (getEffectiveScoreToPar(g) ?? 99), 0);
  return { bestFour, dropped, totalScore };
}

export function calculateWeeklyResults(
  teams: TeamPicks[],
  winnerGolferId?: string | null
): WeeklyTeamResult[] {
  // Calculate best 4 for each team
  const teamResults = teams.map((team) => {
    const { bestFour, dropped, totalScore } = calculateBestFour(team.golfers);
    return { userId: team.userId, bestFour, dropped, totalScore, rank: 0, points: 0 };
  });

  // Sort by totalScore ascending (lowest wins)
  teamResults.sort((a, b) => a.totalScore - b.totalScore);

  // Assign ranks and points with tiebreaker logic
  let i = 0;
  while (i < teamResults.length) {
    let j = i;
    while (j < teamResults.length && teamResults[j].totalScore === teamResults[i].totalScore) {
      j++;
    }

    const tiedCount = j - i;
    let totalPoints = 0;
    for (let k = i; k < j; k++) {
      totalPoints += POINTS_MAP[k + 1] ?? 0;
    }
    const splitPoints = Math.round(totalPoints / tiedCount);

    for (let k = i; k < j; k++) {
      teamResults[k].rank = i + 1;
      teamResults[k].points = splitPoints;
    }

    i = j;
  }

  // Winner bonus: team that drafted the tournament winner gets +100 pts
  if (winnerGolferId) {
    for (const team of teamResults) {
      const hasWinner = team.bestFour.some((g) => g.golferId === winnerGolferId) ||
        team.dropped.some((g) => g.golferId === winnerGolferId);
      if (hasWinner) {
        team.points += 100;
        break; // Only one winner
      }
    }
  }

  return teamResults;
}
