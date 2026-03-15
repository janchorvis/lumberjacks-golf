'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';

interface Tournament {
  id: string;
  name: string;
  startDate: string;
  isComplete: boolean;
}

interface StandingsRow {
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

interface BreakdownGolfer {
  golferName: string;
  scoreToPar: number | null;
  isBestFour: boolean;
  isWinner?: boolean;
}

interface BreakdownTeam {
  userId: string;
  username: string;
  totalScore: number;
  picks: BreakdownGolfer[];
}

function formatScore(score: number | null): string {
  if (score == null) return '--';
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

export default function StandingsPage() {
  const [leagueId, setLeagueId] = useState('');
  const [standings, setStandings] = useState<StandingsRow[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Current tournament live scores
  const [currentTournament, setCurrentTournament] = useState<Tournament | null>(null);
  const [liveTeams, setLiveTeams] = useState<{ userId: string; username: string; totalScore: number }[]>([]);

  // Breakdown
  const [selectedTournament, setSelectedTournament] = useState<{ id: string; name: string } | null>(null);
  const [breakdownTeams, setBreakdownTeams] = useState<BreakdownTeam[]>([]);
  const [breakdownLoading, setBreakdownLoading] = useState(false);

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

  useEffect(() => {
    async function fetchTournaments() {
      try {
        const [tournamentsRes, currentRes] = await Promise.all([
          fetch('/api/tournaments'),
          fetch('/api/tournaments/current'),
        ]);
        if (tournamentsRes.ok) {
          const data = await tournamentsRes.json();
          setTournaments(data.tournaments || []);
        }
        if (currentRes.ok) {
          const data = await currentRes.json();
          if (data.tournament && !data.tournament.isComplete) {
            setCurrentTournament(data.tournament);
          }
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load tournaments');
      }
    }
    fetchTournaments();
  }, []);

  const fetchStandings = useCallback(async () => {
    if (!leagueId) return;
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`/api/standings/${leagueId}`);
      if (!res.ok) throw new Error('Failed to fetch standings');
      const data = await res.json();
      setStandings(data.standings || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load standings');
    } finally {
      setLoading(false);
    }
  }, [leagueId]);

  useEffect(() => {
    fetchStandings();
  }, [fetchStandings]);

  // Fetch live scores for current in-progress tournament
  useEffect(() => {
    if (!currentTournament || !leagueId) return;

    async function fetchLive() {
      try {
        const [tournamentRes, picksRes] = await Promise.all([
          fetch(`/api/tournaments/${currentTournament!.id}`),
          fetch(`/api/picks/${currentTournament!.id}/league/${leagueId}`),
        ]);
        if (!tournamentRes.ok || !picksRes.ok) return;
        const tData = await tournamentRes.json();
        const pData = await picksRes.json();
        const results = tData.results || [];
        const resultMap = new Map(results.map((r: { golferId: string; scoreToPar: number | null }) => [r.golferId, r.scoreToPar]));

        const teams = (pData.members || [])
          .filter((m: { picks: unknown[] }) => m.picks.length > 0)
          .map((m: { userId: string; username: string; picks: { golferId: string }[] }) => {
            const scores: number[] = m.picks.map((p) => (resultMap.get(p.golferId) ?? 999) as number);
            scores.sort((a, b) => a - b);
            const totalScore = scores.slice(0, 4).reduce((s, v) => s + (v === 999 ? 99 : v), 0);
            return { userId: m.userId, username: m.username, totalScore };
          });
        teams.sort((a: { totalScore: number }, b: { totalScore: number }) => a.totalScore - b.totalScore);
        setLiveTeams(teams);
      } catch {
        // ignore
      }
    }
    fetchLive();
  }, [currentTournament, leagueId]);

  async function handleTournamentClick(tournamentId: string, tournamentName: string) {
    if (selectedTournament?.id === tournamentId) {
      setSelectedTournament(null);
      setBreakdownTeams([]);
      return;
    }

    setSelectedTournament({ id: tournamentId, name: tournamentName });
    setBreakdownLoading(true);
    try {
      const res = await fetch(`/api/standings/${leagueId}/${tournamentId}`);
      if (!res.ok) throw new Error('Failed to fetch breakdown');
      const data = await res.json();
      setBreakdownTeams(
        (data.breakdown || []).map(
          (team: { userId: string; username: string; totalScore: number; picks: BreakdownGolfer[] }) => ({
            ...team,
          })
        )
      );
    } catch {
      setBreakdownTeams([]);
    } finally {
      setBreakdownLoading(false);
    }
  }

  const completedTournaments = tournaments.filter((t) => t.isComplete);
  const sorted = [...standings].sort((a, b) => b.totalPoints - a.totalPoints);

  return (
    <div className="px-4 py-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <h1 className="text-xl font-bold text-gray-900 font-serif">Standings</h1>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</div>
      )}

      {loading && leagueId && (
        <div className="flex items-center justify-center min-h-[40vh]">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-augusta-green" />
        </div>
      )}

      {/* Cumulative standings */}
      {!loading && sorted.length > 0 && (
        <div className="space-y-2">
          {sorted.map((row, index) => {
            const rank = index + 1;
            return (
              <Card key={row.userId} goldBorder={rank === 1} className="overflow-hidden">
                <div className="px-4 py-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span
                        className={`w-7 h-7 rounded-full text-xs font-bold flex items-center justify-center ${
                          rank === 1
                            ? 'bg-augusta-gold text-gray-900'
                            : 'bg-gray-200 text-gray-600'
                        }`}
                      >
                        {rank}
                      </span>
                      <span className="font-semibold text-gray-900">{row.username}</span>
                    </div>
                    <span className="text-lg font-bold text-augusta-green">{row.totalPoints} pts</span>
                  </div>

                  {row.weeklyResults.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {row.weeklyResults.map((wr) => (
                        <span
                          key={wr.tournamentId}
                          className={`text-xs px-2 py-0.5 rounded-full ${
                            wr.rank === 1
                              ? 'bg-augusta-gold/20 text-augusta-green font-semibold'
                              : 'bg-gray-100 text-gray-500'
                          }`}
                        >
                          {wr.tournamentName}: {wr.points}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {!loading && sorted.length === 0 && leagueId && (
        <Card className="p-8 text-center">
          <p className="text-gray-500 text-sm">No standings data yet. Check back after the first tournament.</p>
        </Card>
      )}

      {/* In-progress tournament scores */}
      {currentTournament && liveTeams.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-augusta-green animate-pulse" />
            {currentTournament.name} (In Progress)
          </h3>
          <Card className="overflow-hidden divide-y divide-gray-100">
            {liveTeams.map((team, i) => (
              <div key={team.userId} className="flex items-center justify-between px-4 py-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-5">{i + 1}.</span>
                  <span className="text-sm font-medium text-gray-900">{team.username}</span>
                </div>
                <span className={`text-sm font-bold ${team.totalScore < 0 ? 'text-red-600' : team.totalScore > 0 ? 'text-gray-700' : 'text-augusta-green'}`}>
                  {formatScore(team.totalScore)}
                </span>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Tournament breakdown selector */}
      {completedTournaments.length > 0 && (
        <div>
          <p className="text-xs text-gray-400 mb-2">View breakdown:</p>
          <div className="flex flex-wrap gap-2">
            {completedTournaments.map((t) => (
              <button
                key={t.id}
                onClick={() => handleTournamentClick(t.id, t.name)}
                className={`text-xs px-3 py-1.5 rounded-full transition-colors min-h-[32px] ${
                  selectedTournament?.id === t.id
                    ? 'bg-augusta-green text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-augusta-green/10'
                }`}
              >
                {t.name}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Weekly breakdown */}
      {selectedTournament && (
        <div>
          {breakdownLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-augusta-green" />
            </div>
          ) : (
            <div className="space-y-3">
              <h3 className="text-sm font-semibold text-gray-700">{selectedTournament.name}</h3>
              {breakdownTeams
                .sort((a, b) => a.totalScore - b.totalScore)
                .map((team, i) => (
                  <Card key={team.userId} goldBorder={i === 0} className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400">#{i + 1}</span>
                        <span className="font-semibold text-gray-900 text-sm">{team.username}</span>
                      </div>
                      <span className="text-sm font-bold text-augusta-green">{formatScore(team.totalScore)}</span>
                    </div>
                    <div className="space-y-1">
                      {team.picks
                        .sort((a, b) => (a.scoreToPar ?? 999) - (b.scoreToPar ?? 999))
                        .map((g, gi) => (
                          <div
                            key={gi}
                            className={`flex items-center justify-between text-sm py-0.5 px-1 rounded ${
                              g.isBestFour ? 'text-gray-900' : 'text-gray-400 line-through'
                            }`}
                          >
                            <span className="truncate text-xs">{g.isWinner ? '🏆 ' : ''}{g.golferName}</span>
                            <span className={`font-medium ml-2 text-xs ${g.isBestFour ? 'text-augusta-green' : ''}`}>
                              {formatScore(g.scoreToPar)}
                            </span>
                          </div>
                        ))}
                    </div>
                  </Card>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
