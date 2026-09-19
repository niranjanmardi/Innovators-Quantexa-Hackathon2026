from fastapi import APIRouter, HTTPException, Query
from typing import Optional, List, Dict, Any
import pandas as pd
from app.services.asset_manager import asset_manager
from app.services.quant_engine import quant_engine
from app.services.backtest_engine import backtest_engine
from app.services.trust_engine import trust_engine
from app.services.stress_test import stress_test_lab
from app.services.regime_engine import regime_engine
from app.services.strategy_autopsy import strategy_autopsy
from app.services.ai_explainer import ai_explainer
from app.services.news_service import news_service
from app.services.cache import cache_service
from pydantic import BaseModel
from app.services.auth_service import auth_service
import datetime

router = APIRouter()

# --- AUTHENTICATION ENDPOINTS ---

class SignupRequest(BaseModel):
    email: str
    username: str
    password: str
    avatar_url: Optional[str] = "https://api.dicebear.com/7.x/shapes/svg?seed=Quant1"

class LoginRequest(BaseModel):
    username: str
    password: str

@router.post("/auth/signup")
def signup(req: SignupRequest):
    try:
        user = auth_service.create_user(req.email, req.username, req.password, req.avatar_url)
        # Create token right away
        access_token = auth_service.create_access_token(
            data={"sub": user["username"]},
            expires_delta=datetime.timedelta(minutes=auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {
            "access_token": access_token, 
            "token_type": "bearer",
            "user": {
                "username": user["username"],
                "email": user["email"],
                "avatar_url": user["avatar_url"]
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))

@router.post("/auth/login")
def login(req: LoginRequest):
    user = auth_service.authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(
            status_code=401,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    access_token = auth_service.create_access_token(
        data={"sub": user["username"]},
        expires_delta=datetime.timedelta(minutes=auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
    )
    return {
        "access_token": access_token, 
        "token_type": "bearer",
        "user": {
            "username": user["username"],
            "email": user["email"],
            "avatar_url": user["avatar_url"]
        }
    }

class UpdateProfileRequest(BaseModel):
    current_username: str
    new_username: Optional[str] = None
    new_avatar_url: Optional[str] = None

@router.put("/auth/profile")
@router.post("/auth/profile")
def update_profile(req: UpdateProfileRequest):
    try:
        updated_user = auth_service.update_user(
            current_username=req.current_username,
            new_username=req.new_username,
            new_avatar_url=req.new_avatar_url
        )
        access_token = auth_service.create_access_token(
            data={"sub": updated_user["username"]},
            expires_delta=datetime.timedelta(minutes=auth_service.ACCESS_TOKEN_EXPIRE_MINUTES)
        )
        return {
            "access_token": access_token,
            "token_type": "bearer",
            "user": {
                "username": updated_user["username"],
                "email": updated_user["email"],
                "avatar_url": updated_user["avatar_url"]
            }
        }
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


class BacktestRequest(BaseModel):
    symbol: str
    start_date: str
    end_date: str
    strategy: str # e.g. "sma_crossover"
    params: Dict[str, Any]
    initial_capital: float = 10000.0

@router.get("/assets/search")
def search_assets(q: str):
    return asset_manager.search(q)

@router.get("/market/latest")
def get_latest(symbol: str):
    return asset_manager.get_latest_price(symbol)

@router.get("/market/history")
def get_history(symbol: str, start_date: str, end_date: str, interval: str = "1d"):
    df = asset_manager.get_historical_data(symbol, start_date, end_date, interval)
    if df is None or df.empty:
        return []
    df = df.copy()
    df['timestamp'] = pd.to_datetime(df['timestamp']).dt.strftime('%Y-%m-%d')
    return df.to_dict(orient="records")

@router.post("/backtest/run")
def run_backtest(req: BacktestRequest):
    df = asset_manager.get_historical_data(req.symbol, req.start_date, req.end_date)
    if df.empty:
        raise HTTPException(status_code=400, detail="No historical data found for period")
        
    if req.strategy == "sma_crossover":
        res = backtest_engine.run_sma_crossover(df, **req.params, initial_capital=req.initial_capital)
        bm_res = backtest_engine.run_benchmark(df, req.initial_capital)

        
        # Add basic trust engine and autopsy to the result to simplify frontend
        # In a real app, these might be separate calls to save time
        
        # Simple variations for trust
        variations = [
            {"fast_period": req.params.get("fast_period", 50) + 5, "slow_period": req.params.get("slow_period", 200)},
            {"fast_period": req.params.get("fast_period", 50) - 5, "slow_period": req.params.get("slow_period", 200)}
        ]
        
        trust_res = trust_engine.evaluate_trust(
            backtest_engine.run_sma_crossover, df, req.params, variations, req.initial_capital
        )
        
        stress_res = stress_test_lab.run_stress_tests(
            backtest_engine.run_sma_crossover, df, req.params, req.initial_capital
        )
        
        regimes = regime_engine.classify_regimes(df)
        history_df = pd.DataFrame(res['history'])
        regime_res = regime_engine.analyze_strategy_by_regime(history_df, regimes)
        
        autopsy_res = strategy_autopsy.generate_autopsy(res)
        
        ai_explanation = ai_explainer.explain_backtest(autopsy_res, {
            "total_return": res["total_return"],
            "max_drawdown": res["max_drawdown"]
        })
        
        return {
            "strategy": res,
            "benchmark": bm_res,
            "trust": trust_res,
            "stress": stress_res,
            "regimes": regime_res,
            "autopsy": autopsy_res,
            "ai_explanation": ai_explanation
        }

    elif req.strategy == "ema_trend":
        res = backtest_engine.run_ema_trend(df, **req.params, initial_capital=req.initial_capital)
        bm_res = backtest_engine.run_benchmark(df, req.initial_capital)

        variations = [
            {"fast_period": req.params.get("fast_period", 12) + 3, "slow_period": req.params.get("slow_period", 26)},
            {"fast_period": req.params.get("fast_period", 12) - 3, "slow_period": req.params.get("slow_period", 26)}
        ]

        trust_res = trust_engine.evaluate_trust(
            backtest_engine.run_ema_trend, df, req.params, variations, req.initial_capital
        )

        stress_res = stress_test_lab.run_stress_tests(
            backtest_engine.run_ema_trend, df, req.params, req.initial_capital
        )

        regimes = regime_engine.classify_regimes(df)
        history_df = pd.DataFrame(res['history'])
        regime_res = regime_engine.analyze_strategy_by_regime(history_df, regimes)

        autopsy_res = strategy_autopsy.generate_autopsy(res)

        ai_explanation = ai_explainer.explain_backtest(autopsy_res, {
            "total_return": res["total_return"],
            "max_drawdown": res["max_drawdown"]
        })

        return {
            "strategy": res,
            "benchmark": bm_res,
            "trust": trust_res,
            "stress": stress_res,
            "regimes": regime_res,
            "autopsy": autopsy_res,
            "ai_explanation": ai_explanation
        }

    elif req.strategy == "momentum":
        res = backtest_engine.run_momentum(df, **req.params, initial_capital=req.initial_capital)
        bm_res = backtest_engine.run_benchmark(df, req.initial_capital)

        variations = [
            {"lookback_period": req.params.get("lookback_period", 20) + 5},
            {"lookback_period": req.params.get("lookback_period", 20) - 5}
        ]

        trust_res = trust_engine.evaluate_trust(
            backtest_engine.run_momentum, df, req.params, variations, req.initial_capital
        )

        stress_res = stress_test_lab.run_stress_tests(
            backtest_engine.run_momentum, df, req.params, req.initial_capital
        )

        regimes = regime_engine.classify_regimes(df)
        history_df = pd.DataFrame(res['history'])
        regime_res = regime_engine.analyze_strategy_by_regime(history_df, regimes)

        autopsy_res = strategy_autopsy.generate_autopsy(res)

        ai_explanation = ai_explainer.explain_backtest(autopsy_res, {
            "total_return": res["total_return"],
            "max_drawdown": res["max_drawdown"]
        })

        return {
            "strategy": res,
            "benchmark": bm_res,
            "trust": trust_res,
            "stress": stress_res,
            "regimes": regime_res,
            "autopsy": autopsy_res,
            "ai_explanation": ai_explanation
        }

    elif req.strategy == "mean_reversion":
        res = backtest_engine.run_mean_reversion(df, **req.params, initial_capital=req.initial_capital)
        bm_res = backtest_engine.run_benchmark(df, req.initial_capital)

        variations = [
            {"window": req.params.get("window", 20), "z_score_threshold": req.params.get("z_score_threshold", 1.5) + 0.5},
            {"window": req.params.get("window", 20), "z_score_threshold": req.params.get("z_score_threshold", 1.5) - 0.5}
        ]

        trust_res = trust_engine.evaluate_trust(
            backtest_engine.run_mean_reversion, df, req.params, variations, req.initial_capital
        )

        stress_res = stress_test_lab.run_stress_tests(
            backtest_engine.run_mean_reversion, df, req.params, req.initial_capital
        )

        regimes = regime_engine.classify_regimes(df)
        history_df = pd.DataFrame(res['history'])
        regime_res = regime_engine.analyze_strategy_by_regime(history_df, regimes)

        autopsy_res = strategy_autopsy.generate_autopsy(res)

        ai_explanation = ai_explainer.explain_backtest(autopsy_res, {
            "total_return": res["total_return"],
            "max_drawdown": res["max_drawdown"]
        })

        return {
            "strategy": res,
            "benchmark": bm_res,
            "trust": trust_res,
            "stress": stress_res,
            "regimes": regime_res,
            "autopsy": autopsy_res,
            "ai_explanation": ai_explanation
        }

    raise HTTPException(status_code=400, detail="Unknown strategy")


# --- CORRELATION LAB ENDPOINTS ---

@router.get("/analysis/correlation")
@router.post("/analysis/correlation")
def get_correlation(
    symbols: str = Query(..., description="Comma-separated list of symbols"),
    start_date: str = Query(...),
    end_date: str = Query(...),
):
    """
    Compute Pearson correlation matrix for the given asset symbols over the date range.
    Returns a nested dict: {symbol: {symbol: correlation_value}}.
    """
    symbol_list = [s.strip().upper() for s in symbols.split(",") if s.strip()]
    if len(symbol_list) < 2:
        raise HTTPException(status_code=400, detail="Need at least 2 valid symbols")

    df_dict = {}
    failed = []
    for sym in symbol_list:
        try:
            df = asset_manager.get_historical_data(sym, start_date, end_date)
            if df is not None and not df.empty:
                df_dict[sym] = df
            else:
                failed.append(sym)
        except Exception:
            failed.append(sym)

    if len(df_dict) < 2:
        raise HTTPException(
            status_code=400,
            detail=f"Need at least 2 valid symbols with data. Failed: {failed}",
        )

    corr_matrix = quant_engine.calculate_correlation(df_dict)
    corr_rounded = corr_matrix.round(4)
    return {
        "correlation": corr_rounded.to_dict(),
        "symbols": list(corr_rounded.columns),
        "failed_symbols": failed,
    }


# --- ADDITIONAL QUANTITATIVE & DIAGNOSTIC ENDPOINTS (SPEC #35) ---

class IndicatorRequest(BaseModel):
    symbol: str
    start_date: str
    end_date: str
    sma_periods: List[int] = [20, 50, 200]
    ema_periods: List[int] = [12, 26]
    risk_free_rate: float = 0.0

@router.post("/analysis/indicators")
def get_indicators(req: IndicatorRequest):
    df = asset_manager.get_historical_data(req.symbol, req.start_date, req.end_date)
    if df.empty:
        raise HTTPException(status_code=400, detail=f"No data for {req.symbol}")

    res: Dict[str, Any] = {
        "symbol": req.symbol,
        "daily_returns": quant_engine.calculate_daily_returns(df).dropna().tolist(),
        "cumulative_returns": quant_engine.calculate_cumulative_returns(df).dropna().tolist(),
        "annualized_volatility": quant_engine.calculate_annualized_volatility(df),
        "sharpe_ratio": quant_engine.calculate_sharpe_ratio(df, risk_free_rate=req.risk_free_rate),
        "drawdown": quant_engine.calculate_maximum_drawdown(df),
        "sma": {},
        "ema": {},
    }
    for p in req.sma_periods:
        res["sma"][f"sma_{p}"] = quant_engine.calculate_sma(df, period=p).dropna().tolist()
    for p in req.ema_periods:
        res["ema"][f"ema_{p}"] = quant_engine.calculate_ema(df, period=p).dropna().tolist()
    return res

class RobustnessRequest(BaseModel):
    symbol: str
    start_date: str
    end_date: str
    strategy: str
    params: Dict[str, Any]
    initial_capital: float = 10000.0

@router.post("/backtest/robustness")
def analyze_robustness(req: RobustnessRequest):
    df = asset_manager.get_historical_data(req.symbol, req.start_date, req.end_date)
    if df.empty:
        raise HTTPException(status_code=400, detail="No historical data")

    strategy_map = {
        "sma_crossover": backtest_engine.run_sma_crossover,
        "ema_trend": backtest_engine.run_ema_trend,
        "momentum": backtest_engine.run_momentum,
        "mean_reversion": backtest_engine.run_mean_reversion,
    }
    func = strategy_map.get(req.strategy)
    if not func:
        raise HTTPException(status_code=400, detail=f"Unknown strategy: {req.strategy}")

    variations = []
    if "fast_period" in req.params:
        variations.append({**req.params, "fast_period": req.params["fast_period"] + 5})
        variations.append({**req.params, "fast_period": max(2, req.params["fast_period"] - 5)})
    elif "lookback_period" in req.params:
        variations.append({**req.params, "lookback_period": req.params["lookback_period"] + 5})
        variations.append({**req.params, "lookback_period": max(2, req.params["lookback_period"] - 5)})
    elif "window" in req.params:
        variations.append({**req.params, "window": req.params["window"] + 5})
        variations.append({**req.params, "window": max(2, req.params["window"] - 5)})

    return trust_engine.evaluate_trust(func, df, req.params, variations, req.initial_capital)

@router.post("/backtest/stress-test")
def analyze_stress(req: RobustnessRequest):
    df = asset_manager.get_historical_data(req.symbol, req.start_date, req.end_date)
    if df.empty:
        raise HTTPException(status_code=400, detail="No historical data")

    strategy_map = {
        "sma_crossover": backtest_engine.run_sma_crossover,
        "ema_trend": backtest_engine.run_ema_trend,
        "momentum": backtest_engine.run_momentum,
        "mean_reversion": backtest_engine.run_mean_reversion,
    }
    func = strategy_map.get(req.strategy)
    if not func:
        raise HTTPException(status_code=400, detail=f"Unknown strategy: {req.strategy}")

    return stress_test_lab.run_stress_tests(func, df, req.params, req.initial_capital)

class RegimeAnalysisRequest(BaseModel):
    symbol: str
    start_date: str
    end_date: str
    window: int = 60

@router.post("/regime/analyze")
def analyze_regimes(req: RegimeAnalysisRequest):
    df = asset_manager.get_historical_data(req.symbol, req.start_date, req.end_date)
    if df.empty:
        raise HTTPException(status_code=400, detail="No historical data")
    regime_df = regime_engine.classify_regimes(df, window=req.window)
    regime_df['timestamp'] = pd.to_datetime(regime_df['timestamp']).dt.strftime('%Y-%m-%d')
    return regime_df[['timestamp', 'close', 'regime', 'rolling_return', 'rolling_volatility']].to_dict(orient="records")

class AutopsyRequest(BaseModel):
    backtest_result: Dict[str, Any]

@router.post("/strategy/autopsy")
def generate_autopsy_endpoint(req: AutopsyRequest):
    return strategy_autopsy.generate_autopsy(req.backtest_result)

class AIExplainRequest(BaseModel):
    autopsy: Dict[str, Any]
    metrics: Dict[str, Any]

@router.post("/ai/explain")
def explain_endpoint(req: AIExplainRequest):
    return {"explanation": ai_explainer.explain_backtest(req.autopsy, req.metrics)}


# ==========================================
# News Intelligence Endpoints (Addendum A5)
# ==========================================

ALLOWED_NEWS_CATEGORIES = {"top", "business", "technology", "crypto", "all", "entertainment", "general", "health", "science", "sports", "world"}

class NewsArticleResponse(BaseModel):
    id: str
    title: str
    link: str
    description: Optional[str] = None
    image_url: Optional[str] = None
    source_name: Optional[str] = None
    source_url: Optional[str] = None
    source_icon: Optional[str] = None
    categories: List[str] = []
    language: Optional[str] = "en"
    country: List[str] = []
    keywords: List[str] = []
    published_at: Optional[str] = None
    fetched_at: str
    provider: str = "NewsData.io"

class PaginatedNewsResponse(BaseModel):
    articles: List[NewsArticleResponse]
    total: int
    page: int
    page_size: int
    total_pages: int
    cached_at: Optional[str] = None
    is_stale: bool = False
    message: Optional[str] = None
    provider: str = "NewsData.io"

class AssetNewsResponse(BaseModel):
    articles: List[NewsArticleResponse]
    symbol: str
    total: int
    query: Optional[str] = None
    relevance: str = "keyword-based"
    is_stale: bool = False
    cached_at: Optional[str] = None
    message: Optional[str] = None

class NewsStatusResponse(BaseModel):
    provider: str
    provider_status: str
    last_fetched_at: Optional[str] = None
    cache_age_seconds: Optional[int] = None
    articles_cached: int
    estimated_credits_used_today: int
    credit_cap: int
    credits_remaining: int
    ttl_minutes: int

@router.get("/news/latest", response_model=PaginatedNewsResponse)
async def get_latest_news_endpoint(
    category: Optional[str] = Query(None, description="Category filter (e.g. top, business, technology, crypto)"),
    q: Optional[str] = Query(None, max_length=100, description="Keyword search (max 100 characters)"),
    source: Optional[str] = Query(None, max_length=50, description="Source domain filter"),
    page: int = Query(1, ge=1, description="Page number (1-indexed)"),
    page_size: int = Query(20, ge=1, le=200, description="Number of articles per page"),
    force_refresh: bool = Query(False, description="Bypass fresh cache if true")
):
    if category and category.lower() not in ALLOWED_NEWS_CATEGORIES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid category '{category}'. Allowed: {', '.join(sorted(ALLOWED_NEWS_CATEGORIES))}"
        )

    # Clean and sanitize search query
    clean_q = q.strip() if q else None
    if clean_q and len(clean_q) > 100:
        clean_q = clean_q[:100]

    res = await news_service.fetch_news(
        category=category.lower() if category else None,
        q=clean_q,
        source=source.strip() if source else None,
        force_refresh=force_refresh
    )

    all_articles = res.get("articles", [])
    total = len(all_articles)

    # Client pagination over the cached batch
    start_idx = (page - 1) * page_size
    end_idx = start_idx + page_size
    paginated = all_articles[start_idx:end_idx]
    total_pages = max(1, (total + page_size - 1) // page_size) if total > 0 else 1

    return {
        "articles": paginated,
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": total_pages,
        "cached_at": res.get("cached_at"),
        "is_stale": res.get("is_stale", False),
        "message": res.get("message"),
        "provider": "NewsData.io"
    }

@router.get("/news/asset", response_model=AssetNewsResponse)
async def get_asset_news_endpoint(
    symbol: str = Query(..., min_length=1, max_length=15, pattern=r"^[A-Za-z0-9\-\.\^]+$", description="Ticker symbol")
):
    res = await news_service.get_asset_news(symbol)
    return {
        "articles": res.get("articles", []),
        "symbol": symbol.upper(),
        "total": res.get("total", 0),
        "query": res.get("query"),
        "relevance": "keyword-based",
        "is_stale": res.get("is_stale", False),
        "cached_at": res.get("cached_at"),
        "message": res.get("message")
    }

@router.get("/news/status", response_model=NewsStatusResponse)
def get_news_status_endpoint():
    return news_service.get_status()

class NewsContextRequest(BaseModel):
    symbol: str
    articles: List[Dict[str, Any]]

@router.post("/ai/news-context")
def explain_news_context(req: NewsContextRequest):
    """Contextualize news using strict A11 guidelines (no predictions, no causation claims)."""
    return {
        "context": ai_explainer.contextualize_news(req.articles, req.symbol)
    }


# ==========================================
# Yahoo-Style Top Market Ticker Bar & Key Setup
# ==========================================

TICKER_BAR_ITEMS = [
    {"symbol": "SPY", "displayName": "S&P 500"},
    {"symbol": "^DJI", "displayName": "Dow 30"},
    {"symbol": "QQQ", "displayName": "Nasdaq"},
    {"symbol": "IWM", "displayName": "Russell 2000"},
    {"symbol": "^VIX", "displayName": "VIX"},
    {"symbol": "GLD", "displayName": "Gold"},
    {"symbol": "BTC-USD", "displayName": "Bitcoin"},
]

@router.get("/market/ticker-bar")
def get_market_ticker_bar():
    """Returns live quotes and sparklines for top market benchmark indices (cached for 60s)."""
    cached = cache_service.get("market_ticker_bar")
    if cached is not None:
        return cached

    results = []
    for item in TICKER_BAR_ITEMS:
        sym = item["symbol"]
        name = item["displayName"]
        try:
            quote = asset_manager.get_latest_price(sym) or {}
            price = quote.get("price") or 0.0
            change = quote.get("change") or 0.0
            change_pct = quote.get("change_percent") or 0.0

            # Approximate 5-point sparkline for visual rendering
            base = price - change if price else 100.0
            sparkline = [
                round(base, 2),
                round(base + (change * 0.25), 2),
                round(base + (change * 0.6), 2),
                round(base + (change * 0.85), 2),
                round(price, 2)
            ]

            results.append({
                "symbol": sym,
                "displayName": name,
                "price": round(price, 2),
                "change": round(change, 2),
                "changePercent": round(change_pct, 2),
                "sparkline": sparkline
            })
        except Exception:
            continue

    if results:
        cache_service.set("market_ticker_bar", results, ttl_seconds=60)
    return results


class ConfigureKeyRequest(BaseModel):
    api_key: str

@router.post("/news/configure-key")
def configure_news_key(req: ConfigureKeyRequest):
    """Dynamically configures NEWSDATA_API_KEY from the UI and updates backend .env."""
    import os
    key = req.api_key.strip()
    if len(key) < 5 or " " in key:
        raise HTTPException(status_code=400, detail="Invalid API key format provided.")

    os.environ["NEWSDATA_API_KEY"] = key

    # Persist into backend/.env file
    backend_dir = os.path.dirname(os.path.dirname(os.path.dirname(__file__)))
    env_path = os.path.join(backend_dir, ".env")
    try:
        lines = []
        replaced = False
        if os.path.exists(env_path):
            with open(env_path, "r", encoding="utf-8") as f:
                lines = f.readlines()
            new_lines = []
            for line in lines:
                if line.startswith("NEWSDATA_API_KEY="):
                    new_lines.append(f"NEWSDATA_API_KEY={key}\n")
                    replaced = True
                else:
                    new_lines.append(line)
            lines = new_lines

        if not replaced:
            lines.append(f"NEWSDATA_API_KEY={key}\n")

        with open(env_path, "w", encoding="utf-8") as f:
            f.writelines(lines)
    except Exception as e:
        print(f"Warning: could not write to .env file: {e}")

    return {
        "status": "success",
        "message": "NewsData.io API key activated successfully! Live news can now be retrieved."
    }


