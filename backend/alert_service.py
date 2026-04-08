"""
backend/alert_service.py
------------------------
Alert system for AQI threshold notifications.
- Users set personal AQI thresholds
- System checks current AQI against threshold
- Returns alert status + message
- In-memory store (replace with DB for production)
"""

from datetime import datetime
from datetime import timezone, timedelta
from utils.aqi_calculator import get_category, aqi_to_emoji

IST = timezone(timedelta(hours=5, minutes=30))

# In-memory user alert settings (replace with DB in production)
# Structure: { session_id: { city_id, threshold, notify_methods, created_at } }
_user_alerts: dict = {}


def set_alert(session_id: str, city_id: str, threshold: int,
              notify_methods: list[str] = None) -> dict:
    """
    Set a user's AQI alert threshold.

    threshold: AQI value that triggers the alert (e.g., 150)
    notify_methods: ["browser", "email"] — for future use
    """
    _user_alerts[session_id] = {
        "city_id": city_id,
        "threshold": threshold,
        "notify_methods": notify_methods or ["browser"],
        "created_at": datetime.now(IST).isoformat(),
        "triggered_count": 0,
    }
    return {
        "status": "set",
        "message": f"You'll be alerted when AQI in {city_id} crosses {threshold}",
        "threshold": threshold,
    }


def get_alert_status(session_id: str, current_aqi: int) -> dict:
    """
    Check if current AQI triggers the user's alert.
    Returns alert status + recommended action.
    """
    alert = _user_alerts.get(session_id)
    if not alert:
        return {"active": False, "message": "No alert configured"}

    threshold = alert["threshold"]
    triggered = current_aqi > threshold
    category, color = get_category(current_aqi)

    if triggered:
        _user_alerts[session_id]["triggered_count"] += 1
        return {
            "active": True,
            "triggered": True,
            "current_aqi": current_aqi,
            "threshold": threshold,
            "category": category,
            "color": color,
            "emoji": aqi_to_emoji(current_aqi),
            "message": _alert_message(current_aqi, threshold, category),
            "action": _alert_action(current_aqi),
        }

    return {
        "active": True,
        "triggered": False,
        "current_aqi": current_aqi,
        "threshold": threshold,
        "category": category,
        "color": color,
        "message": f"AQI is {current_aqi} — below your alert threshold of {threshold} ✅",
        "action": None,
    }


def _alert_message(aqi: int, threshold: int, category: str) -> str:
    overage = aqi - threshold
    return (
        f"🚨 AQI Alert! Current AQI is {aqi} ({category}) — "
        f"{overage} points above your threshold of {threshold}."
    )


def _alert_action(aqi: int) -> dict:
    if aqi > 300:
        return {
            "level": "critical",
            "text": "Do NOT go outside. Close all windows. Use air purifier.",
            "color": "#660000",
        }
    elif aqi > 200:
        return {
            "level": "high",
            "text": "Wear an N95 mask if you must go out. Limit outdoor time.",
            "color": "#cc0000",
        }
    elif aqi > 150:
        return {
            "level": "moderate",
            "text": "Mask recommended. Avoid jogging or cycling today.",
            "color": "#ff6600",
        }
    else:
        return {
            "level": "low",
            "text": "Air has crossed your threshold. Keep an eye on it.",
            "color": "#ffbf00",
        }


def get_all_alerts() -> list[dict]:
    """Return all configured alerts (admin view)."""
    return [
        {"session_id": sid, **alert}
        for sid, alert in _user_alerts.items()
    ]


def delete_alert(session_id: str) -> dict:
    if session_id in _user_alerts:
        del _user_alerts[session_id]
        return {"status": "deleted"}
    return {"status": "not_found"}


def get_smart_threshold_suggestion(city_id: str) -> dict:
    """
    Suggest a threshold based on city's typical AQI profile.
    """
    suggestions = {
        "delhi":     {"suggested": 150, "reason": "Delhi often crosses 150 — set lower for earlier warning"},
        "mumbai":    {"suggested": 120, "reason": "Mumbai's coastal air keeps it below 120 most days"},
        "bengaluru": {"suggested": 100, "reason": "Bengaluru stays cleaner — 100 is a good alert point"},
        "kolkata":   {"suggested": 130, "reason": "Kolkata's humidity affects readings — 130 is typical caution point"},
        "hyderabad": {"suggested": 110, "reason": "Hyderabad has relatively clean air; 110 is a good trigger"},
        "chennai":   {"suggested": 110, "reason": "Chennai stays moderate — 110 is a reasonable threshold"},
        "pune":      {"suggested": 100, "reason": "Pune's air is decent — 100 keeps you well ahead of trouble"},
        "ahmedabad": {"suggested": 140, "reason": "Ahmedabad can get dusty — 140 gives you a head start"},
    }
    return suggestions.get(city_id, {"suggested": 150, "reason": "150 is the WHO-recommended caution point"})