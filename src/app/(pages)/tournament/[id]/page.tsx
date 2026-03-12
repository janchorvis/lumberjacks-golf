'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams } from 'next/navigation';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { GolferResult } from '@/types';



interface MemberPick {
  userId: string;
  username: string;
  hasPicked: boolean;
  picks: {
    id: string;
    golferId: string;
    golferName: string;
    pickOrder: number;
  }[];
}

interface TournamentData {
  id: string;
  name: string;
  course: string;
  startDate: string;
  endDate: string;
  isComplete: boolean;
  results?: GolferResult[];
}

interface TeamGolfer {
  name: string;
  scoreToPar: number | null;
  r1: number | null;
  r2: number | null;
  r3: number | null;
  r4: number | null;
  isCounting: boolean;
  status: string;
}

interface Team {
  userId: string;
  username: string;
  totalScore: number;
  points: number;
  golfers: TeamGolfer[];
}

// Module-level cache keyed by tournamentId — survives tab switches
const _tournamentCache = new Map<string, { tournament: TournamentData; teams: Team[] }>();

const POINTS_MAP: Record<number, number> = { 1: 200, 2: 100, 3: 50 };

function formatScore(score: number | null): string {
  if (score == null) return '--';
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

function formatRound(score: number | null): string {
  return score != null ? String(score) : '-';
}

function buildTeams(members: MemberPick[], results: GolferResult[]): Team[] {
  const resultMap = new Map(results.map((r) => [r.golferId, r]));

  const teams = members
    .filter((m) => m.picks.length > 0)
    .map((member) => {
      const golferScores = member.picks.map((pick) => {
        const result = resultMap.get(pick.golferId);
        return {
          name: pick.golferName,
          scoreToPar: result?.scoreToPar ?? null,
          r1: result?.r1Score ?? null,
          r2: result?.r2Score ?? null,
          r3: result?.r3Score ?? null,
          r4: result?.r4Score ?? null,
          status: result?.status ?? 'active',
          _sort: result?.scoreToPar ?? 999,
        };
      });

      // Only determine counting golfers if at least one has a real score
      const anyScores = golferScores.some(g => g.scoreToPar != null);
      const sorted = [...golferScores].sort((a, b) => a._sort - b._sort);

      const golfers: TeamGolfer[] = golferScores.map((g) => ({
        name: g.name,
        scoreToPar: g.scoreToPar,
        r1: g.r1,
        r2: g.r2,
        r3: g.r3,
        r4: g.r4,
        isCounting: anyScores ? sorted.indexOf(g) < 4 : true,
        status: g.status,
      }));

      if (anyScores) {
        golfers.sort((a, b) => {
          if (a.isCounting !== b.isCounting) return a.isCounting ? -1 : 1;
          return (a.scoreToPar ?? 999) - (b.scoreToPar ?? 999);
        });
      }

      const countingScores = anyScores ? sorted.slice(0, 4) : [];
      const totalScore = anyScores
        ? countingScores.reduce((sum, g) => sum + (g.scoreToPar ?? 0), 0)
        : 0;

      return { userId: member.userId, username: member.username, totalScore, points: 0, golfers };
    });

  teams.sort((a, b) => a.totalScore - b.totalScore);
  let i = 0;
  while (i < teams.length) {
    let j = i;
    while (j < teams.length && teams[j].totalScore === teams[i].totalScore) j++;
    let totalPts = 0;
    for (let k = i; k < j; k++) totalPts += POINTS_MAP[k + 1] ?? 0;
    const split = Math.round(totalPts / (j - i));
    for (let k = i; k < j; k++) teams[k].points = split;
    i = j;
  }

  return teams;
}

export default function TournamentPage() {
  const params = useParams();
  const tournamentId = params.id as string;
  const cached = _tournamentCache.get(tournamentId);

  const [tournament, setTournament] = useState<TournamentData | null>(cached?.tournament ?? null);
  const [leagueId, setLeagueId] = useState<string>('');
  const [teams, setTeams] = useState<Team[]>(cached?.teams ?? []);
  const [loading, setLoading] = useState(!cached);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);


  const fetchTournament = useCallback(async () => {
    try {
      const res = await fetch(`/api/tournaments/${tournamentId}`);
      if (!res.ok) throw new Error('Failed to fetch tournament');
      const data = await res.json();
      setTournament(data);
      return data;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load tournament');
      return null;
    }
  }, [tournamentId]);

  useEffect(() => {
    async function fetchLeague() {
      try {
        const res = await fetch('/api/leagues');
        if (!res.ok) throw new Error('Failed to fetch leagues');
        const data = await res.json();
        if (data.leagues?.length > 0) setLeagueId(data.leagues[0].id);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load league');
      }
    }
    fetchLeague();
  }, []);

  const fetchPicksAndBuild = useCallback(
    async (tournamentData?: TournamentData | null) => {
      const t = tournamentData || tournament;
      if (!t || !leagueId) return;
      try {
        const res = await fetch(`/api/picks/${tournamentId}/league/${leagueId}`);
        if (!res.ok) throw new Error('Failed to fetch picks');
        const data = await res.json();
        const builtTeams = buildTeams(data.members || [], t.results || []);
        setTeams(builtTeams);
        // Save to module cache
        _tournamentCache.set(tournamentId, { tournament: t, teams: builtTeams });
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load picks');
      }
    },
    [tournament, leagueId, tournamentId]
  );

  useEffect(() => {
    async function init() {
      if (!_tournamentCache.has(tournamentId)) setLoading(true);
      const t = await fetchTournament();
      if (t && leagueId) await fetchPicksAndBuild(t);
      setLoading(false);
    }
    if (leagueId) init();
  }, [leagueId, tournamentId, fetchTournament, fetchPicksAndBuild]);

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    const t = await fetchTournament();
    await fetchPicksAndBuild(t);
    setRefreshing(false);
  }, [fetchTournament, fetchPicksAndBuild]);

  useEffect(() => {
    if (tournament && !tournament.isComplete) {
      intervalRef.current = setInterval(handleRefresh, 60000);
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [tournament, handleRefresh]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-augusta-green" />
      </div>
    );
  }

  if (error && !tournament) {
    return (
      <div className="px-4 py-6">
        <Card className="p-8 text-center">
          <p className="text-red-600 text-sm">{error}</p>
        </Card>
      </div>
    );
  }

  if (!tournament) return null;

  const hasAnyScores = teams.some(t => t.golfers.some(g => g.scoreToPar != null));
  const tournamentStarted = new Date(tournament.startDate) <= new Date();

  return (
    <div className="px-4 py-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <h1 className="text-xl font-bold text-gray-900 font-serif">{tournament.name}</h1>
        <p className="text-sm text-gray-500">{tournament.course}</p>
        <div className="flex items-center justify-center gap-2 mt-1">
          {tournament.isComplete ? (
            <span className="text-xs font-medium text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
              Final
            </span>
          ) : tournamentStarted && hasAnyScores ? (
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-augusta-green bg-augusta-green/10 px-3 py-1 rounded-full">
              <span className="w-1.5 h-1.5 rounded-full bg-augusta-green animate-pulse" />
              Live
            </span>
          ) : (
            <span className="text-xs font-medium text-gray-500 bg-gray-100 px-3 py-1 rounded-full">
              Starts {new Date(tournament.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </span>
          )}
        </div>
      </div>

      {/* Refresh */}
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" loading={refreshing} onClick={handleRefresh} disabled={refreshing}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
      )}

      {teams.length === 0 && leagueId && (
        <Card className="p-8 text-center">
          <p className="text-gray-500 text-sm">No teams to display yet.</p>
        </Card>
      )}

      {/* Teams stacked on mobile */}
      <div className="space-y-4">
        {teams.map((team, teamIdx) => (
          <Card
            key={team.userId}
            goldBorder={teamIdx === 0}
            className="overflow-hidden"
          >
            {/* Team header */}
            <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-b border-gray-100">
              <div className="flex items-center gap-3">
                <span className="w-7 h-7 rounded-full bg-augusta-green text-white text-xs font-bold flex items-center justify-center">
                  {teamIdx + 1}
                </span>
                <span className="font-semibold text-gray-900">{team.username}</span>
              </div>
              <div className="text-right">
                {hasAnyScores ? (
                  <>
                    <span
                      className={`text-lg font-bold ${
                        team.totalScore < 0
                          ? 'text-red-600'
                          : team.totalScore > 0
                          ? 'text-gray-700'
                          : 'text-augusta-green'
                      }`}
                    >
                      {formatScore(team.totalScore)}
                    </span>
                    {team.points > 0 && (
                      <p className="text-xs text-augusta-gold font-semibold">{team.points} pts</p>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-gray-400">Awaiting scores</span>
                )}
              </div>
            </div>

            {/* Golfer rows */}
            <div className="divide-y divide-gray-50">
              {team.golfers.map((g, gi) => {
                const isDropped = !g.isCounting;
                const isCut = ['cut', 'wd', 'dq', 'CUT', 'WD', 'DQ'].includes(g.status);
                return (
                  <div
                    key={gi}
                    className={`px-4 py-2.5 ${
                      isDropped ? 'opacity-50' : ''
                    } ${g.isCounting ? 'bg-[#006747]/[0.03]' : ''}`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p
                          className={`text-sm font-medium truncate ${
                            isDropped ? 'line-through text-gray-400' : 'text-gray-900'
                          }`}
                        >
                          {g.name}
                          {isCut && (
                            <span className="ml-1.5 text-[10px] text-red-500 font-semibold uppercase no-underline inline-block" style={{textDecoration: 'none'}}>
                              {g.status.toUpperCase()}
                            </span>
                          )}
                        </p>
                      </div>
                      <span
                        className={`text-sm font-bold ml-2 ${
                          isDropped
                            ? 'text-gray-400'
                            : g.scoreToPar != null && g.scoreToPar < 0
                            ? 'text-red-600'
                            : g.scoreToPar != null && g.scoreToPar > 0
                            ? 'text-gray-700'
                            : 'text-augusta-green'
                        }`}
                      >
                        {formatScore(g.scoreToPar)}
                      </span>
                    </div>
                    {hasAnyScores && (
                      <div className="flex gap-3 mt-1">
                        {['R1', 'R2', 'R3', 'R4'].map((label, i) => {
                          const score = [g.r1, g.r2, g.r3, g.r4][i];
                          return (
                            <span key={label} className={`text-xs ${isDropped ? 'text-gray-300' : 'text-gray-400'}`}>
                              {label}: {formatRound(score)}
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
