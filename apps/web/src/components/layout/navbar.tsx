'use client';

import Link from 'next/link';
import { useAuthStore } from '@/lib/store';

export function Navbar() {
  const { user, logout } = useAuthStore();

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/80 backdrop-blur-lg">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600">
            <span className="text-sm font-bold text-white">fy</span>
          </div>
          <span className="text-lg font-bold text-slate-900">fy.video</span>
        </Link>

        <div className="hidden items-center gap-6 md:flex">
          <Link href="/series" className="text-sm text-slate-600 hover:text-slate-900">
            Browse
          </Link>
          {user && (
            <Link href="/library" className="text-sm text-slate-600 hover:text-slate-900">
              Library
            </Link>
          )}
          {user?.role === 'creator' && (
            <Link href="/dashboard/creator" className="text-sm text-slate-600 hover:text-slate-900">
              Creator Studio
            </Link>
          )}
          {(user?.role === 'affiliate' || user?.role === 'creator') && (
            <Link href="/dashboard/affiliate" className="text-sm text-slate-600 hover:text-slate-900">
              Affiliate
            </Link>
          )}
        </div>

        <div className="flex items-center gap-3">
          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/dashboard" className="text-sm font-medium text-slate-700 hover:text-slate-900">
                {user.displayName || user.email.split('@')[0]}
              </Link>
              <button onClick={() => logout()} className="text-sm text-slate-500 hover:text-slate-700">
                Sign out
              </button>
            </div>
          ) : (
            <>
              <Link href="/auth/login" className="text-sm font-medium text-slate-700 hover:text-slate-900">
                Sign in
              </Link>
              <Link href="/auth/register" className="btn-primary text-sm">
                Get Started
              </Link>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}
