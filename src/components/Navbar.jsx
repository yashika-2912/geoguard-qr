import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { LogOut, LayoutDashboard, Upload, ShieldCheck } from 'lucide-react';

export default function Navbar({ user, onLogout }) {
  const navigate = useNavigate();

  return (
    <nav className="bg-white border-b border-neutral-200 sticky top-0 z-50">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="flex items-center gap-2 font-bold text-xl text-indigo-600">
          <ShieldCheck className="w-8 h-8" />
          <span>GeoGuard</span>
        </Link>

        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-1 text-neutral-600 hover:text-indigo-600 transition-colors">
            <LayoutDashboard className="w-4 h-4" />
            <span className="hidden sm:inline">Dashboard</span>
          </Link>
          
          {user.role === 'Owner' && (
            <Link to="/upload" className="flex items-center gap-1 text-neutral-600 hover:text-indigo-600 transition-colors">
              <Upload className="w-4 h-4" />
              <span className="hidden sm:inline">Upload</span>
            </Link>
          )}

          <div className="h-6 w-px bg-neutral-200 mx-2" />

          <div className="flex items-center gap-3">
            <div className="text-right hidden sm:block">
              <p className="text-sm font-medium leading-none">{user.name}</p>
              <p className="text-xs text-neutral-500">{user.role}</p>
            </div>
            <button
              onClick={() => {
                onLogout();
                navigate('/login');
              }}
              className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
              title="Logout"
            >
              <LogOut className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
