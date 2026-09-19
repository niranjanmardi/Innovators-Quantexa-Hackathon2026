# Security & Compliance Policy

## 1. Secrets & Credentials Management
- All API keys (`NEWSDATA_API_KEY`, `AI_API_KEY`, `MARKET_DATA_API_KEY`) are kept exclusively on the server in `.env`.
- No sensitive keys are committed to Git. `.gitignore` includes `.env` and local caches.
- No `VITE_` frontend environment variables are used for backend API secrets, preventing client-side leakages.

---

## 2. API Input Validation & Sanitization
- All backend REST endpoints use strongly typed **Pydantic models** (`pydantic.BaseModel`).
- Inputs are validated for:
  - Valid date ranges ($start < end$).
  - Allowlisted strategy identifiers.
  - Non-negative moving average and lookback parameters ($N \ge 2$).
  - Character limits on search and keyword queries ($< 100$ characters for NewsData.io queries).

---

## 3. Cross-Origin Resource Sharing (CORS)
- FastAPI CORS middleware is enabled. In production deployment, `allow_origins` must be restricted to verified host domains.

---

## 4. Client-Side Rendering & XSS Protection
- All article titles, descriptions, and metadata from external news APIs are rendered as plain text in React.
- `dangerouslySetInnerHTML` is strictly prohibited throughout the frontend.
- External publisher links enforce `target="_blank"` and `rel="noopener noreferrer"`.
- Images are strictly constrained to `https://` URLs with error fallbacks to prevent broken image layout shifts.

---

## 5. Financial Integrity & Non-Hallucination
- The AI Explainer module (`ai_explainer.py`) is constrained to explaining computed metrics.
- Hard guardrail: The AI never generates price predictions, buy/sell trading advice, or guarantees of future performance.
