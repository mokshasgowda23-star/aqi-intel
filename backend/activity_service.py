"""
backend/activity_service.py
---------------------------
Outdoor activity intelligence layer.
Answers: "Is it a good day to run / cycle / walk the dog?"
Combines AQI + weather for activity-specific recommendations.
"""

import json
from pathlib import Path
from utils.aqi_calculator import is_safe_for_activity, get_category
from utils.weather_mapper import get_daily_brief

DATA_DIR = Path(__file__).parent.parent / "data"


def _load_thresholds() -> dict:
    with open(DATA_DIR / "thresholds.json", encoding="utf-8") as f:
        return json.load(f)


THRESHOLDS = _load_thresholds()

ACTIVITIES = list(THRESHOLDS.get("activities", {}).keys())


def get_activity_report(aqi: int, weather: dict) -> dict:
    """
    Full activity intelligence report combining AQI + weather.

    Returns:
    - Per-activity safety assessment
    - Indoor alternative suggestions
    - Overall outdoor safety verdict
    - A daily brief
    """
    activities_report = {}

    for activity_id, activity_data in THRESHOLDS["activities"].items():
        safety = is_safe_for_activity(aqi, activity_id, THRESHOLDS)
        activities_report[activity_id] = {
            "id": activity_id,
            "label": activity_data["label"],
            "icon": activity_data["icon"],
            "max_safe": activity_data["max_aqi_safe"],
            "max_caution": activity_data["max_aqi_caution"],
            **safety,
        }

    # Weather modifiers
    temp = weather.get("temp_c", 28)
    humidity = weather.get("humidity", 50)
    wind = weather.get("wind_kph", 10)
    condition = weather.get("condition", "clear")

    weather_notes = _weather_activity_notes(temp, humidity, wind, condition)

    # Overall verdict
    safe_count = sum(1 for a in activities_report.values() if a["safe"])
    total = len(activities_report)

    if safe_count == total:
        overall = {"verdict": "great", "label": "Great day to be outside! 🌿", "color": "#00b050"}
    elif safe_count >= total // 2:
        overall = {"verdict": "ok", "label": "Okay for some activities ⚠️", "color": "#ffbf00"}
    else:
        overall = {"verdict": "poor", "label": "Stay indoors today 🏠", "color": "#cc0000"}

    brief = get_daily_brief(aqi, weather)

    return {
        "aqi": aqi,
        "activities": activities_report,
        "weather_notes": weather_notes,
        "overall": overall,
        "brief": brief,
        "indoor_alternatives": _indoor_activity_suggestions(aqi),
    }


def _weather_activity_notes(temp: float, humidity: float,
                              wind: float, condition: str) -> list[str]:
    notes = []
    if temp > 38:
        notes.append("🌡️ Heat advisory: avoid intense outdoor activity above 38°C")
    if humidity > 80:
        notes.append("💧 High humidity makes exertion feel harder — hydrate extra")
    if wind > 25:
        notes.append("💨 Strong winds today — good for clearing air, but tough for cycling")
    if condition in ("rainy", "thunderstorm"):
        notes.append("🌧️ Rain expected — outdoor plans may need to shift indoors")
    if condition in ("foggy", "hazy", "smog"):
        notes.append("🌫️ Haze/fog traps pollutants — AQI near roads may be worse than readings")
    if temp < 12:
        notes.append("🧊 Cold air can irritate airways — warm up indoors before going out")
    return notes


def _indoor_activity_suggestions(aqi: int) -> list[dict]:
    """Suggest indoor alternatives based on AQI severity."""
    if aqi <= 100:
        return []  # No need — go outside!

    suggestions = [
        {"activity": "Indoor gym workout", "icon": "🏋️", "why": "Climate-controlled, clean air"},
        {"activity": "Yoga / stretching at home", "icon": "🧘", "why": "Low intensity, zero pollution exposure"},
        {"activity": "Swimming (indoor pool)", "icon": "🏊", "why": "Water filters surrounding air, great cardio"},
        {"activity": "Treadmill run at gym", "icon": "🏃", "why": "Same effort, none of the smog"},
        {"activity": "Badminton / squash court", "icon": "🏸", "why": "Enclosed courts with ventilation"},
        {"activity": "Dance class / Zumba", "icon": "💃", "why": "Fun cardio without going outside"},
    ]

    if aqi > 300:
        # Very severe — add calmer suggestions
        suggestions.append({"activity": "Meditation", "icon": "🧘", "why": "Rest your lungs, breathe slowly"})
        suggestions.append({"activity": "Board games / indoor games", "icon": "🎲", "why": "Keep kids active indoors"})

    return suggestions[:4]  # Top 4 suggestions