# -*- coding: utf-8 -*-
import os
from typing import Dict, Any, List, Optional

class ExplainableAI:
    """
    Explainable AI service adhering strictly to Addendum A10 and A11 rules:
    - Explains computed data and provides market context
    - Strictly forbids claiming news caused a price move or strategy result
    - No sentiment-based predictions or trading signals
    - Disclaims historical drawdown dates cannot be matched to free-plan news
    """

    def __init__(self):
        self.api_key = os.getenv("AI_API_KEY")
        self.provider = os.getenv("AI_PROVIDER", "gemini")

    def explain_backtest(self, autopsy: Dict[str, Any], metrics: Dict[str, Any]) -> str:
        """Provide deterministic algorithmic explanation for backtest metrics."""
        ret = metrics.get('total_return', 0) * 100
        lines = [
            "Quantitative Strategy Diagnostics:",
            f"- Net Strategy Return: {ret:+.2f}%"
        ]

        if autopsy.get('largest_drawdown_date'):
            lines.append(f"- Peak Drawdown Observed: {autopsy['largest_drawdown_date']}.")
            # Explicit A10 rule: free-plan news does not cover historical drawdown periods
            lines.append("  (Note: News for this historical drawdown period is not available with the current data plan).")

        if autopsy.get('reasons_good'):
            lines.append(f"- Positive Drivers: {', '.join(autopsy['reasons_good'])}")
        if autopsy.get('reasons_bad'):
            lines.append(f"- Risk Factors: {', '.join(autopsy['reasons_bad'])}")

        lines.append("")
        lines.append("Rule Compliance: Algorithmic explanation based exclusively on computed backtest metrics. No causal claims or future return predictions.")
        return "\n".join(lines)

    def contextualize_news(self, articles: List[Dict[str, Any]], asset_symbol: str) -> str:
        """
        Synthesizes recent news as context for research (A11).
        Never claims news caused a price move or strategy result.
        """
        if not articles:
            return "There is insufficient data to determine this."

        summary_lines = [
            f"Market Context for {asset_symbol} (Recent Headlines as Context Only):",
            "Notice: Coincidence in timing does not imply causation. News cannot be used to determine asset price movement."
        ]

        for i, art in enumerate(articles[:3], 1):
            title = art.get('title', 'Unknown Title')
            source = art.get('source_name', 'NewsData.io')
            pub_date = art.get('published_at', 'Recent')
            summary_lines.append(f"{i}. \"{title}\" - {source} ({pub_date})")

        summary_lines.append("")
        summary_lines.append("Disclaimer: News is context for research. It must never be presented as a trading signal or price prediction.")
        return "\n".join(summary_lines)

ai_explainer = ExplainableAI()
