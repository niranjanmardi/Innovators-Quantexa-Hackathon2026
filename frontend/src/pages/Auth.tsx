import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { Shield, Mail, Lock, User, CheckCircle2, ArrowRight } from 'lucide-react';
import { loginApi, signupApi } from '../services/api';

// 10 distinct professional avatar options
const AVATAR_OPTIONS = Array.from({ length: 10 }, (_, i) => 
  `https://api.dicebear.com/7.x/shapes/svg?seed=Quant${i + 1}&backgroundColor=0f172a,2563eb,64748b`
);

export default function Auth() {
  const { login } = useAuth();
  const [isLogin, setIsLogin] = useState(true);
  
  const [email, setEmail] = useState('');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(AVATAR_OPTIONS[0]);
  
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      if (isLogin) {
        const data = await loginApi(username, password);
        login(data.access_token, data.user);
      } else {
        if (password.length < 8) {
          setError('Password must be at least 8 characters long.');
          setIsLoading(false);
          return;
        }
        if (password !== confirmPassword) {
          setError('Passwords do not match.');
          setIsLoading(false);
          return;
        }
        const data = await signupApi({
          email,
          username,
          password,
          avatar_url: selectedAvatar
        });
        login(data.access_token, data.user);
      }
    } catch (err: any) {
      const detail = err.response?.data?.detail;
      if (typeof detail === 'string') {
        setError(detail);
      } else if (Array.isArray(detail)) {
        setError(detail.map((d: any) => d.msg || d.message || JSON.stringify(d)).join(', '));
      } else if (err.message && !err.response) {
        setError('Cannot connect to backend server. Please verify backend is running and reachable.');
      } else {
        setError(err.response?.data?.message || 'Authentication failed. Please try again.');
      }
    }
 finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-64px)] flex items-center justify-center p-6">
      <div className="w-full max-w-5xl grid grid-cols-1 md:grid-cols-2 bg-white rounded-3xl shadow-xl border border-slate-200 overflow-hidden">
        
        {/* Left Side: Branding / Info */}
        <div className="bg-slate-900 p-12 text-white flex flex-col justify-between relative overflow-hidden">
          <div className="absolute top-0 left-0 w-full h-full bg-[url('/bg-pattern.svg')] opacity-10 bg-repeat bg-[length:24px_24px]"></div>
          
          <div className="relative z-10">
            <div className="flex items-center gap-3 mb-12">
              <img src="/logo.jpg" alt="QuantPlatform" className="w-10 h-10 rounded-lg shadow-lg" />
              <div>
                <h1 className="text-xl font-black tracking-tight">QuantPlatform</h1>
                <p className="text-xs text-blue-400 font-semibold tracking-wider uppercase">Research OS</p>
              </div>
            </div>

            <h2 className="text-3xl font-bold mb-6 leading-tight">
              Institutional Grade <br/>
              <span className="text-blue-400">Quantitative Analysis</span>
            </h2>
            <p className="text-slate-400 leading-relaxed mb-8">
              Access real-time market data, run advanced backtests, explore correlation matrices, and stress-test your trading strategies—all from a single, unified interface.
            </p>

            <ul className="space-y-4">
              {[
                'Real-time Market Intelligence',
                'Advanced Backtesting Engine',
                'Regime Classification AI',
                'Secure & Private Workspaces'
              ].map((item, i) => (
                <li key={i} className="flex items-center gap-3 text-sm text-slate-300 font-medium">
                  <CheckCircle2 className="w-5 h-5 text-blue-500 shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
          
          <div className="relative z-10 mt-12 pt-8 border-t border-slate-800">
            <p className="text-xs text-slate-500">
              © 2026 QuantPlatform OS. All rights reserved. Not intended as trading advice.
            </p>
          </div>
        </div>

        {/* Right Side: Form */}
        <div className="p-12 flex flex-col justify-center">
          <div className="max-w-md w-full mx-auto">
            <div className="text-center mb-8">
              <div className="w-12 h-12 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4 border border-blue-100">
                <Shield className="w-6 h-6 text-blue-600" />
              </div>
              <h2 className="text-2xl font-bold text-slate-900">
                {isLogin ? 'Welcome back' : 'Create your account'}
              </h2>
              <p className="text-sm text-slate-500 mt-2">
                {isLogin ? 'Enter your credentials to access your workspace.' : 'Sign up to start analyzing financial markets.'}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 rounded-xl bg-red-50 border border-red-200 text-sm text-red-600 font-medium">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm font-medium text-slate-900 placeholder:font-normal placeholder-slate-400"
                      placeholder="researcher@firm.com"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Username
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="text"
                    required
                    value={username}
                    onChange={e => setUsername(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm font-medium text-slate-900 placeholder:font-normal placeholder-slate-400"
                    placeholder={isLogin ? 'Enter your username' : 'Choose a unique username'}
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                  Password
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm font-medium text-slate-900 placeholder:font-normal placeholder-slate-400"
                    placeholder="••••••••"
                  />
                </div>
              </div>

              {!isLogin && (
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5 uppercase tracking-wide">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 outline-none transition-all text-sm font-medium text-slate-900 placeholder:font-normal placeholder-slate-400"
                      placeholder="••••••••"
                    />
                  </div>
                </div>
              )}

              {!isLogin && (
                <div className="pt-2">
                  <label className="block text-xs font-semibold text-slate-700 mb-2.5 uppercase tracking-wide">
                    Select Your Profile Avatar
                  </label>
                  <div className="grid grid-cols-5 gap-3">
                    {AVATAR_OPTIONS.map((url, idx) => (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => setSelectedAvatar(url)}
                        className={`relative rounded-xl overflow-hidden aspect-square border-2 transition-all ${
                          selectedAvatar === url 
                            ? 'border-blue-500 shadow-md scale-105' 
                            : 'border-slate-100 hover:border-blue-200 hover:scale-105 opacity-70 hover:opacity-100'
                        }`}
                      >
                        <img src={url} alt={`Avatar ${idx + 1}`} className="w-full h-full object-cover" />
                        {selectedAvatar === url && (
                          <div className="absolute inset-0 bg-blue-500/10 flex items-center justify-center">
                            <CheckCircle2 className="w-5 h-5 text-blue-600 bg-white rounded-full" />
                          </div>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-xl transition-all shadow-md shadow-blue-500/20 flex items-center justify-center gap-2 mt-4"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <>
                    {isLogin ? 'Sign In to Workspace' : 'Create Account'}
                    <ArrowRight className="w-4 h-4" />
                  </>
                )}
              </button>
            </form>

            <div className="mt-8 text-center">
              <p className="text-sm text-slate-500">
                {isLogin ? "Don't have an account?" : "Already have an account?"}
                <button
                  type="button"
                  onClick={() => setIsLogin(!isLogin)}
                  className="ml-2 font-bold text-blue-600 hover:text-blue-700 underline underline-offset-2 transition-colors"
                >
                  {isLogin ? 'Sign up here' : 'Log in here'}
                </button>
              </p>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
