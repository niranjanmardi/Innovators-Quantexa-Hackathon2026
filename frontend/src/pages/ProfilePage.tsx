import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { updateProfileApi } from '../services/api';
import { 
  User as UserIcon, 
  Mail, 
  ShieldCheck, 
  LogOut, 
  CheckCircle2, 
  AlertCircle, 
  Sparkles, 
  RotateCcw,
  BadgeCheck,
  Lock,
  ArrowLeft
} from 'lucide-react';
import { Link } from 'react-router-dom';

const AVATAR_OPTIONS = Array.from({ length: 10 }, (_, i) => 
  `https://api.dicebear.com/7.x/shapes/svg?seed=Quant${i + 1}&backgroundColor=0f172a,2563eb,64748b`
);

export default function ProfilePage() {
  const { user, logout, updateUser } = useAuth();
  
  const [username, setUsername] = useState(user?.username || '');
  const [selectedAvatar, setSelectedAvatar] = useState(user?.avatar_url || AVATAR_OPTIONS[0]);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');

  useEffect(() => {
    if (user) {
      setUsername(user.username);
      setSelectedAvatar(user.avatar_url || AVATAR_OPTIONS[0]);
    }
  }, [user]);

  if (!user) return null;

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

      updateUser(res.user, res.access_token);
      setSuccessMessage('Your profile name has been updated successfully.');
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setErrorMessage(detail);
      } else if (Array.isArray(detail)) {
        setErrorMessage(detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', '));
      } else if (err.message && !err.response) {
        setErrorMessage('Cannot connect to server. Please verify the backend is running.');
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

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-12">
      {/* Top Breadcrumb / Return */}
      <div className="flex items-center justify-between">
        <Link 
          to="/" 
          className="inline-flex items-center gap-2 text-sm font-semibold text-slate-500 hover:text-blue-600 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Dashboard
        </Link>
        <button
          onClick={logout}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs font-bold text-red-600 hover:text-red-700 bg-red-50 hover:bg-red-100 border border-red-200 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
          Log Out
        </button>
      </div>

      {/* Main Profile Card */}
      <div className="bg-white rounded-3xl shadow-sm border border-slate-200 overflow-hidden">
        {/* Banner Header */}
        <div className="relative bg-gradient-to-r from-slate-900 via-blue-950 to-slate-900 px-8 pt-8 pb-16 text-white overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(#3b82f6_1px,transparent_1px)] [background-size:20px_20px] opacity-20" />
          <div className="relative z-10">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-500/20 text-blue-300 border border-blue-400/30 mb-3">
              <ShieldCheck className="w-3.5 h-3.5" />
              QuantPlatform Researcher Profile
            </span>
            <h1 className="text-2xl font-black tracking-tight">Account Settings & Profile</h1>
            <p className="text-slate-400 text-sm mt-1">Manage your identity, change display name, and configure workspace session</p>
          </div>
        </div>

        {/* Avatar & Badges Overlap */}
        <div className="px-8 -mt-10 relative z-10 flex flex-wrap items-end justify-between gap-4">
          <div className="flex items-end gap-5">
            <div className="relative group">
              <img 
                src={selectedAvatar} 
                alt={username} 
                className="w-24 h-24 rounded-3xl bg-white border-4 border-white shadow-xl object-cover"
              />
              <button
                type="button"
                onClick={handleRandomizeAvatar}
                title="Generate Random Avatar"
                className="absolute -bottom-1 -right-1 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-xl shadow-md transition-transform hover:scale-110"
              >
                <Sparkles className="w-4 h-4" />
              </button>
            </div>

            <div className="pb-1">
              <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                {user.username}
                <BadgeCheck className="w-5 h-5 text-blue-600" />
              </h2>
              <p className="text-xs text-slate-500 font-medium">{user.email}</p>
            </div>
          </div>

          <div className="flex items-center gap-3 pb-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              Session Online
            </span>
          </div>
        </div>

        {/* Content Body */}
        <div className="p-8 space-y-8">
          {/* Alerts */}
          {errorMessage && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
              <AlertCircle className="w-5 h-5 shrink-0 text-red-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-3 p-4 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-700 font-medium">
              <CheckCircle2 className="w-5 h-5 shrink-0 text-emerald-600" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Form */}
          <form onSubmit={handleSave} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Display Name Input */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label htmlFor="profile-page-name" className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                    Change Display Name
                  </label>
                  {hasNameChanged && (
                    <span className="text-xs font-semibold text-blue-600">Pending Save</span>
                  )}
                </div>
                <div className="relative">
                  <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    id="profile-page-name"
                    type="text"
                    required
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none text-sm font-bold text-slate-800 transition-all placeholder-slate-400"
                    placeholder="Enter your new name"
                  />
                </div>
                <p className="text-[11px] text-slate-500">
                  Visible across the platform in your backtests, lab sessions, and research reports.
                </p>
              </div>

              {/* Email Address */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Account Email
                </label>
                <div className="relative">
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="email"
                    disabled
                    value={user.email}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 bg-slate-50 text-slate-500 text-sm font-medium cursor-not-allowed select-all"
                  />
                  <Lock className="w-3.5 h-3.5 text-slate-400 absolute right-3.5 top-1/2 -translate-y-1/2" />
                </div>
                <p className="text-[11px] text-slate-400">
                  Primary institutional identity. Contact administrator to request an email update.
                </p>
              </div>
            </div>

            {/* Avatar Selector */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
                  Choose Profile Avatar
                </label>
                <button
                  type="button"
                  onClick={handleRandomizeAvatar}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  Generate Random Avatar
                </button>
              </div>
              <div className="grid grid-cols-5 sm:grid-cols-10 gap-3">
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

            {/* Submit changes */}
            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
              <button
                type="submit"
                disabled={isSaving || !hasChanges}
                className={`px-6 py-2.5 rounded-xl text-white text-sm font-semibold transition-all flex items-center gap-2 shadow-sm ${
                  !hasChanges || isSaving
                    ? 'bg-blue-400 cursor-not-allowed opacity-75'
                    : 'bg-blue-600 hover:bg-blue-700 shadow-blue-500/20 active:scale-[0.98]'
                }`}
              >
                {isSaving ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                    Saving Changes...
                  </>
                ) : (
                  'Save Profile Changes'
                )}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Workspace Security & Logout Box */}
      <div className="bg-white rounded-3xl p-6 border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h3 className="text-sm font-bold text-slate-900">Session & Authentication</h3>
          <p className="text-xs text-slate-500 mt-0.5">End your quantitative trading session and securely clear stored credentials.</p>
        </div>
        <button
          type="button"
          onClick={logout}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-red-600 hover:text-white bg-red-50 hover:bg-red-600 border border-red-200 transition-colors shadow-xs"
        >
          <LogOut className="w-4 h-4" />
          Log Out of QuantPlatform
        </button>
      </div>
    </div>
  );
}
