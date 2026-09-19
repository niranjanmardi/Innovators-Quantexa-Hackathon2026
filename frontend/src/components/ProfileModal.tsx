import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfileApi } from '../services/api';
import { 
  X, 
  User as UserIcon, 
  Mail, 
  ShieldCheck, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  RotateCcw,
  BadgeCheck
} from 'lucide-react';

interface ProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const AVATAR_OPTIONS = Array.from({ length: 10 }, (_, i) => 
  `https://api.dicebear.com/7.x/shapes/svg?seed=Quant${i + 1}&backgroundColor=0f172a,2563eb,64748b`
);

export default function ProfileModal({ isOpen, onClose }: ProfileModalProps) {
  const { user, logout, updateUser } = useAuth();
  
  const [username, setUsername] = useState(user?.username || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar_url || AVATAR_OPTIONS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  // Sync state whenever modal opens or user changes
  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setSelectedAvatar(user.avatar_url || AVATAR_OPTIONS[0]);
      setErrorMessage('');
      setSuccessMessage('');
    }
  }, [user, isOpen]);

  // Handle escape key to close modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !user) return null;

  const hasNameChanged = username.trim() !== user.username;
  const hasAvatarChanged = selectedAvatar !== user.avatar_url;
  const hasChanges = hasNameChanged || hasAvatarChanged;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      setErrorMessage('Username cannot be empty.');
      return;
    }
    if (trimmedUsername.length < 2) {
      setErrorMessage('Username must be at least 2 characters long.');
      return;
    }

    setIsSaving(true);
    try {
      const res = await updateProfileApi({
        current_username: user.username,
        new_username: trimmedUsername,
        new_avatar_url: selectedAvatar,
      });

      // Update AuthContext state and localStorage
      updateUser(res.user, res.access_token);
      setSuccessMessage('Profile name updated successfully!');

      // Close modal after brief success feedback
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMessage(detail);
      } else if (Array.isArray(detail)) {
        setErrorMessage(detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', '));
      } else if (err.message && !err.response) {
        setErrorMessage('Cannot connect to server. Please ensure backend is running.');
      } else {
        setErrorMessage(err.response?.data?.message || 'Failed to update profile. Please try again.');
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleRandomizeAvatar = () => {
    const randomSeed = Math.random().toString(36).substring(2, 8);
    const newAvatarUrl = `https://api.dicebear.com/7.x/shapes/svg?seed=Quant${randomSeed}&backgroundColor=0f172a,2563eb,64748b`;
    setSelectedAvatar(newAvatarUrl);
  };

  const handleLogoutClick = () => {
    onClose();
    logout();
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      {/* Backdrop */}
      <div 
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-fade-in"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Container */}
      <div 
        className="relative bg-white rounded-3xl shadow-2xl border border-slate-200/80 w-full max-w-lg overflow-hidden z-10 animate-fade-in-up"
        role="dialog"
        aria-modal="true"
        aria-labelledby="profile-modal-title"
      >
        {/* Top Header Banner */}
        <div className="relative bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-6 pt-6 pb-12 text-white overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:16px_16px] opacity-20"></div>
          
          <div className="relative z-10 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded-lg bg-blue-500/20 text-blue-400 border border-blue-500/30">
                <ShieldCheck className="w-4 h-4" />
              </span>
              <h2 id="profile-modal-title" className="text-base font-bold tracking-tight text-white">
                Account & Profile Settings
              </h2>
            </div>
            
            <button
              onClick={onClose}
              className="p-1.5 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors"
              title="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Profile Avatar & Identity Card Overlap */}
        <div className="px-6 -mt-9 relative z-10">
          <div className="flex items-end justify-between">
            <div className="relative group">
              <img 
                src={selectedAvatar} 
                alt={username} 
                className="w-18 h-18 rounded-2xl bg-white border-4 border-white shadow-xl object-cover"
              />
              <button
                type="button"
                onClick={handleRandomizeAvatar}
                title="Generate Random Avatar"
                className="absolute -bottom-1 -right-1 p-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-transform hover:scale-110"
              >
                <Sparkles className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex items-center gap-2 pb-1">
              <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <BadgeCheck className="w-3.5 h-3.5 text-emerald-600" />
                Active Trader
              </span>
            </div>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-6">
          {/* Status Alerts */}
          {errorMessage && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium animate-fade-in">
              <AlertCircle className="w-4 h-4 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2.5 p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium animate-fade-in">
              <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-4">
            {/* Username / Name Field */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label htmlFor="display-name-input" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Change Name / Username
                </label>
                {hasNameChanged && (
                  <span className="text-[11px] font-semibold text-blue-600">Unsaved changes</span>
                )}
              </div>
              <div className="relative">
                <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  id="display-name-input"
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-semibold text-slate-800 transition-all placeholder-slate-400"
                  placeholder="Enter your name or alias"
                />
              </div>
              <p className="text-[11px] text-slate-500 mt-1">
                This name is displayed in the navigation bar, research models, and strategy telemetry.
              </p>
            </div>

            {/* Email Field (Read-only Institutional Account) */}
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-1.5">
                Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  disabled
                  value={user.email}
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium cursor-not-allowed select-all"
                />
              </div>
              <p className="text-[11px] text-slate-400 mt-1">
                Contact administration to update your primary workspace email.
              </p>
            </div>

            {/* Avatar Selector Presets */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Avatar Theme
                </label>
                <button
                  type="button"
                  onClick={handleRandomizeAvatar}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3 h-3" />
                  Randomize
                </button>
              </div>
              <div className="grid grid-cols-5 gap-2.5">
                {AVATAR_OPTIONS.map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setSelectedAvatar(url)}
                    className={`relative rounded-xl aspect-square overflow-hidden border-2 transition-all p-0.5 ${
                      selectedAvatar === url
                        ? 'border-blue-600 shadow-md scale-105'
                        : 'border-slate-200 hover:border-blue-300 opacity-70 hover:opacity-100'
                    }`}
                  >
                    <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover rounded-lg" />
                    {selectedAvatar === url && (
                      <div className="absolute inset-0 bg-blue-600/20 rounded-lg flex items-center justify-center">
                        <CheckCircle2 className="w-4 h-4 text-blue-600 bg-white rounded-full" />
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>

            {/* Action Buttons */}
            <div className="flex items-center gap-3 pt-3 border-t border-slate-100">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>

              <button
                type="submit"
                disabled={isSaving || !hasChanges}
                className={`flex-1 px-4 py-2.5 rounded-xl text-white text-sm font-semibold transition-all flex items-center justify-center gap-2 shadow-sm ${
                  !hasChanges || isSaving
                    ? 'bg-blue-400 cursor-not-allowed opacity-75'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 active:scale-[0.98]'
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving...
                  </>
                ) : (
                  'Save Changes'
                )}
              </button>
            </div>
          </form>

          {/* Danger Zone / Logout Option */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
            <div>
              <p className="text-xs font-bold text-slate-800">Sign out of workspace</p>
              <p className="text-[11px] text-slate-500">End your current session securely</p>
            </div>
            <button
              type="button"
              onClick={handleLogoutClick}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              Log Out
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
