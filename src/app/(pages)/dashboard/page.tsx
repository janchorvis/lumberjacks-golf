'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';

// Module-level cache — survives tab switches (component remounts)
let _dashboardCache: { user: User; tournament: Tournament | null; standings: Standing[]; draftInfo: DraftInfo | null; myTeam: MyPick[] } | null = null;

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
}

interface Tournament {
  id: string;
  name: string;
  courseName: string;
  course: string;
  startDate: string;
  endDate: string;
  pickDeadline: string;
  isComplete: boolean;
}

interface Standing {
  userId: string;
  username: string;
  totalPoints: number;
}

interface DraftInfo {
  status: string;
  currentRound: number;
  totalPicks: number;
  currentDrafter: string | null;
  players: { userId: string; username: string }[];
}

interface MyPick {
  golferName: string;
  scoreToPar: number | null;
}

function formatScore(score: number | null): string {
  if (score == null) return '--';
  if (score === 0) return 'E';
  return score > 0 ? `+${score}` : `${score}`;
}

export default function DashboardPage() {
  const cached = _dashboardCache;
  const [user, setUser] = useState<User | null>(cached?.user ?? null);
  const [tournament, setTournament] = useState<Tournament | null>(cached?.tournament ?? null);
  const [standings, setStandings] = useState<Standing[]>(cached?.standings ?? []);
  const [draftInfo, setDraftInfo] = useState<DraftInfo | null>(cached?.draftInfo ?? null);
  const [myTeam, setMyTeam] = useState<MyPick[]>(cached?.myTeam ?? []);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      // Local vars to accumulate before setting state + cache
      let fetchedUser: User | null = null;
      let fetchedTournament: Tournament | null = null;
      let fetchedStandings: Standing[] = [];
      let fetchedDraftInfo: DraftInfo | null = null;
      let fetchedMyTeam: MyPick[] = [];

      try {
        const [meRes, tournamentRes, leaguesRes] = await Promise.all([
          fetch('/api/auth/me'),
          fetch('/api/tournaments/current'),
          fetch('/api/leagues'),
        ]);

        if (!meRes.ok) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        const meData = await meRes.json();
        fetchedUser = meData.user;

        if (tournamentRes.ok) {
          const tournamentData = await tournamentRes.json();
          fetchedTournament = tournamentData.tournament;
        }

        if (leaguesRes.ok) {
          const leaguesData = await leaguesRes.json();

          if (leaguesData.leagues?.length > 0) {
            const leagueId = leaguesData.leagues[0].id;

            const standingsRes = await fetch(`/api/standings/${leagueId}`);
            if (standingsRes.ok) {
              const standingsData = await standingsRes.json();
              fetchedStandings = standingsData.standings || [];
            }

            if (fetchedTournament) {
              try {
                const draftRes = await fetch(`/api/draft/${fetchedTournament.id}`);
                if (draftRes.ok) {
                  const draftData = await draftRes.json();
                  fetchedDraftInfo = draftData.draft;
                }
              } catch { /* no draft */ }

              try {
                const [picksRes, detailRes] = await Promise.all([
                  fetch(`/api/picks/${fetchedTournament.id}?leagueId=${leagueId}`),
                  fetch(`/api/tournaments/${fetchedTournament.id}`),
                ]);
                if (picksRes.ok && detailRes.ok) {
                  const picksData = await picksRes.json();
                  const detail = await detailRes.json();
                  const picks = picksData.picks || [];
                  const resultMap = new Map(
                    (detail.results || []).map((r: { golferId: string; scoreToPar: number | null }) => [r.golferId, r.scoreToPar])
                  );
                  fetchedMyTeam = picks.map((p: { golferId: string; golferName: string }) => ({
                    golferName: p.golferName,
                    scoreToPar: (resultMap.get(p.golferId) as number | null) ?? null,
                  }));
                }
              } catch { /* no picks */ }
            }
          }
        }

        // Save to module cache — survives tab switches
        if (fetchedUser) {
          _dashboardCache = {
            user: fetchedUser,
            tournament: fetchedTournament,
            standings: fetchedStandings,
            draftInfo: fetchedDraftInfo,
            myTeam: fetchedMyTeam,
          };
        }

        // Batch state updates
        if (fetchedUser) setUser(fetchedUser);
        setTournament(fetchedTournament);
        setStandings(fetchedStandings);
        setDraftInfo(fetchedDraftInfo);
        setMyTeam(fetchedMyTeam);
      } catch {
        if (!_dashboardCache) setError('Failed to load dashboard data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-augusta-green" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Card className="p-8 text-center max-w-md">
          <p className="text-red-600 font-medium">{error}</p>
          <Link href="/" className="text-augusta-green underline mt-2 inline-block text-sm">
            Go to Login
          </Link>
        </Card>
      </div>
    );
  }

  const isMyTurn = draftInfo?.currentDrafter === user?.id;

  return (
    <div className="px-4 py-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Welcome */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">
          Welcome, <span className="text-augusta-green">{user?.username}</span>
        </h1>
      </div>

      {/* Current Tournament */}
      <Card goldBorder className="p-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
          Current Tournament
        </h2>
        {tournament ? (
          <div className="space-y-2">
            <p className="text-lg font-bold text-augusta-green">{tournament.name}</p>
            <p className="text-sm text-gray-500">{tournament.courseName || tournament.course}</p>
            <p className="text-xs text-gray-400">
              {new Date(tournament.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              {' - '}
              {new Date(tournament.endDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
            <Link href={`/tournament/${tournament.id}`}>
              <Button variant="secondary" size="sm" className="mt-1">View Leaderboard</Button>
            </Link>
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No upcoming tournament scheduled.</p>
        )}
      </Card>

      {/* Draft Status */}
      {draftInfo && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Draft</h2>
            <span
              className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                draftInfo.status === 'active'
                  ? 'bg-green-100 text-green-800'
                  : draftInfo.status === 'complete'
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-yellow-100 text-yellow-800'
              }`}
            >
              {draftInfo.status.charAt(0).toUpperCase() + draftInfo.status.slice(1)}
            </span>
          </div>
          {draftInfo.status === 'active' && (
            <div className="space-y-2">
              <p className="text-sm text-gray-700">
                Round {draftInfo.currentRound} &middot; {draftInfo.totalPicks}/28 picks
              </p>
              {isMyTurn && (
                <div className="bg-augusta-gold/20 border border-augusta-gold rounded-lg px-3 py-2 text-center">
                  <p className="text-sm font-bold text-augusta-green">It&apos;s your turn!</p>
                </div>
              )}
              <Link href="/draft">
                <Button variant={isMyTurn ? 'primary' : 'secondary'} size="sm" className="w-full">
                  {isMyTurn ? 'Make Your Pick' : 'View Draft'}
                </Button>
              </Link>
            </div>
          )}
          {draftInfo.status === 'complete' && (
            <p className="text-sm text-gray-500">Draft complete! All picks are in.</p>
          )}
          {draftInfo.status === 'pending' && (
            <p className="text-sm text-gray-500">Draft not started yet.</p>
          )}
        </Card>
      )}

      {/* My Team Summary */}
      {myTeam.length > 0 && (
        <Card className="p-4">
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">My Team</h2>
            <Link href="/picks" className="text-xs text-augusta-green font-medium">View All</Link>
          </div>
          <div className="space-y-1">
            {myTeam.slice(0, 4).map((g, i) => (
              <div key={i} className="flex items-center justify-between py-1">
                <span className="text-sm text-gray-900 truncate">{g.golferName}</span>
                <span className={`text-sm font-semibold ${
                  g.scoreToPar != null && g.scoreToPar < 0 ? 'text-red-600' :
                  g.scoreToPar != null && g.scoreToPar > 0 ? 'text-gray-600' :
                  g.scoreToPar === 0 ? 'text-augusta-green' : 'text-gray-300'
                }`}>
                  {formatScore(g.scoreToPar)}
                </span>
              </div>
            ))}
            {myTeam.length > 4 && (
              <p className="text-xs text-gray-400 text-center pt-1">+{myTeam.length - 4} more</p>
            )}
          </div>
        </Card>
      )}

      {/* Standings Snapshot */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide">Standings</h2>
          <Link href="/standings" className="text-xs text-augusta-green font-medium">Full Standings</Link>
        </div>
        {standings.length > 0 ? (
          <div className="space-y-1.5">
            {standings
              .sort((a, b) => b.totalPoints - a.totalPoints)
              .slice(0, 4)
              .map((entry, index) => (
                <div
                  key={entry.userId}
                  className={`flex items-center justify-between py-1.5 px-2.5 rounded-lg ${
                    entry.userId === user?.id
                      ? 'bg-augusta-green/5 border border-augusta-green/20'
                      : index % 2 === 0 ? 'bg-gray-50' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <span
                      className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                        index === 0 ? 'bg-augusta-gold text-gray-900' : 'bg-gray-200 text-gray-600'
                      }`}
                    >
                      {index + 1}
                    </span>
                    <span className="text-sm font-medium text-gray-900">{entry.username}</span>
                  </div>
                  <span className="text-sm font-semibold text-augusta-green">{entry.totalPoints} pts</span>
                </div>
              ))}
          </div>
        ) : (
          <p className="text-gray-500 text-sm">No standings data yet.</p>
        )}
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/draft">
          <Card className="p-4 text-center hover:shadow-md transition-shadow">
            <span className="text-2xl">🐍</span>
            <p className="text-sm font-semibold text-gray-900 mt-1">Draft</p>
          </Card>
        </Link>
        <Link href="/picks">
          <Card className="p-4 text-center hover:shadow-md transition-shadow">
            <span className="text-2xl">🏌️</span>
            <p className="text-sm font-semibold text-gray-900 mt-1">My Team</p>
          </Card>
        </Link>
      </div>
    </div>
  );
}
