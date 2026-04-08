"""
backend/daily_brief.py
-----------------------
"Here's how to live your day well given today's air."
The core product intelligence — not just health warnings, but life guidance.
Combines AQI + weather + user profile + time of day into one actionable brief.
"""

from datetime import datetime
from datetime import timezone, timedelta
from utils.weather_mapper import get_daily_brief, weather_condition_emoji
from utils.aqi_calculator import get_category, aqi_to_emoji

IST = timezone(timedelta(hours=5, minutes=30))


def get_full_brief(city_id: str, city_name: str, aqi: int,
                   weather: dict, user_profile: dict = None) -> dict:
    """
    Generate a rich daily brief combining all data sources.

    user_profile (optional):
    {
        "has_kids": bool,
        "has_pets": bool,
        "is_runner": bool,
        "is_cyclist": bool,
        "health_conditions": ["asthma", "heart"]
    }
    """
    now = datetime.now(IST)
    hour = now.hour
    greeting = _time_greeting(hour)
    category, color = get_category(aqi)
    brief = get_daily_brief(aqi, weather)

    # Build personalized checklist
    checklist = _build_checklist(aqi, weather, user_profile or {})

    # Restaurant / café angle
    food_suggestion = _food_suggestion(aqi, weather)

    # Commute advice
    commute = _commute_advice(aqi, hour)

    return {
        "city": city_name,
        "aqi": aqi,
        "category": category,
        "color": color,
        "emoji": aqi_to_emoji(aqi),
        "weather_emoji": weather_condition_emoji(weather.get("condition", "clear")),
        "temp_c": weather.get("temp_c", 28),
        "feels_like_c": weather.get("feels_like_c", weather.get("temp_c", 28)),
        "humidity": weather.get("humidity", None),
        "wind_kph": weather.get("wind_kph", None),
        "uv_index": weather.get("uv_index", None),
        "condition": weather.get("condition", "clear").title(),
        "greeting": greeting,
        "headline": brief["headline"],
        "clothing": brief["clothing"],
        "mask": brief["mask"],
        "sunscreen": brief["sunscreen"],
        "outdoor_timing": brief["outdoor_timing"],
        "indoor_air": brief["indoor_air"],
        "tips": brief["tips"],
        "checklist": checklist,
        "food_suggestion": food_suggestion,
        "commute": commute,
        "personalized_notes": _personalized_notes(aqi, user_profile or {}),
        "generated_at": now.strftime("%I:%M %p, %d %b %Y"),
    }


def _time_greeting(hour: int) -> str:
    if 5 <= hour < 12:
        return "Good morning"
    elif 12 <= hour < 17:
        return "Good afternoon"
    elif 17 <= hour < 21:
        return "Good evening"
    else:
        return "Good night"


def _build_checklist(aqi: int, weather: dict, profile: dict) -> list[dict]:
    """Build a personalized morning checklist."""
    items = []

    # Clothing
    temp = weather.get("temp_c", 28)
    if temp > 33:
        items.append({"item": "Light breathable clothes", "icon": "👕", "done": False})
    elif temp < 18:
        items.append({"item": "Jacket or warm layer", "icon": "🧥", "done": False})
    else:
        items.append({"item": "Comfortable clothes", "icon": "👕", "done": False})

    # Mask
    if aqi > 150:
        items.append({"item": "N95 mask", "icon": "😷", "done": False, "critical": True})
    elif aqi > 100:
        items.append({"item": "Surgical mask (recommended)", "icon": "😷", "done": False})

    # Umbrella
    if weather.get("condition", "").lower() in ("rainy", "drizzle", "thunderstorm"):
        items.append({"item": "Umbrella / rain jacket", "icon": "☂️", "done": False})

    # Sunscreen
    uv = weather.get("uv_index", 5)
    if uv >= 6:
        items.append({"item": "Sunscreen SPF 50+", "icon": "🧴", "done": False})

    # Water bottle
    if temp > 30 or weather.get("humidity", 50) > 70:
        items.append({"item": "Water bottle (hydrate!)", "icon": "💧", "done": False})

    # Air purifier reminder
    if aqi > 200:
        items.append({"item": "Turn on air purifier indoors", "icon": "💨", "done": False, "critical": True})

    # Kid-specific
    if profile.get("has_kids") and aqi > 150:
        items.append({"item": "Kids' masks packed for school", "icon": "🎒", "done": False, "critical": True})

    # Pet-specific
    if profile.get("has_pets") and aqi > 200:
        items.append({"item": "Shorten pet walk today", "icon": "🐕", "done": False})

    return items


def _food_suggestion(aqi: int, weather: dict) -> dict:
    condition = weather.get("condition", "clear").lower()
    temp = weather.get("temp_c", 28)

    if aqi > 200:
        return {
            "icon": "🍱",
            "suggestion": "Consider ordering in today — outdoor air is poor",
            "type": "delivery",
            "detail": "Apps like Swiggy / Zomato let you search indoor-only restaurants with dine-in on better days."
        }
    elif aqi > 150:
        return {
            "icon": "🏠",
            "suggestion": "Look for indoor-seating cafés if dining out",
            "type": "indoor_cafe",
            "detail": "Avoid open-air dhabbas or rooftop restaurants today. AC restaurants filter air."
        }
    elif temp > 35:
        return {
            "icon": "🥤",
            "suggestion": "Cold beverages and light meals — beat the heat",
            "type": "light_food",
            "detail": "Lassi, nimbu paani, chaach — keep hydrated in the heat."
        }
    else:
        return {
            "icon": "☀️",
            "suggestion": "Great day for outdoor dining or a café!",
            "type": "outdoor_ok",
            "detail": "Air quality is good — enjoy outdoor seating or a terrace café."
        }


def _commute_advice(aqi: int, hour: int) -> dict:
    peak_hours = (7 <= hour <= 10) or (17 <= hour <= 20)

    if aqi > 250:
        return {
            "icon": "🚗",
            "advice": "Use AC mode in car (recirculate air). Avoid 2-wheeler if possible.",
            "detail": "Riding on a 2-wheeler in severe AQI exposes you 4x more than being in a car.",
            "critical": True,
        }
    elif aqi > 150:
        return {
            "icon": "😷",
            "advice": "Wear an N95 if commuting by 2-wheeler or walking.",
            "detail": "Traffic junctions have 2–3x higher PM2.5 than open roads. Mask up at signals.",
            "critical": False,
        }
    elif peak_hours:
        return {
            "icon": "🕐",
            "advice": "Peak traffic hours — air near roads is worse than overall AQI suggests.",
            "detail": "If you can, shift commute 30 mins earlier or later to avoid the peak pollution window.",
            "critical": False,
        }
    else:
        return {
            "icon": "✅",
            "advice": "Good air for your commute today!",
            "detail": None,
            "critical": False,
        }


def _personalized_notes(aqi: int, profile: dict) -> list[str]:
    notes = []
    conditions = profile.get("health_conditions", [])

    if "asthma" in conditions and aqi > 100:
        notes.append("🫁 Asthma alert: Keep your inhaler accessible. Avoid outdoor exertion.")
    if "heart" in conditions and aqi > 150:
        notes.append("❤️ Heart condition: PM2.5 above 150 increases cardiac stress. Rest indoors.")
    if profile.get("is_runner") and aqi > 100:
        notes.append("🏃 Skip the outdoor run today — try treadmill or indoor cross-training.")
    if profile.get("is_cyclist") and aqi > 100:
        notes.append("🚴 High AQI day — consider stationary bike or rest day for cycling.")
    if profile.get("has_kids") and aqi > 200:
        notes.append("👧 Keep kids indoors. No outdoor recess at these AQI levels.")
    if profile.get("is_pregnant", False) and aqi > 100:
        notes.append("🤰 Pregnant women are more vulnerable to air pollution. Stay indoors when possible.")

    return notes