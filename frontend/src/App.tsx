import React from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { LineChart, BarChart2, Newspaper, Shield, Database, GitBranch, Terminal } from 'lucide-react';
import Dashboard from './pages/Dashboard';
import AssetAnalysis from './pages/AssetAnalysis';
import MarketNews from './pages/MarketNews';
import StrategyLab from './pages/StrategyLab';
import CorrelationLab from './pages/CorrelationLab';
import DataSources from './pages/DataSources';

import Auth from './pages/Auth';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LogOut } from 'lucide-react';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
    }
  }
});

function TopNavLink({ to, icon: Icon, children }: { to: string, icon: any, children: React.ReactNode }) {
  const location = useLocation();
  const isActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(to));
  
  return (
    <Link 
      to={to} 
      className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-all text-sm font-semibold whitespace-nowrap ${
        isActive 
          ? 'bg-blue-50 text-blue-700' 
          : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
      }`}
    >
      <Icon className="w-4 h-4" /> {children}
    </Link>
  );
}

function MainLayout() {
  const { isAuthenticated, user, logout } = useAuth();

  if (!isAuthenticated) {
    return <Auth />;
  }

  return (
    <div className="flex flex-col h-screen bg-slate-50 text-slate-900 font-sans overflow-hidden">
      {/* Top Navbar */}
      <header className="glass-nav sticky top-0 z-50 flex items-center justify-between px-6 py-3 shrink-0">
        <div className="flex items-center gap-8">
          {/* Logo Area */}
          <div className="flex items-center gap-3">
            <img src="/logo.jpg" alt="QuantPlatform Logo" className="w-10 h-10 object-contain rounded-lg shadow-sm" />
            <div>
              <h1 className="text-sm font-black tracking-tight text-slate-900">QuantPlatform</h1>
              <p className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Research OS</p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="hidden lg:flex items-center gap-1">
            <div className="h-4 w-px bg-slate-200 mx-3"></div>
            <TopNavLink to="/" icon={LineChart}>Dashboard</TopNavLink>
            <TopNavLink to="/asset" icon={BarChart2}>Asset Analysis</TopNavLink>
            <TopNavLink to="/correlation" icon={GitBranch}>Correlation</TopNavLink>
            <TopNavLink to="/strategy" icon={Shield}>Strategy</TopNavLink>
            <TopNavLink to="/news" icon={Newspaper}>News</TopNavLink>
            <div className="h-4 w-px bg-slate-200 mx-3"></div>
            <TopNavLink to="/data-sources" icon={Database}>Data</TopNavLink>
          </nav>
        </div>

        {/* Backend Connection & User Profile */}
        <div className="flex items-center gap-4">
          <div className="hidden md:flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-full text-[11px] mr-2">
            <Terminal className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-slate-600 font-medium">http://localhost:8000</span>
            <span className="w-px h-3 bg-slate-300 mx-1"></span>
            <span className="inline-flex items-center gap-1.5 text-emerald-600 font-bold tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              API ONLINE
            </span>
          </div>

          {/* User Profile */}
          <div className="flex items-center gap-3 pl-4 border-l border-slate-200">
            <div className="flex items-center gap-2">
              <img src={user?.avatar_url} alt="User Avatar" className="w-8 h-8 rounded-full border border-slate-200 shadow-sm" />
              <div className="hidden sm:block">
                <p className="text-xs font-bold text-slate-800 leading-tight">{user?.username}</p>
                <p className="text-[10px] text-slate-500 font-medium">{user?.email}</p>
              </div>
            </div>
            <button 
              onClick={logout}
              title="Logout"
              className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors ml-1"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto">
        <div className="p-6 max-w-[1400px] mx-auto animate-fade-in-up">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/asset" element={<AssetAnalysis />} />
            <Route path="/correlation" element={<CorrelationLab />} />
            <Route path="/news" element={<MarketNews />} />
            <Route path="/strategy/*" element={<StrategyLab />} />
            <Route path="/data-sources" element={<DataSources />} />
          </Routes>
        </div>
      </main>
    </div>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <Router>
          <MainLayout />
        </Router>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
