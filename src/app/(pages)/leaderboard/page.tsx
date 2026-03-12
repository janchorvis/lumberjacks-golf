'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function LeaderboardRedirect() {
  const router = useRouter();

  useEffect(() => {
    async function redirect() {
      const res = await fetch('/api/tournaments/current');
      if (res.ok) {
        const data = await res.json();
        if (data.tournament?.id) {
          router.replace(`/tournament/${data.tournament.id}`);
          return;
        }
      }
      // No active tournament — fall back to standings
      router.replace('/standings');
    }
    redirect();
  }, [router]);

  return (
    <div className="flex items-center justify-center min-h-[60vh]">
      <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-augusta-green" />
    </div>
  );
}
