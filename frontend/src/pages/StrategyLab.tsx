import { useState, useMemo } from 'react';
import { Routes, Route, Link, useLocation, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { runBacktest } from '../services/api';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

type Strategy = 'sma_crossover' | 'ema_trend' | 'momentum' | 'mean_reversion';

const STRATEGY_OPTIONS: { value: Strategy; label: string }[] = [
  { value: 'sma_crossover', label: 'SMA Crossover' },
  { value: 'ema_trend', label: 'EMA Trend' },
  { value: 'momentum', label: 'Momentum' },
  { value: 'mean_reversion', label: 'Mean Reversion' },
];

export default function StrategyLab() {
  const [symbol, setSymbol] = useState('NVDA');
  const [strategy, setStrategy] = useState<Strategy>('sma_crossover');
  const [startDate, setStartDate] = useState('2020-01-01');
  const [endDate, setEndDate] = useState('2023-12-31');
  const [capital, setCapital] = useState(10000);
  const [fastPeriod, setFastPeriod] = useState(20);
  const [slowPeriod, setSlowPeriod] = useState(50);
  const [lookback, setLookback] = useState(20);
  const [mrWindow, setMrWindow] = useState(20);
  const [zThreshold, setZThreshold] = useState(1.5);

  const location = useLocation();
  const navigate = useNavigate();

  const strategyParams = useMemo(() => {
    if (strategy === 'sma_crossover') return { fast_period: fastPeriod, slow_period: slowPeriod };
    if (strategy === 'ema_trend') return { fast_period: fastPeriod, slow_period: slowPeriod };
    if (strategy === 'momentum') return { lookback_period: lookback };
    if (strategy === 'mean_reversion') return { window: mrWindow, z_score_threshold: zThreshold };
    return {};
  }, [strategy, fastPeriod, slowPeriod, lookback, mrWindow, zThreshold]);

  const backtest = useMutation({
    mutationFn: (payload: any) => runBacktest(payload),
    onSuccess: () => {
      if (location.pathname === '/strategy') navigate('/strategy/results');
    }
  });

  const handleRun = () => {
    backtest.mutate({
      symbol,
      start_date: startDate,
      end_date: endDate,
      strategy,
      params: strategyParams,
      initial_capital: capital,
    });
  };

  const tabs = [
    { path: '/strategy/results', label: 'Backtest Results' },
    { path: '/strategy/trust', label: 'Trust Engine' },
    { path: '/strategy/stress', label: 'Stress Lab' },
    { path: '/strategy/regimes', label: 'Market Regimes' },
    { path: '/strategy/autopsy', label: 'Strategy Autopsy' },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Strategy Lab</h2>
        <p className="text-slate-500 mt-1">Configure, backtest, and evaluate quantitative strategies.</p>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Config Panel */}
        <div className="lg:col-span-1 glass-panel p-6 rounded-2xl shadow-lg shadow-sm space-y-4 h-fit sticky top-24">
          <h3 className="font-bold text-slate-900 border-b border-slate-200 pb-2">Configuration</h3>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Asset Symbol</label>
            <input type="text" value={symbol} onChange={e => setSymbol(e.target.value.toUpperCase())}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-300" />
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Strategy</label>
            <select value={strategy} onChange={e => setStrategy(e.target.value as Strategy)}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-300">
              {STRATEGY_OPTIONS.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">From</label>
              <input type="date" value={startDate} onChange={e => setStartDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-300" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">To</label>
              <input type="date" value={endDate} onChange={e => setEndDate(e.target.value)}
                className="w-full bg-white border border-slate-200 rounded-lg px-2 py-2 text-xs text-slate-900 focus:outline-none focus:border-slate-300" />
            </div>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Initial Capital ($)</label>
            <input type="number" value={capital} onChange={e => setCapital(Number(e.target.value))}
              className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-300" />
          </div>

          {/* Dynamic params per strategy */}
          {(strategy === 'sma_crossover' || strategy === 'ema_trend') && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  {strategy === 'sma_crossover' ? 'SMA' : 'EMA'} Fast Period
                </label>
                <input type="number" value={fastPeriod} onChange={e => setFastPeriod(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-300" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">
                  {strategy === 'sma_crossover' ? 'SMA' : 'EMA'} Slow Period
                </label>
                <input type="number" value={slowPeriod} onChange={e => setSlowPeriod(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-300" />
              </div>
            </>
          )}
          {strategy === 'momentum' && (
            <div>
              <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Lookback Period (days)</label>
              <input type="number" value={lookback} onChange={e => setLookback(Number(e.target.value))}
                className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-300" />
            </div>
          )}
          {strategy === 'mean_reversion' && (
            <>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Rolling Window (days)</label>
                <input type="number" value={mrWindow} onChange={e => setMrWindow(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-300" />
              </div>
              <div>
                <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">Z-Score Threshold</label>
                <input type="number" step="0.1" value={zThreshold} onChange={e => setZThreshold(Number(e.target.value))}
                  className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-900 focus:outline-none focus:border-slate-300" />
              </div>
            </>
          )}

          {backtest.isError && (
            <p className="text-xs text-red-600 bg-red-50 rounded-lg p-2 border border-red-200">
              Backtest failed. Check symbol or try a longer date range.
            </p>
          )}

          <button
            onClick={handleRun}
            disabled={backtest.isPending}
            className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-slate-900 text-xs font-bold rounded-xl transition-all shadow-[0_0_15px_rgba(16,185,129,0.2)]"
          >
            {backtest.isPending ? 'Running...' : 'Run Backtest'}
          </button>
        </div>

        {/* Main Content Area */}
        <div className="lg:col-span-3 space-y-6">
          {backtest.data ? (
            <>
              {/* Tab Navigation */}
              <div className="flex space-x-1 p-1 overflow-x-auto border-b border-slate-200 mb-2">
                {tabs.map(tab => (
                  <Link 
                    key={tab.path} 
                    to={tab.path}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap transition-all ${location.pathname === tab.path ? 'bg-slate-50 text-slate-900 border border-slate-200' : 'text-slate-500 hover:bg-slate-800/60'}`}
                  >
                    {tab.label}
                  </Link>
                ))}
              </div>

              {/* Tab Content Routing */}
              <div className="glass-panel p-6 rounded-2xl shadow-lg shadow-sm min-h-[500px]">
                <Routes>
                  <Route path="/results" element={
                    <div className="space-y-6">
                      <h3 className="font-bold text-slate-900 text-lg">Backtest Results</h3>
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Total Return</p>
                          <p className={`text-xl font-black ${backtest.data.strategy.total_return >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                            {(backtest.data.strategy.total_return * 100).toFixed(2)}%
                          </p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Sharpe Ratio</p>
                          <p className="text-xl font-black text-slate-900">{backtest.data.strategy.sharpe_ratio.toFixed(2)}</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Max Drawdown</p>
                          <p className="text-xl font-black text-red-600">{(backtest.data.strategy.max_drawdown * 100).toFixed(2)}%</p>
                        </div>
                        <div className="bg-white p-4 rounded-xl border border-slate-200">
                          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Benchmark Return</p>
                          <p className={`text-xl font-black ${backtest.data.benchmark.total_return >= 0 ? 'text-slate-900' : 'text-red-600'}`}>
                            {(backtest.data.benchmark.total_return * 100).toFixed(2)}%
                          </p>
                        </div>
                      </div>
                      <div className="h-80 w-full mt-6">
                        <h4 className="font-bold text-slate-900 mb-4">Equity Curve vs Benchmark</h4>
                        <ResponsiveContainer width="100%" height="100%">
                          <LineChart data={backtest.data.strategy.history}>
                            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#1e293b" />
                            <XAxis dataKey="timestamp" tick={{fontSize: 10, fill: '#64748b'}} minTickGap={30} />
                            <YAxis domain={['auto', 'auto']} tick={{fontSize: 10, fill: '#64748b'}} />
                            <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '12px' }} />
                            <Legend />
                            <Line type="monotone" dataKey="portfolio_value" name="Strategy" stroke="#10b981" dot={false} strokeWidth={2} />
                          </LineChart>
                        </ResponsiveContainer>
                      </div>
                    </div>
                  } />
                  
                  <Route path="/trust" element={
                    <div className="space-y-6">
                      <h3 className="font-bold text-slate-900 text-lg">Backtest Trust Engine</h3>
                      <p className="text-slate-500 mb-6">"Can this backtest result be trusted?"</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="p-4 rounded-xl bg-white border border-slate-200 flex justify-between items-center">
                          <span className="font-bold text-slate-900 text-xs">Look-Ahead Bias</span>
                          <span className={`px-3 py-1 rounded-md text-[10px] font-bold ${backtest.data.trust.look_ahead_bias === 'PASS' ? 'bg-slate-50 text-slate-900 border border-slate-200' : 'bg-red-50 text-red-600 border border-red-200'}`}>
                            {backtest.data.trust.look_ahead_bias}
                          </span>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 flex justify-between items-center">
                          <span className="font-bold text-slate-900 text-xs">Data Leakage</span>
                          <span className="px-3 py-1 rounded-md text-[10px] font-bold bg-slate-50 text-slate-900 border border-slate-200">
                            {backtest.data.trust.data_leakage}
                          </span>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 flex justify-between items-center">
                          <span className="font-bold text-slate-900 text-xs">Out-of-Sample</span>
                          <span className="px-3 py-1 rounded-md text-[10px] font-bold bg-slate-800 text-slate-700 border border-slate-200">
                            {backtest.data.trust.out_of_sample_validation}
                          </span>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 flex justify-between items-center">
                          <span className="font-bold text-slate-900 text-xs">Parameter Sensitivity</span>
                          <span className={`px-3 py-1 rounded-md text-[10px] font-bold ${backtest.data.trust.parameter_sensitivity === 'HIGH' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'}`}>
                            {backtest.data.trust.parameter_sensitivity}
                          </span>
                        </div>
                        <div className="p-4 rounded-xl bg-white border border-slate-200 flex justify-between items-center">
                          <span className="font-bold text-slate-900 text-xs">Transaction Cost Sensitivity</span>
                          <span className={`px-3 py-1 rounded-md text-[10px] font-bold ${backtest.data.trust.transaction_cost_sensitivity === 'HIGH' ? 'bg-red-50 text-red-600 border border-red-200' : 'bg-sky-500/15 text-sky-400 border border-sky-500/30'}`}>
                            {backtest.data.trust.transaction_cost_sensitivity}
                          </span>
                        </div>
                      </div>
                    </div>
                  } />
                  
                  <Route path="/stress" element={
                    <div className="space-y-6">
                      <h3 className="font-bold text-slate-900 text-lg">Stress Test Lab</h3>
                      <p className="text-slate-500 mb-6">See how the strategy performs under adverse conditions.</p>
                      <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm text-slate-700">
                          <thead className="bg-white border-y border-slate-200">
                            <tr>
                              <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Scenario</th>
                              <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Total Return</th>
                              <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Sharpe Ratio</th>
                              <th className="py-3 px-4 font-bold text-slate-500 uppercase tracking-wide text-[10px]">Max Drawdown</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-800/80">
                            {Object.entries(backtest.data.stress).map(([key, metrics]: any) => (
                              <tr key={key} className="hover:bg-slate-800/30">
                                <td className="py-3 px-4 capitalize font-bold text-slate-900">{key.replace('_', ' ')}</td>
                                <td className={`py-3 px-4 font-black ${metrics.return >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{(metrics.return * 100).toFixed(2)}%</td>
                                <td className="py-3 px-4 text-slate-900 font-bold">{metrics.sharpe.toFixed(2)}</td>
                                <td className="py-3 px-4 text-red-600 font-black">{(metrics.drawdown * 100).toFixed(2)}%</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  } />
                  
                  <Route path="/regimes" element={
                    <div className="space-y-6">
                      <h3 className="font-bold text-slate-900 text-lg">Market Regime Analysis</h3>
                      <p className="text-slate-500 mb-6">Performance broken down by underlying market environments.</p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(backtest.data.regimes).map(([regime, metrics]: any) => (
                          <div key={regime} className="p-5 border border-slate-200 rounded-xl bg-white hover:bg-slate-100 transition-all shadow-sm">
                            <h4 className="font-bold text-slate-900 mb-2">{regime}</h4>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-500">Duration</span>
                              <span className="font-bold text-slate-900">{metrics.days} days</span>
                            </div>
                            <div className="flex justify-between text-xs mb-1">
                              <span className="text-slate-500">Regime Return</span>
                              <span className={`font-bold ${metrics.return >= 0 ? 'text-slate-900' : 'text-red-600'}`}>{(metrics.return * 100).toFixed(2)}%</span>
                            </div>
                            <div className="flex justify-between text-xs">
                              <span className="text-slate-500">Volatility</span>
                              <span className="font-bold text-sky-400">{(metrics.volatility * 100).toFixed(2)}%</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  } />
                  
                  <Route path="/autopsy" element={
                    <div className="space-y-6">
                      <h3 className="font-bold text-slate-900 text-lg">Strategy Autopsy & Explainable AI</h3>
                      <div className="bg-gradient-to-r from-emerald-900/40 to-slate-900 border border-slate-300/20 p-6 rounded-xl shadow-[0_0_15px_rgba(16,185,129,0.1)] text-slate-900 mb-6">
                        <h4 className="font-bold mb-3 text-slate-900">AI Research Assistant Insight</h4>
                        <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">
                          {backtest.data.ai_explanation}
                        </p>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="p-5 border border-slate-200 rounded-xl bg-white">
                          <h4 className="font-bold text-slate-900 mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg>
                            What Worked Well
                          </h4>
                          <ul className="list-disc pl-5 text-slate-500 space-y-2 text-sm">
                            {backtest.data.autopsy.reasons_good.map((r: string, i: number) => <li key={i}>{r}</li>)}
                          </ul>
                        </div>
                        <div className="p-5 border border-slate-200 rounded-xl bg-white">
                          <h4 className="font-bold text-red-600 mb-3 flex items-center gap-2">
                            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
                            Areas of Weakness
                          </h4>
                          <ul className="list-disc pl-5 text-slate-500 space-y-2 text-sm">
                            {backtest.data.autopsy.reasons_bad.map((r: string, i: number) => <li key={i}>{r}</li>)}
                          </ul>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4 mt-6">
                         <div className="p-4 bg-white border border-slate-200 rounded-xl">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Total Fees Paid</p>
                            <p className="text-xl font-black text-slate-900">${backtest.data.autopsy.total_fees_paid.toFixed(2)}</p>
                         </div>
                         <div className="p-4 bg-white border border-slate-200 rounded-xl">
                            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wide">Total Slippage</p>
                            <p className="text-xl font-black text-slate-900">${backtest.data.autopsy.total_slippage_experienced.toFixed(2)}</p>
                         </div>
                      </div>
                    </div>
                  } />
                </Routes>
              </div>
            </>
          ) : (
            <div className="h-full flex items-center justify-center glass-panel rounded-2xl p-12 text-slate-500 font-bold border border-slate-200">
              Configure parameters and run a backtest to see comprehensive analytics.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
