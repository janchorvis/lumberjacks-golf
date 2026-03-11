'use client';

import Link from 'next/link';

interface SidebarProps {
  currentPath: string;
  isAdmin: boolean;
}

const navLinks = [
  { href: '/dashboard', label: 'Dashboard', icon: '◉' },
  { href: '/draft', label: 'Draft', icon: '🐍' },
  { href: '/picks', label: 'My Team', icon: '✎' },
  { href: '/standings', label: 'Standings', icon: '☰' },

  { href: '/rules', label: 'Rules', icon: '📋' },
];

export default function Sidebar({ currentPath, isAdmin }: SidebarProps) {
  return (
    <aside className="hidden md:flex md:flex-col md:w-64 md:min-h-screen bg-augusta-green text-white">
      {/* Logo */}
      <div className="px-6 py-8 border-b border-white/10">
        <Link href="/dashboard" className="block">
          <div className="flex items-center gap-2">
            <span className="text-3xl">🪓</span>
            <span className="text-xl font-serif font-bold tracking-wide">
              LUMBERJACKS
            </span>
          </div>
          <p className="text-augusta-gold text-xs font-medium tracking-widest mt-1 ml-1">
            FANTASY GOLF
          </p>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 py-6 space-y-1">
        {navLinks.map((link) => {
          const isActive = currentPath === link.href || currentPath.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
                isActive
                  ? 'bg-white/10 text-augusta-gold border-l-2 border-augusta-gold'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-base w-5 text-center">{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          );
        })}

        {isAdmin && (
          <>
            <div className="my-4 border-t border-white/10" />
            <Link
              href="/admin"
              className={`flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors duration-150 ${
                currentPath.startsWith('/admin')
                  ? 'bg-white/10 text-augusta-gold border-l-2 border-augusta-gold'
                  : 'text-white/80 hover:bg-white/5 hover:text-white'
              }`}
            >
              <span className="text-base w-5 text-center">⚙</span>
              <span>Admin</span>
            </Link>
          </>
        )}
      </nav>

      {/* Footer */}
      <div className="px-6 py-4 border-t border-white/10">
        <p className="text-xs text-white/40">Season 2026</p>
      </div>
    </aside>
  );
}
