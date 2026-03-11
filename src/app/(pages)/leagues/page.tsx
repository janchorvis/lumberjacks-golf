'use client';

import { useState, useEffect } from 'react';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Modal from '@/components/ui/Modal';

interface League {
  id: string;
  name: string;
  inviteCode: string;
  season?: { id: string; name: string; year: number };
  members: { userId: string; username: string }[];
}

export default function LeaguesPage() {
  const [leagues, setLeagues] = useState<League[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Create league modal
  const [showCreate, setShowCreate] = useState(false);
  const [createName, setCreateName] = useState('');
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState('');

  // Join league modal
  const [showJoin, setShowJoin] = useState(false);
  const [joinCode, setJoinCode] = useState('');
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState('');

  // Clipboard feedback
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Fetch leagues
  async function fetchLeagues() {
    try {
      const res = await fetch('/api/leagues');
      if (!res.ok) throw new Error('Failed to fetch leagues');
      const data = await res.json();
      setLeagues(data.leagues || []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load leagues');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchLeagues();
  }, []);

  // Create league
  async function handleCreate() {
    if (!createName.trim()) {
      setCreateError('League name is required');
      return;
    }
    setCreating(true);
    setCreateError('');
    try {
      const res = await fetch('/api/leagues', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: createName.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setCreateError(data.error || 'Failed to create league');
        return;
      }
      setShowCreate(false);
      setCreateName('');
      await fetchLeagues();
    } catch {
      setCreateError('Failed to create league');
    } finally {
      setCreating(false);
    }
  }

  // Join league
  async function handleJoin() {
    if (!joinCode.trim()) {
      setJoinError('Invite code is required');
      return;
    }
    setJoining(true);
    setJoinError('');
    try {
      const res = await fetch('/api/leagues/join', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inviteCode: joinCode.trim().toUpperCase() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setJoinError(data.error || 'Failed to join league');
        return;
      }
      setShowJoin(false);
      setJoinCode('');
      await fetchLeagues();
    } catch {
      setJoinError('Failed to join league');
    } finally {
      setJoining(false);
    }
  }

  // Copy invite code
  function handleCopy(inviteCode: string, leagueId: string) {
    navigator.clipboard.writeText(inviteCode);
    setCopiedId(leagueId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <h1 className="text-2xl font-bold text-gray-900 font-serif">My Leagues</h1>
        <div className="flex items-center gap-3">
          <Button variant="secondary" size="sm" onClick={() => setShowJoin(true)}>
            Join League
          </Button>
          <Button variant="primary" size="sm" onClick={() => setShowCreate(true)}>
            Create League
          </Button>
        </div>
      </div>

      {/* Error */}
      {error && (
        <Card className="p-4">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <Card className="p-8 text-center">
          <p className="text-gray-500 text-sm">Loading leagues...</p>
        </Card>
      )}

      {/* No leagues */}
      {!loading && leagues.length === 0 && (
        <Card className="p-8 text-center">
          <div className="space-y-3">
            <div className="w-16 h-16 rounded-full bg-augusta-green/10 flex items-center justify-center mx-auto">
              <svg className="w-8 h-8 text-augusta-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
              </svg>
            </div>
            <p className="text-gray-500">You haven&apos;t joined any leagues yet.</p>
            <p className="text-sm text-gray-400">Create your own league or join one with an invite code.</p>
          </div>
        </Card>
      )}

      {/* League cards */}
      <div className="grid gap-4 sm:grid-cols-2">
        {leagues.map((league) => (
          <Card key={league.id} goldBorder className="overflow-hidden">
            <div className="p-5 space-y-4">
              {/* League name */}
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-lg text-gray-900">{league.name}</h3>
                  {league.season && (
                    <p className="text-xs text-gray-400 mt-0.5">
                      {league.season.name} {league.season.year}
                    </p>
                  )}
                </div>
                <span className="text-xs font-medium text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
                  {league.members.length} {league.members.length === 1 ? 'member' : 'members'}
                </span>
              </div>

              {/* Invite code */}
              <div className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                <span className="text-xs text-gray-500">Invite Code:</span>
                <code className="font-mono font-bold text-sm text-augusta-green tracking-wider">
                  {league.inviteCode}
                </code>
                <button
                  onClick={() => handleCopy(league.inviteCode, league.id)}
                  className="ml-auto text-gray-400 hover:text-augusta-green transition-colors p-1"
                  title="Copy invite code"
                >
                  {copiedId === league.id ? (
                    <svg className="w-4 h-4 text-augusta-green" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184" />
                    </svg>
                  )}
                </button>
              </div>

              {/* Members list */}
              <div>
                <p className="text-xs text-gray-400 mb-1.5">Members</p>
                <div className="flex flex-wrap gap-1.5">
                  {league.members.map((m) => (
                    <span
                      key={m.userId}
                      className="text-xs bg-white border border-gray-200 text-gray-700 px-2 py-0.5 rounded-full"
                    >
                      {m.username}
                    </span>
                  ))}
                </div>
              </div>

              {/* View standings link */}
              <a href="/standings" className="block">
                <Button variant="primary" size="sm" className="w-full">
                  View Standings
                </Button>
              </a>
            </div>
          </Card>
        ))}
      </div>

      {/* Create League Modal */}
      <Modal isOpen={showCreate} onClose={() => { setShowCreate(false); setCreateError(''); setCreateName(''); }} title="Create League">
        <div className="space-y-4">
          <Input
            label="League Name"
            placeholder="e.g., The Lumberjacks"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            error={createError}
            onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setShowCreate(false); setCreateError(''); setCreateName(''); }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={creating} onClick={handleCreate}>
              Create
            </Button>
          </div>
        </div>
      </Modal>

      {/* Join League Modal */}
      <Modal isOpen={showJoin} onClose={() => { setShowJoin(false); setJoinError(''); setJoinCode(''); }} title="Join League">
        <div className="space-y-4">
          <Input
            label="Invite Code"
            placeholder="e.g., ABC123"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
            error={joinError}
            maxLength={20}
            className="font-mono tracking-widest text-center text-lg"
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
          />
          <div className="flex justify-end gap-3">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => { setShowJoin(false); setJoinError(''); setJoinCode(''); }}
            >
              Cancel
            </Button>
            <Button variant="primary" size="sm" loading={joining} onClick={handleJoin}>
              Join
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
