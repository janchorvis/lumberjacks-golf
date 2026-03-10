'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Sidebar from '@/components/layout/Sidebar';
import BottomNav from '@/components/layout/BottomNav';
import Header from '@/components/layout/Header';
import type { SafeUser } from '@/types';

export default function AuthenticatedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const currentPath = usePathname();
  const [user, setUser] = useState<SafeUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const res = await fetch('/api/auth/me');
        if (!res.ok) {
          router.push('/');
          return;
        }
        const data = await res.json();
        setUser(data.user);
      } catch {
        router.push('/');
      } finally {
        setLoading(false);
      }
    }

    checkAuth();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-augusta-green border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return null;
  }

  // Derive a page title from the current path
  const segment = currentPath.split('/').filter(Boolean)[0] || 'Dashboard';
  const titleMap: Record<string, string> = { picks: 'My Team' };
  const pageTitle = titleMap[segment] || segment.charAt(0).toUpperCase() + segment.slice(1);

  return (
    <div className="flex min-h-screen">
      {/* Desktop sidebar */}
      <Sidebar currentPath={currentPath} isAdmin={user.isAdmin} />

      {/* Main content area */}
      <div className="flex-1 flex flex-col min-h-screen">
        {/* Mobile header */}
        <Header title={pageTitle} username={user.username} />

        {/* Page content */}
        <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8">
          {children}
        </main>

        {/* Mobile bottom nav */}
        <BottomNav currentPath={currentPath} />
      </div>
    </div>
  );
}
