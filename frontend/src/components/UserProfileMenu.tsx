import { useState, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { useNavigate } from 'react-router-dom';
import { 
  User as UserIcon, 
  LogOut, 
  ChevronDown, 
  Shield, 
  Sparkles,
  Settings
} from 'lucide-react';

interface UserProfileMenuProps {
  onOpenProfile: () => void;
}

export default function UserProfileMenu({ onOpenProfile }: UserProfileMenuProps) {
  const { user, logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  // Close dropdown on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  if (!user) return null;

  return (
    <div className="relative" ref={menuRef}>
      {/* Profile Trigger Button in Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
        className={`flex items-center gap-3 px-3 py-1.5 rounded-full border transition-all duration-200 select-none group cursor-pointer ${
          isOpen
            ? 'bg-blue-50/90 border-blue-300 shadow-sm ring-2 ring-blue-500/20'
            : 'bg-white hover:bg-slate-50 border-slate-200 hover:border-slate-300 shadow-xs'
        }`}
      >
        {/* Avatar with Status Indicator */}
        <div className="relative shrink-0">
          <img
            src={user.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.username}`}
            alt={user.username}
            className="w-8 h-8 rounded-full border border-slate-200 bg-slate-100 object-cover shadow-xs group-hover:scale-105 transition-transform"
          />
          <span 
            className="absolute bottom-0 right-0 w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white" 
            title="Online"
          />
        </div>

        {/* Name and Email Label */}
        <div className="text-left hidden sm:block">
          <p className="text-xs font-bold text-slate-800 leading-tight group-hover:text-blue-600 transition-colors max-w-[160px] truncate">
            {user.username}
          </p>
          <p className="text-[11px] text-slate-500 font-medium leading-tight max-w-[160px] truncate" title={user.email}>
            {user.email}
          </p>
        </div>

        {/* Dropdown Chevron */}
        <ChevronDown 
          className={`w-4 h-4 text-slate-400 transition-transform duration-200 shrink-0 ${
            isOpen ? 'rotate-180 text-blue-600' : 'group-hover:text-slate-600'
          }`} 
        />
      </button>


      {/* Dropdown Card */}
      {isOpen && (
        <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white/95 backdrop-blur-md shadow-xl border border-slate-200/80 py-2 z-50 animate-fade-in-up origin-top-right">
          {/* User Details Header */}
          <div className="px-4 py-3 border-b border-slate-100 flex items-center gap-3">
            <div className="relative shrink-0">
              <img
                src={user.avatar_url || `https://api.dicebear.com/7.x/shapes/svg?seed=${user.username}`}
                alt={user.username}
                className="w-11 h-11 rounded-2xl border border-slate-200 bg-slate-50 object-cover shadow-sm"
              />
              <span className="absolute -bottom-1 -right-1 p-0.5 bg-blue-600 rounded-full text-white">
                <Sparkles className="w-2.5 h-2.5" />
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <p className="text-sm font-bold text-slate-900 truncate">
                  {user.username}
                </p>
              </div>
              <p className="text-xs text-slate-500 truncate" title={user.email}>
                {user.email}
              </p>
              <div className="mt-1">
                <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-100">
                  <Shield className="w-2.5 h-2.5 text-blue-600" />
                  Quant Researcher
                </span>
              </div>
            </div>
          </div>

          {/* Quick Menu Actions */}
          <div className="p-1.5 space-y-0.5">
            {/* Action 1: Change Name / Edit Profile (Modal) */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                onOpenProfile();
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50/70 transition-colors group"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                <UserIcon className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-800 group-hover:text-blue-700 leading-tight">Change Name & Profile</p>
                <p className="text-[10px] text-slate-400 group-hover:text-blue-500">Edit your display name & avatar</p>
              </div>
            </button>

            {/* Action 2: Dedicated Profile Page */}
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                navigate('/profile');
              }}
              className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left text-xs font-semibold text-slate-700 hover:text-slate-900 hover:bg-slate-50 transition-colors group"
            >
              <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600 group-hover:bg-slate-200 transition-colors">
                <Settings className="w-4 h-4" />
              </div>
              <div>
                <p className="font-bold text-slate-800 leading-tight">Full Profile Page</p>
                <p className="text-[10px] text-slate-400">View complete account details</p>
              </div>
            </button>
          </div>

          {/* Divider */}
          <div className="h-px bg-slate-100 my-1 mx-2" />

          {/* Logout Option */}
          <div className="p-1.5">
            <button
              type="button"
              onClick={() => {
                setIsOpen(false);
                logout();
              }}
              className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left text-xs font-bold text-red-600 hover:text-red-700 hover:bg-red-50/80 transition-colors group"
            >
              <div className="p-1.5 rounded-lg bg-red-50 text-red-500 group-hover:bg-red-100 group-hover:text-red-600 transition-colors">
                <LogOut className="w-4 h-4" />
              </div>
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
