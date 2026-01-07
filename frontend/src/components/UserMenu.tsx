import { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';

type UserMenuProps = {
  email?: string;
  role?: string;
  onLogout: () => Promise<void> | void;
};

const initialFromEmail = (email?: string) => (email ? email.charAt(0).toUpperCase() : 'U');

export const UserMenu = ({ email, role, onLogout }: UserMenuProps) => {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const isAdmin = role === 'admin';

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
          {initialFromEmail(email)}
        </span>
        <span className="hidden sm:inline">{email ?? 'Account'}</span>
        <span className="text-xs text-slate-500">▼</span>
      </button>

      {open && (
        <div className="absolute right-0 z-40 mt-2 w-48 rounded-xl border border-slate-200 bg-white shadow-lg shadow-slate-200/70">
          <div className="flex items-center gap-3 px-4 py-3 text-sm text-slate-700">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-900 text-sm font-bold text-white">
              {initialFromEmail(email)}
            </span>
            <div className="min-w-0">
              <p className="truncate font-semibold text-ink">{email ?? 'Signed in'}</p>
              <p className="text-xs text-slate-500">Online</p>
            </div>
          </div>
          <div className="divide-y divide-slate-100 text-sm text-slate-700">
            <div className="py-1">
              <Link
                to="/devices"
                className="block px-4 py-2 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Devices
              </Link>
              <Link
                to="/account"
                className="block px-4 py-2 hover:bg-slate-50"
                onClick={() => setOpen(false)}
              >
                Account
              </Link>
              {isAdmin && (
                <Link
                  to="/admin"
                  className="block px-4 py-2 font-semibold text-slate-900 hover:bg-slate-50"
                  onClick={() => setOpen(false)}
                >
                  Admin
                </Link>
              )}
            </div>
            <button
              className="block w-full px-4 py-2 text-left font-semibold text-rose-600 hover:bg-rose-50"
              onClick={() => {
                setOpen(false);
                void onLogout();
              }}
            >
              Logout
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
