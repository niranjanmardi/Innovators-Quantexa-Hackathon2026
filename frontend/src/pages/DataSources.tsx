import { useQuery } from '@tanstack/react-query';
import { getNewsStatus } from '../services/api';
import { Database, ShieldCheck, Zap, CheckCircle2 } from 'lucide-react';

export default function DataSources() {
  const { data: newsStatus } = useQuery({

    queryKey: ['news_status'],
    queryFn: () => getNewsStatus(),
    refetchInterval: 15000,
  });

  const creditsUsed = newsStatus?.estimated_credits_used_today || 0;
  const creditCap = newsStatus?.credit_cap || 180;
  const creditsRemaining = newsStatus?.credits_remaining ?? Math.max(0, creditCap - creditsUsed);
  const percentUsed = Math.min(100, Math.round((creditsUsed / creditCap) * 100));

  const formatCacheAge = (seconds?: number | null) => {
    if (seconds === null || seconds === undefined) return 'No active cache';
    if (seconds < 60) return `${seconds}s ago`;
    const mins = Math.floor(seconds / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    return `${hrs}h ${mins % 60}m ago`;
  };

  const formatTime = (iso?: string | null) => {
    if (!iso) return 'Not fetched yet';
    try {
      return new Date(iso).toUTCString();
    } catch {
      return 'Invalid timestamp';
    }
  };

  return (
    <div className="space-y-6">
      <header className="pb-2 border-b border-slate-200">
        <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
          <Database className="w-6 h-6 text-slate-900" />
          Data Sources & Infrastructure
        </h1>
        <p className="text-xs text-slate-500 mt-1">
          Monitor real financial market data providers, credit quotas, cache health, and API compliance.
        </p>
      </header>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Market Data Provider Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-400 font-bold text-xs">
                YF
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">Market Data Provider</h3>
                <p className="text-[11px] text-slate-500">Yahoo Finance (via yfinance)</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-slate-900 border border-slate-200">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Active
            </span>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Supported Assets</span>
              <span className="font-semibold text-slate-900">Equities, Crypto, Commodities</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Data Coverage</span>
              <span className="font-semibold text-slate-900">Historical OHLCV + Latest Quotes</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Time Normalization</span>
              <span className="font-semibold text-slate-900">UTC ISO 8601</span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Cache TTL</span>
              <span className="font-semibold text-slate-900">1 Hour (History) / 5 Mins (Quotes)</span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Data Guarantee</span>
              <span className="font-semibold text-slate-900 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Real Market Data Only
              </span>
            </div>
          </div>
        </div>

        {/* News Intelligence Provider Card (Addendum A10) */}
        <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 border border-slate-200 flex items-center justify-center text-slate-900 font-bold text-xs">
                ND
              </div>
              <div>
                <h3 className="text-sm font-bold text-slate-900">News Intelligence Provider</h3>
                <p className="text-[11px] text-slate-500">NewsData.io</p>
              </div>
            </div>
            <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
              newsStatus?.provider_status === 'operational'
                ? 'bg-emerald-500/10 text-slate-900 border border-slate-200'
                : newsStatus?.provider_status === 'credit_cap_reached'
                ? 'bg-amber-50 text-amber-600 border border-amber-500/30'
                : 'bg-slate-800 text-slate-500 border border-slate-200'
            }`}>
              <span className={`w-1.5 h-1.5 rounded-full ${
                newsStatus?.provider_status === 'operational' ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400'
              }`} />
              {newsStatus?.provider_status ? newsStatus.provider_status.toUpperCase().replace('_', ' ') : 'ACTIVE'}
            </span>
          </div>

          {/* Credit Budget Progress Bar (Honest labeling: estimated daily consumption) */}
          <div className="p-3 bg-slate-100 rounded-xl border border-slate-200 space-y-2">
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-slate-500 flex items-center gap-1">
                <Zap className="w-3.5 h-3.5 text-amber-600" />
                Estimated Daily Credits Used:
              </span>
              <span className="font-mono font-bold text-slate-900">
                {creditsUsed} <span className="text-slate-500 font-normal">/ {creditCap} credits cap</span>
              </span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2 overflow-hidden">
              <div
                className={`h-full transition-all duration-500 ${
                  percentUsed >= 90 ? 'bg-red-500' : percentUsed >= 70 ? 'bg-amber-500' : 'bg-emerald-500'
                }`}
                style={{ width: `${percentUsed}%` }}
              />
            </div>
            <div className="flex justify-between text-[10px] text-slate-500">
              <span>{creditsRemaining} credits remaining today</span>
              <span>Reset: 00:00 UTC</span>
            </div>
          </div>

          <div className="space-y-2.5 text-xs">
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Articles in Cache</span>
              <span className="font-mono font-bold text-slate-900">
                {newsStatus?.articles_cached ?? 0} articles
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Cache Age / TTL</span>
              <span className="font-semibold text-slate-900">
                {formatCacheAge(newsStatus?.cache_age_seconds)} (TTL: {newsStatus?.ttl_minutes || 30} mins)
              </span>
            </div>
            <div className="flex justify-between py-1 border-b border-slate-200/60">
              <span className="text-slate-500">Last Provider Fetch</span>
              <span className="text-slate-700 font-mono text-[11px]">
                {formatTime(newsStatus?.last_fetched_at)}
              </span>
            </div>
            <div className="flex justify-between py-1">
              <span className="text-slate-500">Plan Quota & Tier</span>
              <span className="font-semibold text-slate-700">Free Tier (200 credits/day, ~12h delay)</span>
            </div>
          </div>
        </div>
      </div>

      {/* Plan Limits and Compliance Reference Card */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
          <ShieldCheck className="w-4 h-4 text-slate-900" />
          NewsData.io Free Tier Facts & Platform Rules
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
          <div className="p-3 bg-slate-50/60 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-900">Daily Credit Cap</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Provider offers 200 credits/day. Platform caps requests at 180 to guarantee headroom and prevent service denial.
            </p>
          </div>
          <div className="p-3 bg-slate-50/60 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-900">Honest Delay Attribution</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Free plan articles may be delayed up to 12 hours and cover the last 48 hours. Labeled as research context, not live trading signals.
            </p>
          </div>
          <div className="p-3 bg-slate-50/60 border border-slate-200 rounded-xl space-y-1">
            <div className="font-bold text-slate-900">Zero-Credit Client Filtering</div>
            <p className="text-slate-500 text-[11px] leading-relaxed">
              Up to 200 articles are fetched sequentially into cache. All category switching, search, and pagination run locally at 0 credit cost.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
