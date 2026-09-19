import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { apiClient } from '../services/api';
import { Plus, X, GitBranch, AlertTriangle } from 'lucide-react';

async function fetchCorrelation(symbols: string[], startDate: string, endDate: string) {
  const { data } = await apiClient.get('/analysis/correlation', {
    params: { symbols: symbols.join(','), start_date: startDate, end_date: endDate }
  });
  return data;
}

// Interpolate color: -1 = red, 0 = white, +1 = green
function corrColor(value: number): string {
  if (value >= 0) {
    const intensity = Math.round(value * 180);
    return `rgb(${255 - intensity}, 255, ${255 - intensity})`;
  } else {
    const intensity = Math.round(-value * 180);
    return `rgb(255, ${255 - intensity}, ${255 - intensity})`;
  }
}

function corrTextColor(value: number): string {
  return Math.abs(value) > 0.6 ? '#111' : '#374151';
}

export default function CorrelationLab() {
  const [symbols, setSymbols] = useState(['NVDA', 'GLD', 'BTC-USD']);
  const [newSymbol, setNewSymbol] = useState('');
  const [startDate, setStartDate] = useState('2021-01-01');
  const [endDate, setEndDate] = useState(new Date().toISOString().split('T')[0]);

  const mutation = useMutation({
    mutationFn: () => fetchCorrelation(symbols, startDate, endDate),
  });

  const addSymbol = () => {
    const s = newSymbol.trim().toUpperCase();
    if (s && !symbols.includes(s)) {
      setSymbols(prev => [...prev, s]);
      setNewSymbol('');
    }
  };

  const removeSymbol = (sym: string) => {
    setSymbols(prev => prev.filter(s => s !== sym));
  };

  const corr = mutation.data?.correlation;
  const syms = mutation.data?.symbols || [];
  const failed = mutation.data?.failed_symbols || [];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Correlation Lab</h2>
        <p className="text-slate-500 mt-1">Analyze cross-asset Pearson correlations using real historical returns.</p>
      </header>

      {/* Config */}
      <div className="glass-panel p-6 rounded-2xl shadow-lg shadow-sm space-y-4 h-fit sticky top-24 border border-slate-200">
        {/* Asset chips */}
        <div>
          <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wide block mb-2">Assets</label>
          <div className="flex flex-wrap gap-2">
            {symbols.map(sym => (
              <span key={sym} className="flex items-center gap-1 px-3 py-1 bg-slate-50 text-slate-900 border border-slate-200 rounded-lg text-sm font-semibold">
                {sym}
                <button onClick={() => removeSymbol(sym)} className="ml-1 hover:text-red-600 transition-colors">
                  <X className="w-3 h-3" />
                </button>
              </span>
            ))}
          </div>
        </div>

        {/* Add Symbol */}
        <div className="flex gap-2">
          <input
            value={newSymbol}
            onChange={e => setNewSymbol(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addSymbol()}
            placeholder="Add symbol (e.g. AAPL)"
            className="border border-slate-200 bg-white text-slate-900 rounded-lg px-3 py-2 text-sm flex-1 max-w-xs focus:outline-none focus:border-slate-300"
          />
          <button onClick={addSymbol} className="flex items-center gap-1 px-4 py-2 bg-slate-50 hover:bg-slate-700/80 border border-slate-200 rounded-lg text-sm font-bold text-slate-900 transition-colors">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>

        {/* Date range */}
        <div className="flex flex-wrap gap-4 items-end">
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
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || symbols.length < 2}
            className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-900 font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            <GitBranch className="w-4 h-4" />
            {mutation.isPending ? 'Calculating...' : 'Calculate Correlation'}
          </button>
        </div>
      </div>

      {/* Error */}
      {mutation.isError && (
        <div className="p-5 bg-red-50 border border-red-200 rounded-xl flex items-center gap-3 text-red-600 text-sm font-bold shadow-sm">
          <AlertTriangle className="w-5 h-5 shrink-0" />
          Failed to compute correlation. Ensure at least 2 valid symbols have data in this date range.
        </div>
      )}

      {/* Failed symbols warning */}
      {failed.length > 0 && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-600 text-sm font-bold shadow-sm">
          ⚠️ No data found for: {failed.join(', ')}. Correlation computed for the remaining symbols.
        </div>
      )}

      {/* Loading skeleton */}
      {mutation.isPending && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 shadow-lg shadow-sm animate-pulse">
          <div className="h-6 bg-slate-800 rounded w-48 mb-6"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-12 bg-white rounded border border-slate-200"></div>)}
          </div>
        </div>
      )}

      {/* Heatmap */}
      {corr && syms.length >= 2 && (
        <div className="glass-panel p-6 rounded-2xl border border-slate-200 shadow-lg shadow-sm">
          <h3 className="font-bold text-slate-900 mb-1 tracking-tight">Pearson Correlation Matrix</h3>
          <p className="text-[11px] text-slate-500 mb-6 font-medium">
            Based on daily returns · {startDate} → {endDate} · Source: Yahoo Finance
          </p>

          <div className="overflow-x-auto">
            <table className="border-collapse mx-auto">
              <thead>
                <tr>
                  <th className="w-24"></th>
                  {syms.map((sym: string) => (
                    <th key={sym} className="text-center text-xs font-bold text-slate-700 px-3 pb-2 min-w-[80px]">
                      {sym}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {syms.map((rowSym: string) => (
                  <tr key={rowSym}>
                    <td className="text-xs font-bold text-slate-700 pr-3 text-right py-1">{rowSym}</td>
                    {syms.map((colSym: string) => {
                      const val: number = corr[rowSym]?.[colSym] ?? 0;
                      return (
                        <td
                          key={colSym}
                          title={`${rowSym} vs ${colSym}: ${val.toFixed(4)}`}
                          style={{
                            backgroundColor: corrColor(val),
                            color: corrTextColor(val),
                          }}
                          className="text-center text-sm font-black px-4 py-3 rounded-md border-[3px] border-[#0f172a]"
                        >
                          {val.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="mt-8 flex items-center gap-4 justify-center bg-white py-3 rounded-xl border border-slate-200">
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              <span className="inline-block w-6 h-4 rounded shadow-sm" style={{ backgroundColor: 'rgb(75,255,75)' }}></span>
              +1.0 Strongly Correlated
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              <span className="inline-block w-6 h-4 rounded shadow-sm bg-white border border-gray-200"></span>
              0.0 No Correlation
            </div>
            <div className="flex items-center gap-2 text-[11px] font-bold text-slate-700 uppercase tracking-wide">
              <span className="inline-block w-6 h-4 rounded shadow-sm" style={{ backgroundColor: 'rgb(255,75,75)' }}></span>
              -1.0 Inversely Correlated
            </div>
          </div>

          <p className="text-[10px] font-medium text-slate-500 text-center mt-4">
            Correlation values range from -1.0 (perfect inverse) to +1.0 (perfect positive). Values near 0 indicate no linear relationship.
          </p>
        </div>
      )}

      {/* Empty state */}
      {!mutation.data && !mutation.isPending && (
        <div className="glass-panel p-16 rounded-2xl border border-slate-200 shadow-lg shadow-sm text-center text-slate-500">
          <GitBranch className="w-12 h-12 mx-auto mb-4 opacity-30 text-slate-700" />
          <p className="font-bold text-slate-900 text-lg">Add at least 2 symbols and click Calculate Correlation.</p>
          <p className="text-xs mt-2 font-medium">Suggestions: NVDA, BTC-USD, GLD, SPY, AAPL</p>
        </div>
      )}
    </div>
  );
}
