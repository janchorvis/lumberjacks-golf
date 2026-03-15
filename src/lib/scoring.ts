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

function sortGolfersByScore(golfers: GolferScore[]): GolferScore[] {
  return [...golfers].sort((a, b) => {
    if (a.scoreToPar === null && b.scoreToPar === null) return 0;
    if (a.scoreToPar === null) return 1;
    if (b.scoreToPar === null) return -1;
    return a.scoreToPar - b.scoreToPar;
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
  const totalScore = bestFour.reduce((sum, g) => sum + (g.scoreToPar ?? 99), 0);
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
