export type UserRole = 'user' | 'admin';

export interface SafeUser {
  id: string;
  email: string;
  username: string;
  isAdmin: boolean;
}

export interface TournamentWithDetails {
  id: string;
  name: string;
  course: string;
  location: string;
  startDate: string;
  endDate: string;
  pickDeadline: string;
  isComplete: boolean;
  field?: FieldGolfer[];
  results?: GolferResult[];
}

export interface FieldGolfer {
  id: string;
  golferId: string;
  golferName: string;
  ranking: number | null;
}

export interface GolferResult {
  golferId: string;
  golferName: string;
  position: number | null;
  scoreToPar: number | null;
  r1Score: number | null;
  r2Score: number | null;
  r3Score: number | null;
  r4Score: number | null;
  status: string;
  thru: number | null;
}

export interface LeagueWithMembers {
  id: string;
  name: string;
  inviteCode: string;
  members: { userId: string; username: string }[];
}

export interface StandingsRow {
  userId: string;
  username: string;
  totalPoints: number;
  weeklyResults: {
    tournamentId: string;
    tournamentName: string;
    points: number;
    rank: number;
    totalScore: number;
  }[];
}

export interface PickWithGolfer {
  id: string;
  golferId: string;
  golferName: string;
  pickOrder: number;
  scoreToPar?: number | null;
  status?: string;
}
