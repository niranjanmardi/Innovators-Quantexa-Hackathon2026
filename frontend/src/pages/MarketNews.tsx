import { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getLatestNews } from '../services/api';

import {
  Search, RefreshCw, ExternalLink, Clock, Newspaper,
  Filter, Tag, Building2, AlertCircle, Info, Sparkles, X
} from 'lucide-react';

const COMMON_STOPWORDS = new Set([
  'a', 'about', 'above', 'after', 'again', 'against', 'all', 'am', 'an', 'and', 'any', 'are', 'aren',
  'as', 'at', 'be', 'because', 'been', 'before', 'being', 'below', 'between', 'both', 'but', 'by',
  'can', 'could', 'did', 'do', 'does', 'doing', 'down', 'during', 'each', 'few', 'for', 'from',
  'further', 'had', 'has', 'have', 'having', 'he', 'her', 'here', 'hers', 'herself', 'him', 'himself',
  'his', 'how', 'i', 'if', 'in', 'into', 'is', 'it', 'its', 'itself', 'just', 'me', 'more', 'most',
  'my', 'myself', 'no', 'nor', 'not', 'now', 'of', 'off', 'on', 'once', 'only', 'or', 'other', 'our',
  'ours', 'ourselves', 'out', 'over', 'own', 'same', 'she', 'should', 'so', 'some', 'such', 'than',
  'that', 'the', 'their', 'theirs', 'them', 'themselves', 'then', 'there', 'these', 'they', 'this',
  'those', 'through', 'to', 'too', 'under', 'until', 'up', 'very', 'was', 'we', 'were', 'what', 'when',
  'where', 'which', 'while', 'who', 'whom', 'why', 'with', 'would', 'you', 'your', 'yours', 'yourself',
  'yourselves', 'says', 'said', 'will', 'new', 'us', 'market', 'stocks', 'stock', 'today', 'year',
  'first', 'two', 'one', 'amid', 'may', 'see', 'set', 'get', 'like', 'back', 'take', 'make', 'could'
]);

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return 'Recently';
  try {
    const diffSeconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diffSeconds < 0 || isNaN(diffSeconds)) return 'Just now';
    if (diffSeconds < 60) return `${diffSeconds}s ago`;
    const diffMinutes = Math.floor(diffSeconds / 60);
    if (diffMinutes < 60) return `${diffMinutes}m ago`;
    const diffHours = Math.floor(diffMinutes / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    const diffDays = Math.floor(diffHours / 24);
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  } catch {
    return 'Recently';
  }
}

function formatAbsoluteTime(dateStr?: string | null): string {
  if (!dateStr) return 'Unknown date';
  try {
    return new Date(dateStr).toUTCString();
  } catch {
    return 'Unknown date';
  }
}

// Neutral image placeholder component with lazy-loading and aspect ratio stability
function ArticleImage({
  src,
  alt,
  className = "w-full h-full object-cover",
}: {
  src?: string | null;
  alt?: string;
  className?: string;
}) {
  const [hasError, setHasError] = useState(!src);

  if (hasError || !src) {
    return (
      <div className="w-full h-full bg-slate-50 border border-slate-200 flex flex-col items-center justify-center text-slate-500 p-2">
        <Newspaper className="w-6 h-6 mb-1 opacity-40" />
        <span className="text-[10px] font-medium tracking-tight opacity-60">NewsData.io</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt || "News thumbnail"}
      loading="lazy"
      onError={() => setHasError(true)}
      className={className}
    />
  );
}

const CATEGORIES = [
  { id: 'top', label: 'Top Stories' },
  { id: 'business', label: 'Business & Finance' },
  { id: 'technology', label: 'Technology' },
  { id: 'crypto', label: 'Crypto & Digital Assets' },
  { id: 'my_assets', label: 'My Assets (NVDA, BTC, GLD, AAPL)' },
];

const MY_ASSET_TERMS = ['NVDA', 'NVIDIA', 'BTC', 'BITCOIN', 'GLD', 'GOLD', 'AAPL', 'APPLE', 'SPY'];

export default function MarketNews() {
  const [activeCategory, setActiveCategory] = useState<string>('top');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedSource, setSelectedSource] = useState<string>('all');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState<number>(20);
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);

  // 60-second Refresh button cooldown timer
  useEffect(() => {
    if (cooldownSeconds <= 0) return;
    const interval = setInterval(() => {
      setCooldownSeconds((prev) => Math.max(0, prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, [cooldownSeconds]);

  // Determine query parameters for News API
  const apiCategory = activeCategory === 'my_assets' ? 'business' : activeCategory;

  const {
    data: newsData,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['news_latest', apiCategory],
    queryFn: () => getLatestNews(apiCategory === 'top' ? undefined : apiCategory, undefined, undefined, 1, 200),
    staleTime: 5 * 60 * 1000,
  });

  const handleRefresh = async () => {
    if (cooldownSeconds > 0 || isFetching) return;
    setCooldownSeconds(60);
    await refetch();
  };

  const rawArticles = useMemo(() => newsData?.articles || [], [newsData]);

  // Compute dynamic Trending Topics strictly from loaded articles (A9)
  const trendingTopics = useMemo(() => {
    if (!rawArticles.length) return [];
    const freqMap: Record<string, number> = {};

    rawArticles.forEach((art) => {
      // 1. From keywords field if present
      if (art.keywords && Array.isArray(art.keywords)) {
        art.keywords.forEach((kw) => {
          const clean = kw.trim().toLowerCase();
          if (clean.length > 2 && !COMMON_STOPWORDS.has(clean)) {
            freqMap[clean] = (freqMap[clean] || 0) + 2;
          }
        });
      }

      // 2. From title tokens
      const words = art.title.toLowerCase().replace(/[^a-z0-9\s]/g, ' ').split(/\s+/);
      words.forEach((w) => {
        if (w.length > 3 && !COMMON_STOPWORDS.has(w) && isNaN(Number(w))) {
          freqMap[w] = (freqMap[w] || 0) + 1;
        }
      });
    });

    return Object.entries(freqMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10)
      .map(([topic, count]) => ({ topic, count }));
  }, [rawArticles]);

  // Compute Top Sources strictly from loaded articles (A9)
  const topSources = useMemo(() => {
    if (!rawArticles.length) return [];
    const sourceCount: Record<string, number> = {};
    rawArticles.forEach((art) => {
      const src = art.source_name || 'Other';
      sourceCount[src] = (sourceCount[src] || 0) + 1;
    });

    return Object.entries(sourceCount)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8)
      .map(([source, count]) => ({ source, count }));
  }, [rawArticles]);

  // Client-side filtering over the cached 200 articles (0 credits consumed)
  const filteredArticles = useMemo(() => {
    let result = rawArticles;

    // Filter by My Assets tab
    if (activeCategory === 'my_assets') {
      result = result.filter((art) => {
        const text = `${art.title} ${art.description || ''} ${(art.keywords || []).join(' ')}`.toUpperCase();
        return MY_ASSET_TERMS.some((asset) => text.includes(asset));
      });
    }

    // Filter by Source dropdown
    if (selectedSource !== 'all') {
      result = result.filter((art) => art.source_name === selectedSource);
    }

    // Filter by Trending Topic tag
    if (selectedTag) {
      const tagLower = selectedTag.toLowerCase();
      result = result.filter((art) => {
        const inTitle = art.title.toLowerCase().includes(tagLower);
        const inDesc = art.description?.toLowerCase().includes(tagLower);
        const inKw = art.keywords?.some((k) => k.toLowerCase().includes(tagLower));
        return inTitle || inDesc || inKw;
      });
    }

    // Filter by Search Query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase().trim();
      result = result.filter((art) => {
        const inTitle = art.title.toLowerCase().includes(query);
        const inDesc = art.description?.toLowerCase().includes(query);
        const inSource = art.source_name?.toLowerCase().includes(query);
        return inTitle || inDesc || inSource;
      });
    }

    return result;
  }, [rawArticles, activeCategory, selectedSource, selectedTag, searchQuery]);

  // Lead hero story + 3 companion stories
  const leadStory = filteredArticles.length > 0 ? filteredArticles[0] : null;
  const companionStories = filteredArticles.slice(1, 4);
  const remainingStories = filteredArticles.slice(4, visibleCount);
  const hasMore = visibleCount < filteredArticles.length;

  return (
    <div className="space-y-6">
      {/* Header & Refresh Ribbon */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-xl sm:text-2xl font-black tracking-tight text-slate-900 flex items-center gap-2">
              <Newspaper className="w-6 h-6 text-slate-900" />
              Market News Intelligence
            </h1>
            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-slate-900 border border-slate-200">
              NewsData.io Real Data
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Global market headlines, macro developments, and real-time asset context for research.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={handleRefresh}
            disabled={cooldownSeconds > 0 || isFetching}
            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold border transition-all ${
              cooldownSeconds > 0 || isFetching
                ? 'bg-slate-100 text-slate-500 border-slate-200 cursor-not-allowed'
                : 'bg-slate-800 hover:bg-slate-700/80 text-slate-900 border-slate-200/80 hover:border-slate-200 shadow-sm active:scale-95'
            }`}
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isFetching ? 'animate-spin text-slate-900' : ''}`} />
            <span>
              {isFetching
                ? 'Refreshing...'
                : cooldownSeconds > 0
                ? `Cooldown (${cooldownSeconds}s)`
                : 'Refresh News'}
            </span>
          </button>
        </div>
      </header>

      {/* Stale Cache Notice if applicable */}
      {newsData?.is_stale && (
        <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-amber-50 border border-amber-500/30 text-amber-300 text-xs">
          <Info className="w-4 h-4 shrink-0" />
          <span>
            {newsData.message || `Showing saved news from ${newsData.cached_at || 'cache'}.`}
          </span>
        </div>
      )}

      {/* Category Tabs & Client Filter Controls */}
      <div className="space-y-3">
        {/* Horizontal Category Tabs */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar border-b border-slate-200/60">
          {CATEGORIES.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id);
                setVisibleCount(20);
              }}
              className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap ${
                activeCategory === cat.id
                  ? 'bg-slate-100 text-slate-800 border border-slate-200 shadow-sm'
                  : 'text-slate-500 hover:text-slate-900 hover:bg-slate-800/60 border border-transparent'
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Filter Toolbar: Search Bar + Source Dropdown + Clear Filter */}
        <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200">
          <div className="flex flex-1 items-center gap-2 min-w-[240px]">
            <div className="relative flex-1">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search loaded articles by headline, keyword, or asset..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white text-slate-900 placeholder-slate-500 text-xs rounded-xl pl-9 pr-8 py-2 border border-slate-200/60 focus:outline-none focus:border-slate-200"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Source Filter Dropdown */}
            <div className="flex items-center gap-1.5 shrink-0">
              <Building2 className="w-3.5 h-3.5 text-slate-500" />
              <select
                value={selectedSource}
                onChange={(e) => setSelectedSource(e.target.value)}
                className="bg-white text-slate-700 text-xs rounded-xl px-2.5 py-2 border border-slate-200/60 focus:outline-none focus:border-slate-200"
              >
                <option value="all">All Sources ({rawArticles.length})</option>
                {topSources.map((s) => (
                  <option key={s.source} value={s.source}>
                    {s.source} ({s.count})
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Active Tag Filter Indicator */}
          {selectedTag && (
            <div className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-slate-200 text-slate-900 text-xs">
              <Tag className="w-3 h-3" />
              <span>Filter: <strong>{selectedTag}</strong></span>
              <button
                onClick={() => setSelectedTag(null)}
                className="hover:text-slate-900"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
          )}

          <div className="text-[11px] text-slate-500 font-medium">
            Showing <strong className="text-slate-900">{filteredArticles.length}</strong> of {rawArticles.length} cached
          </div>
        </div>
      </div>

      {/* Main Content Layout: Grid & Sidebar */}
      {isLoading ? (
        /* Loading Skeleton State (A12) */
        <div className="space-y-6">
          <div className="flex items-center gap-3 p-4 rounded-xl bg-slate-50 border border-slate-200 text-slate-500 text-xs animate-pulse">
            <RefreshCw className="w-4 h-4 animate-spin text-slate-900" />
            <span>Fetching latest news from NewsData.io...</span>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-4">
              <div className="h-72 bg-slate-100 rounded-2xl border border-slate-200 animate-pulse" />
              <div className="space-y-3">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="flex gap-4 p-4 rounded-xl bg-slate-50 border border-slate-200 animate-pulse">
                    <div className="w-24 h-24 bg-slate-800 rounded-lg shrink-0" />
                    <div className="flex-1 space-y-2.5 py-1">
                      <div className="h-4 bg-slate-800 rounded w-4/5" />
                      <div className="h-3 bg-slate-800 rounded w-3/5" />
                      <div className="h-3 bg-slate-800 rounded w-1/4 mt-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="space-y-4">
              <div className="h-48 bg-slate-100 rounded-2xl border border-slate-200 animate-pulse" />
              <div className="h-48 bg-slate-100 rounded-2xl border border-slate-200 animate-pulse" />
            </div>
          </div>
        </div>
      ) : error ? (
        /* Error State (A2, A12) */
        <div className="p-8 rounded-2xl bg-red-950/20 border border-red-800/40 text-center space-y-3">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto" />
          <h2 className="text-base font-bold text-red-200">News is currently unavailable. Please try again later.</h2>
          <p className="text-xs text-red-400/80 max-w-md mx-auto">
            Unable to reach NewsData.io and no cached articles exist. Financial analysis tabs and backtesting remain fully functional.
          </p>
        </div>
      ) : filteredArticles.length === 0 ? (
        /* Empty State (A12) */
        <div className="p-12 rounded-2xl bg-white border border-slate-200 text-center space-y-3">
          <Filter className="w-10 h-10 text-slate-600 mx-auto" />
          <h2 className="text-sm font-bold text-slate-700">No articles match your filters.</h2>
          <p className="text-xs text-slate-500">Try adjusting your search query, clearing tags, or selecting another category.</p>
          {(searchQuery || selectedTag || selectedSource !== 'all') && (
            <button
              onClick={() => {
                setSearchQuery('');
                setSelectedTag(null);
                setSelectedSource('all');
              }}
              className="px-4 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-700 text-xs font-semibold border border-slate-200"
            >
              Reset Filters
            </button>
          )}
        </div>
      ) : (
        /* News Layout (A9): Hero Row + Headline Feed + Sidebar */
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column (2/3 width) */}
          <div className="lg:col-span-2 space-y-6">
            {/* HERO ROW (Yahoo-News-Style: 1 large lead story + 3 companion stories) */}
            {leadStory && !searchQuery && !selectedTag && selectedSource === 'all' && (
              <div className="space-y-4">
                {/* 1 Large Lead Story */}
                <a
                  href={leadStory.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block bg-white border border-slate-200 hover:border-slate-200 rounded-2xl overflow-hidden transition-all shadow-sm hover:shadow-lg"
                >
                  <div className="relative h-64 sm:h-72 w-full overflow-hidden bg-slate-50">
                    <ArticleImage
                      src={leadStory.image_url}
                      alt={leadStory.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#0f172a] via-[#0f172a]/40 to-transparent" />

                    <div className="absolute top-3 left-3 flex items-center gap-2">
                      <span className="px-2.5 py-1 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-emerald-500 text-slate-950">
                        Lead Story
                      </span>
                      {leadStory.categories?.[0] && (
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold capitalize bg-slate-100 text-slate-700 border border-slate-200/60">
                          {leadStory.categories[0]}
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="p-5 space-y-2.5 -mt-6 relative">
                    <h2 className="text-lg sm:text-xl font-black text-slate-900 group-hover:text-slate-800 transition-colors leading-snug">
                      {leadStory.title}
                    </h2>
                    {leadStory.description && (
                      <p className="text-xs text-slate-700 line-clamp-2 leading-relaxed">
                        {leadStory.description}
                      </p>
                    )}

                    <div className="flex items-center justify-between pt-2 border-t border-slate-200 text-[11px] text-slate-500">
                      <div className="flex items-center gap-2">
                        {leadStory.source_icon && (
                          <img
                            src={leadStory.source_icon}
                            alt=""
                            className="w-4 h-4 rounded-full"
                            onError={(e) => (e.currentTarget.style.display = 'none')}
                          />
                        )}
                        <span className="font-semibold text-slate-900">{leadStory.source_name}</span>
                        <span>•</span>
                        <span title={formatAbsoluteTime(leadStory.published_at)} className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-500" />
                          {formatRelativeTime(leadStory.published_at)}
                        </span>
                      </div>
                      <span className="flex items-center gap-1 text-slate-900 font-semibold group-hover:translate-x-0.5 transition-transform">
                        Read Story <ExternalLink className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                </a>

                {/* 3 Companion Featured Stories Grid */}
                {companionStories.length > 0 && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {companionStories.map((story) => (
                      <a
                        key={story.id}
                        href={story.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group bg-white border border-slate-200 hover:border-slate-200 p-3 rounded-xl flex flex-col justify-between transition-all hover:bg-slate-50/60"
                      >
                        <div className="space-y-2">
                          <div className="h-28 w-full rounded-lg overflow-hidden bg-slate-50 relative">
                            <ArticleImage
                              src={story.image_url}
                              alt={story.title}
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            />
                            {story.categories?.[0] && (
                              <span className="absolute bottom-1.5 left-1.5 px-1.5 py-0.5 rounded text-[9px] font-bold capitalize bg-slate-50/85 text-slate-700">
                                {story.categories[0]}
                              </span>
                            )}
                          </div>
                          <h3 className="text-xs font-bold text-slate-900 group-hover:text-slate-800 line-clamp-2 leading-snug">
                            {story.title}
                          </h3>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2.5 pt-2 border-t border-slate-200">
                          <span className="truncate max-w-[90px] font-medium text-slate-500">{story.source_name}</span>
                          <span title={formatAbsoluteTime(story.published_at)}>
                            {formatRelativeTime(story.published_at)}
                          </span>
                        </div>
                      </a>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Main Headline List (Thumbnails on Left, 2-line Description Clamp) */}
            <div className="space-y-3">
              <div className="flex items-center justify-between pb-1">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-slate-900" />
                  Latest Market Wire
                </h3>
                <span className="text-[11px] text-slate-500">
                  {filteredArticles.length} stories available
                </span>
              </div>

              {(searchQuery || selectedTag || selectedSource !== 'all' ? filteredArticles : remainingStories).map((article) => (
                <a
                  key={article.id}
                  href={article.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex gap-4 p-3.5 bg-white border border-slate-200/90 hover:border-slate-200 hover:bg-slate-50/60 rounded-xl transition-all shadow-sm"
                >
                  {/* Left Thumbnail (with fixed dimensions to prevent layout shifting) */}
                  <div className="w-24 h-24 sm:w-28 sm:h-24 rounded-lg overflow-hidden shrink-0 bg-slate-50 relative">
                    <ArticleImage
                      src={article.image_url}
                      alt={article.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>

                  {/* Headline & Details */}
                  <div className="flex-1 flex flex-col justify-between min-w-0">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        {article.categories?.[0] && (
                          <span className="px-1.5 py-0.5 rounded text-[9px] font-bold capitalize bg-slate-800 text-slate-900 border border-slate-200">
                            {article.categories[0]}
                          </span>
                        )}
                        <span className="text-[10px] font-medium text-slate-500 truncate">
                          {article.source_name}
                        </span>
                      </div>

                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 group-hover:text-slate-800 line-clamp-2 leading-snug">
                        {article.title}
                      </h4>

                      {article.description && (
                        <p className="text-[11px] text-slate-500 line-clamp-2 mt-1 leading-relaxed">
                          {article.description}
                        </p>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                      <span title={formatAbsoluteTime(article.published_at)} className="flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-500" />
                        {formatRelativeTime(article.published_at)}
                      </span>
                      <span className="flex items-center gap-1 text-slate-500 group-hover:text-slate-900 font-medium">
                        Open <ExternalLink className="w-2.5 h-2.5" />
                      </span>
                    </div>
                  </div>
                </a>
              ))}
            </div>

            {/* Pagination: Load More over cached 200 (A9) */}
            {hasMore && (
              <div className="text-center pt-2">
                <button
                  onClick={() => setVisibleCount((prev) => prev + 20)}
                  className="px-6 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-700 text-slate-900 text-xs font-bold border border-slate-200 shadow-sm transition-all hover:border-slate-200 active:scale-95"
                >
                  Load More Headlines ({filteredArticles.length - visibleCount} remaining)
                </button>
              </div>
            )}
          </div>

          {/* Right Sidebar (1/3 width): Trending Topics & Top Sources (A9) */}
          <div className="space-y-6">
            {/* Trending Topics Box */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-slate-900" />
                  Trending Topics
                </h3>
              </div>
              <p className="text-[10px] text-slate-500">
                Based on the {rawArticles.length} articles loaded.
              </p>

              {trendingTopics.length > 0 ? (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {trendingTopics.map(({ topic, count }) => {
                    const isSelected = selectedTag?.toLowerCase() === topic;
                    return (
                      <button
                        key={topic}
                        onClick={() => setSelectedTag(isSelected ? null : topic)}
                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition-all ${
                          isSelected
                            ? 'bg-emerald-500 text-slate-950 font-bold'
                            : 'bg-slate-50 hover:bg-slate-700 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span>#{topic}</span>
                        <span className={`text-[10px] ${isSelected ? 'text-slate-900' : 'text-slate-500'}`}>
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No keywords identified.</p>
              )}
            </div>

            {/* Top Sources Box */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-black uppercase tracking-wider text-slate-900 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-slate-900" />
                  Top Sources
                </h3>
              </div>
              <p className="text-[10px] text-slate-500">
                Based on the {rawArticles.length} articles loaded.
              </p>

              {topSources.length > 0 ? (
                <div className="space-y-2 pt-1">
                  {topSources.map(({ source, count }) => {
                    const isSelected = selectedSource === source;
                    return (
                      <button
                        key={source}
                        onClick={() => setSelectedSource(isSelected ? 'all' : source)}
                        className={`w-full flex items-center justify-between p-2 rounded-xl text-xs transition-all ${
                          isSelected
                            ? 'bg-slate-100 text-slate-800 border border-slate-200'
                            : 'bg-slate-100 hover:bg-slate-800 text-slate-700 border border-slate-200'
                        }`}
                      >
                        <span className="truncate font-medium">{source}</span>
                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-50 text-slate-500 font-mono">
                          {count}
                        </span>
                      </button>
                    );
                  })}
                </div>
              ) : (
                <p className="text-xs text-slate-500">No sources available.</p>
              )}
            </div>

            {/* Research Context & Policy Reminder (A1, A11) */}
            <div className="bg-slate-100 p-4 rounded-2xl border border-slate-200 text-[11px] text-slate-500 space-y-2">
              <div className="flex items-center gap-1.5 text-slate-700 font-bold">
                <Info className="w-3.5 h-3.5 text-slate-900" />
                Research Context Notice
              </div>
              <p className="leading-relaxed">
                News articles provide qualitative context for quantitative strategies. Never interpret headlines as predictive trading signals or buy/sell recommendations.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Mandatory Footer (A9) */}
      <footer className="pt-6 border-t border-slate-200 text-center space-y-1.5 text-[11px] text-slate-500">
        <p>
          Source: <strong className="text-slate-500">NewsData.io</strong> • Articles Loaded: {rawArticles.length} • Updated: {newsData?.cached_at ? formatAbsoluteTime(newsData.cached_at) : 'Live'}
        </p>
        <p className="text-[10px] text-slate-500 italic max-w-xl mx-auto">
          Free-plan news may be delayed. This is not live news, and it is not investment advice.
        </p>
      </footer>
    </div>
  );
}
