import os
from datetime import datetime, timezone
from app.services.cache import cache_service

class CreditBudget:
    """Tracks estimated daily NewsData.io credit usage and enforces the daily credit cap."""

    def __init__(self, cap: int = None):
        self._override_cap = cap

    @property
    def cap(self) -> int:
        if self._override_cap is not None:
            return self._override_cap
        return int(os.getenv("NEWS_DAILY_CREDIT_CAP", 180))


    def _get_credit_key(self) -> str:
        date_str = datetime.now(timezone.utc).strftime("%Y-%m-%d")
        return f"news_credits_{date_str}"

    def get_used_credits(self) -> int:
        key = self._get_credit_key()
        val = cache_service.get(key)
        return int(val) if val is not None else 0

    def increment(self, amount: int = 1) -> int:
        key = self._get_credit_key()
        current = self.get_used_credits()
        new_total = current + amount
        # Retain for 48 hours to cross day boundaries safely
        cache_service.set(key, new_total, ttl_seconds=172800)
        return new_total

    def is_capped(self) -> bool:
        return self.get_used_credits() >= self.cap

    def can_fetch(self, required_credits: int = 1) -> bool:
        return (self.get_used_credits() + required_credits) <= self.cap

    def get_remaining(self) -> int:
        return max(0, self.cap - self.get_used_credits())

    def get_status(self) -> dict:
        return {
            "estimated_credits_used_today": self.get_used_credits(),
            "credit_cap": self.cap,
            "credits_remaining": self.get_remaining(),
            "is_capped": self.is_capped()
        }

credit_budget = CreditBudget()
