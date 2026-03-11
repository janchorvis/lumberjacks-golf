'use client';

import { useState, useEffect, useCallback } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';

interface Player {
  userId: string;
  username: string;
}

interface DraftPickData {
  userId: string;
  golferId: string;
  golferName: string;
  pickNumber: number;
}

interface AvailableGolfer {
  golferId: string;
  name: string;
  ranking: number | null;
}

interface DraftState {
  id: string;
  leagueId: string;
  tournamentId: string;
  tournamentName: string;
  status: string;
  currentRound: number;
  currentPickIndex: number;
  draftOrder: string[];
  players: Player[];
  picksByRound: Record<number, DraftPickData[]>;
  availableGolfers: AvailableGolfer[];
  currentDrafter: string | null;
  totalPicks: number;
  fullSnakeOrder: { round: number; position: number; userId: string }[];
}

interface User {
  id: string;
  username: string;
  isAdmin: boolean;
}

interface League {
  id: string;
  name: string;
}

interface Tournament {
  id: string;
  name: string;
}

export default function DraftPage() {
  const [user, setUser] = useState<User | null>(null);
  const [draft, setDraft] = useState<DraftState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [picking, setPicking] = useState(false);
  const [expandedPlayer, setExpandedPlayer] = useState<string | null>(null);
  const [pickError, setPickError] = useState<string | null>(null);

  // Confirmation modal
  const [confirmGolfer, setConfirmGolfer] = useState<AvailableGolfer | null>(null);

  // Admin create draft state
  const [leagues, setLeagues] = useState<League[]>([]);
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [selectedLeague, setSelectedLeague] = useState('');
  const [selectedTournament, setSelectedTournament] = useState('');
  const [creating, setCreating] = useState(false);
  const [noDraft, setNoDraft] = useState(false);

  const fetchDraft = useCallback(async () => {
    try {
      const meRes = await fetch('/api/auth/me');
      if (!meRes.ok) return;
      const meData = await meRes.json();
      setUser(meData.user);

      const tournamentRes = await fetch('/api/tournaments/current');
      if (!tournamentRes.ok) {
        setNoDraft(true);
        setLoading(false);
        return;
      }
      const tournamentData = await tournamentRes.json();
      const tournamentId = tournamentData.tournament?.id;
      if (!tournamentId) {
        setNoDraft(true);
        setLoading(false);
        return;
      }

      const draftRes = await fetch(`/api/draft/${tournamentId}`);
      if (draftRes.ok) {
        const draftData = await draftRes.json();
        setDraft(draftData.draft);
        setNoDraft(false);
      } else {
        setNoDraft(true);
        if (meData.user.isAdmin) {
          const [leaguesRes, tournamentsRes] = await Promise.all([
            fetch('/api/leagues'),
            fetch('/api/tournaments'),
          ]);
          if (leaguesRes.ok) {
            const ld = await leaguesRes.json();
            setLeagues(ld.leagues || []);
          }
          if (tournamentsRes.ok) {
            const td = await tournamentsRes.json();
            setTournaments(td.tournaments || []);
            setSelectedTournament(tournamentId);
          }
        }
      }
    } catch {
      setError('Failed to load draft');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDraft();
  }, [fetchDraft]);

  // Auto-refresh every 5 seconds
  const draftTournamentId = draft?.tournamentId;
  const draftLeagueId = draft?.leagueId;
  const draftStatus = draft?.status;
  useEffect(() => {
    if (!draftTournamentId || !draftLeagueId || draftStatus !== 'active') return;
    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/draft/${draftTournamentId}?leagueId=${draftLeagueId}`);
        if (res.ok) {
          const data = await res.json();
          setDraft(data.draft);
        }
      } catch {
        // Silently fail on refresh
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [draftTournamentId, draftLeagueId, draftStatus]);

  const handleCreateDraft = async () => {
    if (!selectedLeague || !selectedTournament) return;
    setCreating(true);
    try {
      const res = await fetch('/api/draft/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          leagueId: selectedLeague,
          tournamentId: selectedTournament,
        }),
      });
      if (res.ok) {
        await fetchDraft();
      } else {
        const data = await res.json();
        setError(data.error || 'Failed to create draft');
      }
    } catch {
      setError('Failed to create draft');
    } finally {
      setCreating(false);
    }
  };

  const handlePick = async (golferId: string) => {
    if (!draft || picking) return;
    setPicking(true);
    setPickError(null);
    setConfirmGolfer(null);
    try {
      const res = await fetch('/api/draft/pick', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draft.id, golferId }),
      });
      if (res.ok) {
        const draftRes = await fetch(`/api/draft/${draft.tournamentId}?leagueId=${draft.leagueId}`);
        if (draftRes.ok) {
          const data = await draftRes.json();
          setDraft(data.draft);
        }
        setSearch('');
      } else {
        const data = await res.json();
        setPickError(data.error || 'Failed to make pick');
      }
    } catch {
      setPickError('Failed to make pick');
    } finally {
      setPicking(false);
    }
  };

  const handleRandomize = async () => {
    if (!draft) return;
    try {
      const res = await fetch('/api/draft/randomize-order', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: draft.id }),
      });
      if (res.ok) {
        await fetchDraft();
      }
    } catch {
      // ignore
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-augusta-green" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-8">
        <Card className="p-8 text-center">
          <p className="text-red-600 font-medium">{error}</p>
        </Card>
      </div>
    );
  }

  // No draft yet
  if (noDraft && !draft) {
    return (
      <div className="px-4 py-6 max-w-lg mx-auto space-y-6">
        <h1 className="text-xl font-bold text-gray-900">Snake Draft</h1>
        {user?.isAdmin ? (
          <Card goldBorder className="p-5 space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Create a Draft</h2>
            <p className="text-sm text-gray-500">Set up a snake draft for a league and tournament.</p>
            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">League</label>
                <select
                  value={selectedLeague}
                  onChange={(e) => setSelectedLeague(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-augusta-green"
                >
                  <option value="">Select league...</option>
                  {leagues.map((l) => (
                    <option key={l.id} value={l.id}>{l.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Tournament</label>
                <select
                  value={selectedTournament}
                  onChange={(e) => setSelectedTournament(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-augusta-green"
                >
                  <option value="">Select tournament...</option>
                  {tournaments.map((t) => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>
            </div>
            <Button variant="primary" onClick={handleCreateDraft} loading={creating} disabled={!selectedLeague || !selectedTournament}>
              Create Draft
            </Button>
          </Card>
        ) : (
          <Card className="p-8 text-center">
            <p className="text-gray-500">No active draft for the current tournament.</p>
            <p className="text-sm text-gray-400 mt-1">Waiting for the commissioner to set up the draft.</p>
          </Card>
        )}
      </div>
    );
  }

  if (!draft) return null;

  const isMyTurn = draft.currentDrafter === user?.id;
  const currentDrafterName =
    draft.players.find((p) => p.userId === draft.currentDrafter)?.username || '';

  // Sort golfers: ranked first by ranking asc, then unranked alphabetically
  const sortedGolfers = [...draft.availableGolfers].sort((a, b) => {
    if (a.ranking !== null && b.ranking !== null) return a.ranking - b.ranking;
    if (a.ranking !== null) return -1;
    if (b.ranking !== null) return 1;
    return a.name.localeCompare(b.name);
  });

  const filteredGolfers = sortedGolfers.filter((g) =>
    g.name.toLowerCase().includes(search.toLowerCase())
  );

  // My picks so far
  const myPicks = Object.values(draft.picksByRound)
    .flat()
    .filter((p) => p.userId === user?.id)
    .sort((a, b) => a.pickNumber - b.pickNumber);

  return (
    <div className="px-4 py-4 pb-24 max-w-lg mx-auto space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Snake Draft</h1>
          <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold ${
              draft.status === 'active'
                ? 'bg-green-100 text-green-800'
                : draft.status === 'complete'
                ? 'bg-gray-100 text-gray-600'
                : 'bg-yellow-100 text-yellow-800'
            }`}
          >
            {draft.status === 'active' && (
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            )}
            {draft.status.charAt(0).toUpperCase() + draft.status.slice(1)}
          </span>
        </div>
        <p className="text-sm text-gray-500 mt-0.5">{draft.tournamentName}</p>
        <p className="text-xs text-gray-400">
          Round {draft.currentRound} of 7 &middot; Pick {Math.min(draft.totalPicks + 1, 28)} of 28
        </p>
      </div>

      {/* YOUR PICK banner */}
      {draft.status === 'active' && (
        <div
          className={`rounded-xl px-4 py-4 text-center font-bold text-lg ${
            isMyTurn
              ? 'bg-augusta-gold/20 text-augusta-green border-2 border-augusta-gold'
              : 'bg-gray-50 text-gray-500 border border-gray-200'
          }`}
        >
          {isMyTurn ? (
            <>YOUR PICK</>
          ) : (
            <div>
              <p className="text-sm font-normal text-gray-500">Waiting for</p>
              <p className="text-augusta-green">{currentDrafterName}</p>
            </div>
          )}
        </div>
      )}

      {draft.status === 'complete' && (
        <div className="rounded-xl px-4 py-3 text-center font-medium bg-augusta-green/10 text-augusta-green border border-augusta-green/20">
          Draft complete! All 28 picks made.
        </div>
      )}

      {/* Admin controls */}
      {user?.isAdmin && draft.status === 'active' && draft.totalPicks === 0 && (
        <div className="flex justify-end">
          <Button variant="secondary" size="sm" onClick={handleRandomize}>
            Re-randomize Order
          </Button>
        </div>
      )}

      {/* Pick error */}
      {pickError && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">
          {pickError}
        </div>
      )}

      {/* Golfer search & list - only when it's my turn */}
      {draft.status === 'active' && isMyTurn && (
        <div className="space-y-3">
          {/* Sticky search bar */}
          <div className="sticky top-0 z-10 bg-white pb-2 pt-1 -mx-1 px-1">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search golfers..."
              className="w-full border border-gray-300 rounded-xl px-4 py-3 text-base focus:outline-none focus:ring-2 focus:ring-augusta-green focus:border-augusta-green"
            />
          </div>

          {/* Golfer list with large tap targets */}
          <div className="space-y-1.5">
            {filteredGolfers.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">No golfers found.</p>
            ) : (
              filteredGolfers.map((golfer) => (
                <button
                  key={golfer.golferId}
                  onClick={() => setConfirmGolfer(golfer)}
                  disabled={picking}
                  className="w-full flex items-center justify-between px-4 py-3 min-h-[48px] rounded-xl border border-gray-200 hover:border-augusta-green hover:bg-augusta-green/5 active:bg-augusta-green/10 transition-colors disabled:opacity-50 text-left"
                >
                  <div className="flex items-center gap-3">
                    {golfer.ranking != null ? (
                      <span className="text-xs font-mono text-gray-400 w-7 text-right shrink-0">
                        #{golfer.ranking}
                      </span>
                    ) : (
                      <span className="w-7 shrink-0" />
                    )}
                    <span className="text-sm font-medium text-gray-900">
                      {golfer.name}
                    </span>
                  </div>
                  <span className="text-xs text-augusta-green font-semibold shrink-0 ml-2">
                    Draft
                  </span>
                </button>
              ))
            )}
          </div>
        </div>
      )}

      {/* Waiting spinner for non-active players */}
      {draft.status === 'active' && !isMyTurn && (
        <Card className="p-6 text-center">
          <div className="flex flex-col items-center gap-2">
            <div className="w-8 h-8 border-4 border-augusta-green border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-600">
              Waiting for <span className="font-semibold">{currentDrafterName}</span>...
            </p>
            <p className="text-xs text-gray-400">Auto-refreshes every 5s</p>
          </div>
        </Card>
      )}

      {/* Pick history */}
      {myPicks.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-gray-700 mb-2">
            My Picks ({myPicks.length}/7)
          </h3>
          <div className="space-y-1">
            {myPicks.map((pick, i) => (
              <div
                key={pick.pickNumber}
                className="flex items-center justify-between px-3 py-2 bg-gray-50 rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-bold text-gray-400 w-5">{i + 1}.</span>
                  <span className="text-sm font-medium text-gray-900">{pick.golferName}</span>
                </div>
                <span className="text-[10px] text-gray-400">Pick #{pick.pickNumber}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* All teams pick counts - tap to expand */}
      <div className="space-y-2">
        {draft.players.map((player) => {
          const playerPicks = Object.values(draft.picksByRound)
            .flat()
            .filter((p) => p.userId === player.userId)
            .sort((a, b) => a.pickNumber - b.pickNumber);
          const isExpanded = expandedPlayer === player.userId;
          return (
            <div
              key={player.userId}
              onClick={() => setExpandedPlayer(isExpanded ? null : player.userId)}
            >
            <Card
              className={`overflow-hidden cursor-pointer ${
                draft.currentDrafter === player.userId && draft.status === 'active'
                  ? 'ring-2 ring-augusta-gold'
                  : ''
              }`}
            >
              <div className="p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{player.username}</p>
                  <p className="text-xs text-gray-500">{playerPicks.length}/7 picks</p>
                </div>
                <span className={`text-gray-400 text-xs transition-transform ${isExpanded ? 'rotate-180' : ''}`}>▼</span>
              </div>
              {isExpanded && playerPicks.length > 0 && (
                <div className="border-t border-gray-100 px-3 pb-3 pt-2 space-y-1">
                  {playerPicks.map((pick, i) => (
                    <div key={pick.pickNumber} className="flex items-center justify-between py-1">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-gray-400 w-4">{i + 1}.</span>
                        <span className="text-sm text-gray-800">{pick.golferName}</span>
                      </div>
                      <span className="text-[10px] text-gray-400">Pick #{pick.pickNumber}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            </div>
          );
        })}
      </div>

      {/* Confirmation Modal */}
      <Modal
        isOpen={!!confirmGolfer}
        onClose={() => setConfirmGolfer(null)}
        title="Confirm Pick"
      >
        {confirmGolfer && (
          <div className="space-y-4">
            <div className="text-center py-2">
              <p className="text-lg font-bold text-gray-900">{confirmGolfer.name}</p>
              {confirmGolfer.ranking && (
                <p className="text-sm text-gray-500">World Ranking #{confirmGolfer.ranking}</p>
              )}
              <p className="text-xs text-gray-400 mt-1">Round {draft.currentRound}, Pick #{draft.totalPicks + 1}</p>
            </div>
            <div className="flex gap-3">
              <Button
                variant="secondary"
                className="flex-1"
                onClick={() => setConfirmGolfer(null)}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                className="flex-1"
                onClick={() => handlePick(confirmGolfer.golferId)}
                loading={picking}
              >
                Confirm Pick
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
