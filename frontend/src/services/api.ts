import axios from 'axios';

const API_URL = '/api';

export const apiClient = axios.create({
  baseURL: API_URL,
});


export const searchAssets = async (q: string) => {
  const { data } = await apiClient.get(`/assets/search?q=${q}`);
  return data;
};

export const getLatestPrice = async (symbol: string) => {
  const { data } = await apiClient.get(`/market/latest?symbol=${symbol}`);
  return data;
};

export const getHistoricalData = async (symbol: string, startDate: string, endDate: string) => {
  const { data } = await apiClient.get(`/market/history?symbol=${symbol}&start_date=${startDate}&end_date=${endDate}`);
  return data;
};

export const runBacktest = async (payload: any) => {
  const { data } = await apiClient.post('/backtest/run', payload);
  return data;
};

export interface NewsArticle {
  id: string;
  title: string;
  link: string;
  description?: string | null;
  image_url?: string | null;
  source_name?: string | null;
  source_url?: string | null;
  source_icon?: string | null;
  categories: string[];
  language?: string | null;
  country: string[];
  keywords: string[];
  published_at?: string | null;
  fetched_at: string;
  provider: string;
}

export interface PaginatedNews {
  articles: NewsArticle[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  cached_at?: string | null;
  is_stale: boolean;
  message?: string | null;
  provider: string;
}

export const getLatestNews = async (
  category?: string,
  q?: string,
  source?: string,
  page: number = 1,
  pageSize: number = 20,
  forceRefresh: boolean = false
): Promise<PaginatedNews> => {
  const params: Record<string, any> = {
    page,
    page_size: pageSize,
  };
  if (category && category !== 'top' && category !== 'all') {
    params.category = category;
  }
  if (q) params.q = q;
  if (source) params.source = source;
  if (forceRefresh) params.force_refresh = true;

  const { data } = await apiClient.get<PaginatedNews>('/news/latest', { params });
  return data;
};

export const getAssetNews = async (symbol: string) => {
  const { data } = await apiClient.get('/news/asset', { params: { symbol } });
  return data;
};

export const getNewsStatus = async () => {
  const { data } = await apiClient.get('/news/status');
  return data;
};


/**
 * Compute Pearson correlation matrix for the provided symbols.
 * Returns { correlation: Record<string, Record<string, number>>, symbols: string[], failed_symbols: string[] }
 */
export const getCorrelation = async (
  symbols: string[],
  startDate: string,
  endDate: string,
) => {
  const { data } = await apiClient.post('/analysis/correlation', null, {
    params: {
      symbols: symbols.join(','),
      start_date: startDate,
      end_date: endDate,
    },
  });
  return data as {
    correlation: Record<string, Record<string, number>>;
    symbols: string[];
    failed_symbols: string[];
  };
};

export interface UpdateProfilePayload {
  current_username: string;
  new_username?: string;
  new_avatar_url?: string;
}

export interface UpdateProfileResponse {
  access_token: string;
  token_type: string;
  user: {
    username: string;
    email: string;
    avatar_url: string;
  };
}

export const updateProfileApi = async (payload: UpdateProfilePayload): Promise<UpdateProfileResponse> => {
  try {
    const { data } = await apiClient.put<UpdateProfileResponse>('/auth/profile', payload);
    return data;
  } catch (err: any) {
    // If relative proxy path fails, fallback to direct port 8000
    if (!err.response && typeof window !== 'undefined') {
      const { data } = await axios.put<UpdateProfileResponse>('http://localhost:8000/api/auth/profile', payload);
      return data;
    }
    throw err;
  }
};

