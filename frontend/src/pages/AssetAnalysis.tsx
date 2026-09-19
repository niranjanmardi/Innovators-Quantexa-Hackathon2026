import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getHistoricalData, getAssetNews } from '../services/api';
import {
  ComposedChart, Line, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  Legend, ResponsiveContainer, ReferenceLine
} from 'recharts';
import { Search, Activity, AlertTriangle } from 'lucide-react';

// ---- Helper: SMA calculated in frontend on real fetched data ----
function calcSMA(values: number[], period: number): (number | null)[] {
  return values.map((_, i) => {
    if (i < period - 1) return null;
    const slice = values.slice(i - period + 1, i + 1);
    return slice.reduce((a, b) => a + b, 0) / period;
  });
}

function calcDailyReturns(values: number[]): (number | null)[] {
  return values.map((v, i) => {
    if (i === 0) return null;
    return ((v - values[i - 1]) / values[i - 1]) * 100;
  });
}

function calcRollingVol(returns: (number | null)[], window: number): (number | null)[] {
  const clean = returns.map(r => r ?? 0);
  return clean.map((_, i) => {
    if (i < window - 1) return null;
    const slice = clean.slice(i - window + 1, i + 1);
    const mean = slice.reduce((a, b) => a + b, 0) / window;
    const variance = slice.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / window;
    return Math.sqrt(variance) * Math.sqrt(252); // annualised
  });
}

function calcMetrics(data: any[]) {
  if (!data || data.length < 2) return null;
  const closes = data.map(d => d.close);
  const totalReturn = (closes[closes.length - 1] - closes[0]) / closes[0];
  const dailyRet = calcDailyReturns(closes).filter(r => r !== null) as number[];
  const mean = dailyRet.reduce((a, b) => a + b, 0) / dailyRet.length;
  const variance = dailyRet.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / dailyRet.length;
  const vol = Math.sqrt(variance) * Math.sqrt(252);
  const sharpe = dailyRet.length > 0 ? (mean / Math.sqrt(variance)) * Math.sqrt(252) : 0;

  let peak = closes[0], maxDD = 0;
  closes.forEach(c => {
    if (c > peak) peak = c;
    const dd = (peak - c) / peak;
    if (dd > maxDD) maxDD = dd;
  });

  return { totalReturn, annualizedVol: vol, sharpe, maxDrawdown: maxDD };
}

function MetricCard({ label, value, suffix = '%', color = 'text-slate-900' }: any) {
  return (
    <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm">
      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-black ${color}`}>{value}{suffix}</p>
    </div>
  );
}

export default function AssetAnalysis() {
  const [inputSymbol, setInputSymbol] = useState('NVDA');
  const [symbol, setSymbol] = useState('');
  const [startDate, setStartDate] = useState('2021-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);
  const [sma1Period, setSma1Period] = useState(20);
  const [sma2Period, setSma2Period] = useState(50);

  const { data: rawData, isLoading, isError } = useQuery({
    queryKey: ['history', symbol, startDate, endDate],
    queryFn: () => getHistoricalData(symbol, startDate, endDate),
    enabled: !!symbol,
    retry: 1,
  });

  const { data: newsData } = useQuery({
    queryKey: ['asset_news', symbol],
    queryFn: () => getAssetNews(symbol),
    enabled: !!symbol,
  });

  // Enrich data with indicators
  const chartData = useMemo(() => {
    if (!rawData || rawData.length === 0) return [];
    const closes = rawData.map((d: any) => d.close);
    const sma1 = calcSMA(closes, sma1Period);
    const sma2 = calcSMA(closes, sma2Period);
    const dailyRet = calcDailyReturns(closes);
    const rollingVol = calcRollingVol(dailyRet, 30);

    return rawData.map((d: any, i: number) => ({
      ...d,
      sma1: sma1[i],
      sma2: sma2[i],
      dailyReturn: dailyRet[i],
      rollingVol: rollingVol[i],
    }));
  }, [rawData, sma1Period, sma2Period]);

  const metrics = useMemo(() => calcMetrics(chartData), [chartData]);

  const handleAnalyze = () => {
    if (inputSymbol.trim()) setSymbol(inputSymbol.trim().toUpperCase());
  };

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Asset Analysis</h2>
        <p className="text-slate-500 mt-1">Real historical data fetched live from Yahoo Finance.</p>
      </header>

      {/* Search Bar */}
      <div className="glass-panel p-6 rounded-2xl border border-slate-200 shadow-lg shadow-sm">
        <div className="flex flex-wrap gap-3 items-end">
          <div className="flex-1 min-w-[150px]">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">Symbol</label>
            <input
              value={inputSymbol}
              onChange={e => setInputSymbol(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleAnalyze()}
              className="w-full border border-slate-200 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-300"
              placeholder="e.g. NVDA, BTC-USD, GLD"
            />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">From</label>
            <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
              className="border border-slate-200 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-300" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">To</label>
            <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
              className="border border-slate-200 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-300" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">SMA 1</label>
            <input type="number" value={sma1Period} onChange={e => setSma1Period(Number(e.target.value))}
              className="w-20 border border-slate-200 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-300" />
          </div>
          <div>
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-1">SMA 2</label>
            <input type="number" value={sma2Period} onChange={e => setSma2Period(Number(e.target.value))}
              className="w-20 border border-slate-200 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-slate-300" />
          </div>
          <button
            onClick={handleAnalyze}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-slate-900 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            <Search className="w-4 h-4" /> Analyze
          </button>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="space-y-4">
          {[1,2,3].map(i => (
            <div key={i} className="h-48 glass-panel animate-pulse rounded-2xl border border-slate-200"></div>
          ))}
          <p className="text-center text-sm text-slate-500 font-bold">Fetching market data...</p>
        </div>
      )}

      {/* Error */}
      {isError && (
        <div className="p-6 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-600 font-bold shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          Live market data is currently unavailable. Please try again later.
        </div>
      )}

      {/* Results */}
      {!isLoading && !isError && chartData.length > 0 && metrics && (
        <>
          {/* Metrics Row */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <MetricCard
              label="Total Return"
              value={(metrics.totalReturn * 100).toFixed(2)}
              color={metrics.totalReturn >= 0 ? 'text-slate-900' : 'text-red-600'}
            />
            <MetricCard
              label="Annualised Volatility"
              value={(metrics.annualizedVol * 100).toFixed(2)}
              color="text-amber-600"
            />
            <MetricCard
              label="Sharpe Ratio"
              value={metrics.sharpe.toFixed(2)}
              suffix=""
              color={metrics.sharpe >= 1 ? 'text-slate-900' : 'text-slate-700'}
            />
            <MetricCard
              label="Max Drawdown"
              value={(metrics.maxDrawdown * 100).toFixed(2)}
              color="text-red-600"
            />
          </div>

          {/* Price + SMA Chart */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 shadow-lg shadow-sm">
            <h3 className="font-bold text-slate-900 mb-1">
              {symbol} — Price with SMA {sma1Period} & SMA {sma2Period}
            </h3>
            <p className="text-[11px] text-slate-500 mb-4 font-medium">Source: Yahoo Finance. Last updated: {new Date().toLocaleString()}</p>
            <div className="h-72">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={40} />
                  <YAxis domain={['auto', 'auto']} tick={{ fontSize: 10, fill: '#64748b' }} width={70} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }}
                    formatter={(value: any) => [`$${Number(value).toFixed(2)}`]}
                    labelStyle={{ fontWeight: 600, color: '#94a3b8' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="close" name="Close Price" stroke="#38bdf8" dot={false} strokeWidth={2.5} />
                  <Line type="monotone" dataKey="sma1" name={`SMA ${sma1Period}`} stroke="#fbbf24" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                  <Line type="monotone" dataKey="sma2" name={`SMA ${sma2Period}`} stroke="#a78bfa" dot={false} strokeWidth={1.5} strokeDasharray="4 2" />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Daily Returns Chart */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 shadow-lg shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">Daily Returns (%)</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} formatter={(v: any) => [`${Number(v).toFixed(2)}%`]} />
                  <ReferenceLine y={0} stroke="#475569" />
                  <Bar
                    dataKey="dailyReturn"
                    name="Daily Return %"
                    fill="#10b981"
                    radius={[2, 2, 0, 0]}
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Rolling Volatility Chart */}
          <div className="glass-panel p-6 rounded-2xl border border-slate-200 shadow-lg shadow-sm">
            <h3 className="font-bold text-slate-900 mb-4">30-Day Rolling Annualised Volatility</h3>
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                  <XAxis dataKey="timestamp" tick={{ fontSize: 10, fill: '#64748b' }} minTickGap={40} />
                  <YAxis tick={{ fontSize: 10, fill: '#64748b' }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
                  <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px', fontSize: '12px' }} formatter={(v: any) => [`${(Number(v) * 100).toFixed(2)}%`]} />
                  <Line type="monotone" dataKey="rollingVol" name="30D Vol" stroke="#f43f5e" dot={false} strokeWidth={2.5} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Related News (Addendum A8) */}
          {(() => {
            const articles = newsData?.articles || (Array.isArray(newsData) ? newsData : []);
            if (!articles || articles.length === 0) return null;
            return (
              <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 border-b border-slate-200 pb-3">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    Related News for {symbol}
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    Relevance is keyword-based · Source: NewsData.io · Free plan
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {articles.slice(0, 4).map((article: any) => (
                    <a
                      key={article.id}
                      href={article.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex gap-3.5 p-3.5 bg-white border border-slate-200/90 rounded-xl hover:border-slate-200 hover:bg-slate-50/60 transition-all group"
                    >
                      <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0 bg-slate-800 relative">
                        {article.image_url ? (
                          <img
                            src={article.image_url}
                            alt=""
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            onError={e => { (e.currentTarget as HTMLElement).style.display = 'none'; }}
                            loading="lazy"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-[9px] font-bold text-slate-500 bg-slate-800">
                            NEWS
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col justify-between">
                        <p className="text-xs font-bold text-slate-900 group-hover:text-slate-800 line-clamp-2 leading-snug">
                          {article.title}
                        </p>
                        <div className="text-[10px] text-slate-500 flex items-center justify-between mt-1">
                          <span className="truncate max-w-[120px] font-medium text-slate-500">{article.source_name || 'NewsData.io'}</span>
                          <span>{article.published_at ? new Date(article.published_at).toLocaleDateString() : 'Recent'}</span>
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            );
          })()}


          <p className="text-xs text-gray-400 text-right">
            Data: Yahoo Finance (yfinance) · Interval: 1D · Symbol: {symbol} · {startDate} → {endDate}
          </p>
        </>
      )}

      {/* Empty state */}
      {!isLoading && !isError && !symbol && (
        <div className="glass-panel p-16 rounded-2xl border border-slate-200 shadow-lg shadow-sm text-center text-slate-500">
          <Activity className="w-12 h-12 mx-auto mb-4 opacity-30 text-slate-700" />
          <p className="font-bold text-slate-900 text-lg">Enter a symbol above and click Analyze to get started.</p>
          <p className="text-xs mt-2 font-medium">Try: NVDA, BTC-USD, GLD, AAPL, MSFT</p>
        </div>
      )}
    </div>
  );
}
