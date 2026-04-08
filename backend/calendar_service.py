"""
backend/calendar_service.py
---------------------------
Air quality calendar service.
Tracks which days this week/month were "good air days".
Provides weekly and monthly summaries.
"""

from datetime import datetime, timedelta
from datetime import timezone, timedelta
from utils.mock_data import get_calendar_data
from utils.aqi_calculator import get_category

IST = timezone(timedelta(hours=5, minutes=30))


def get_monthly_calendar(city_id: str) -> dict:
    """
    Get the past 30 days of air quality data formatted for a calendar view.
    """
    days = get_calendar_data(city_id, days=30)

    good_days = [d for d in days if d["good_day"]]
    bad_days = [d for d in days if d["aqi"] > 200]
    worst_day = max(days, key=lambda d: d["aqi"])
    best_day = min(days, key=lambda d: d["aqi"])

    # Week-by-week breakdown
    weeks = _group_into_weeks(days)

    return {
        "city_id": city_id,
        "days": days,
        "weeks": weeks,
        "summary": {
            "total_days": len(days),
            "good_days": len(good_days),
            "bad_days": len(bad_days),
            "good_percent": round(len(good_days) / len(days) * 100),
            "best_day": best_day,
            "worst_day": worst_day,
            "current_streak": _calculate_streak(days),
        }
    }


def get_weekly_summary(city_id: str) -> dict:
    """Get this week's air quality summary."""
    days = get_calendar_data(city_id, days=7)

    avg_aqi = round(sum(d["aqi"] for d in days) / len(days))
    category, color = get_category(avg_aqi)
    good = [d for d in days if d["good_day"]]

    return {
        "city_id": city_id,
        "days": days,
        "average_aqi": avg_aqi,
        "category": category,
        "color": color,
        "good_days_count": len(good),
        "headline": _week_headline(len(good), avg_aqi),
    }


def _group_into_weeks(days: list[dict]) -> list[list[dict]]:
    """Group days into weeks (7-day chunks, newest last)."""
    weeks = []
    for i in range(0, len(days), 7):
        weeks.append(days[i:i+7])
    return weeks


def _calculate_streak(days: list[dict]) -> dict:
    """Calculate current streak of good air days (from today backwards)."""
    # days is sorted oldest→newest
    reversed_days = list(reversed(days))
    streak = 0
    for day in reversed_days:
        if day["good_day"]:
            streak += 1
        else:
            break

    return {
        "count": streak,
        "label": f"{streak} consecutive good air day{'s' if streak != 1 else ''}",
        "emoji": "🔥" if streak >= 3 else ("😊" if streak >= 1 else "😐"),
    }


def _week_headline(good_days: int, avg_aqi: int) -> str:
    if good_days == 7:
        return "🌟 Perfect week! All 7 days had good air quality."
    elif good_days >= 5:
        return f"😊 Good week overall — {good_days}/7 days with clean air."
    elif good_days >= 3:
        return f"😐 Mixed week — {good_days}/7 good days. Average AQI: {avg_aqi}."
    elif good_days >= 1:
        return f"😷 Tough week — only {good_days}/7 good air days."
    else:
        return f"🚨 Difficult week — no good air days. Average AQI: {avg_aqi}."


def get_best_days_analysis(city_id: str) -> dict:
    """Analyze which days of the week tend to have better air quality."""
    days = get_calendar_data(city_id, days=30)

    by_weekday: dict[str, list[int]] = {}
    for day in days:
        wd = day["weekday"]
        by_weekday.setdefault(wd, []).append(day["aqi"])

    weekday_avg = {
        wd: round(sum(aqis) / len(aqis))
        for wd, aqis in by_weekday.items()
    }

    best_weekday = min(weekday_avg, key=weekday_avg.get)
    worst_weekday = max(weekday_avg, key=weekday_avg.get)

    return {
        "weekday_averages": weekday_avg,
        "best_day_of_week": best_weekday,
        "worst_day_of_week": worst_weekday,
        "insight": f"📅 {best_weekday}s tend to have the cleanest air in {city_id.title()} (avg AQI: {weekday_avg[best_weekday]})"
    }