"""
utils/mock_data.py
------------------
Realistic mock data for development and demo purposes.
Used when API keys are not set or when running offline.
All AQI values match typical Indian city readings.
"""

import random
import json
from datetime import datetime, timedelta
from datetime import timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))

# Typical AQI ranges per city (based on real seasonal averages)
CITY_AQI_PROFILES = {
    "delhi":     {"base": 185, "variance": 80, "morning_spike": 40, "evening_spike": 50},
    "mumbai":    {"base": 120, "variance": 50, "morning_spike": 30, "evening_spike": 40},
    "bengaluru": {"base": 85,  "variance": 40, "morning_spike": 20, "evening_spike": 30},
    "kolkata":   {"base": 145, "variance": 60, "morning_spike": 35, "evening_spike": 45},
    "hyderabad": {"base": 95,  "variance": 45, "morning_spike": 25, "evening_spike": 35},
    "chennai":   {"base": 90,  "variance": 40, "morning_spike": 20, "evening_spike": 30},
    "pune":      {"base": 100, "variance": 45, "morning_spike": 25, "evening_spike": 35},
    "ahmedabad": {"base": 130, "variance": 55, "morning_spike": 30, "evening_spike": 40},
}

ZONE_TYPE_MODIFIERS = {
    "industrial": 1.4,
    "transport":  1.3,
    "commercial": 1.1,
    "residential": 1.0,
    "tech":        0.95,
    "green":       0.7,
}

WEATHER_TEMPLATES = [
    {"condition": "hazy",   "temp_c": 32, "humidity": 62, "wind_kph": 8,  "uv_index": 5},
    {"condition": "clear",  "temp_c": 29, "humidity": 50, "wind_kph": 14, "uv_index": 8},
    {"condition": "cloudy", "temp_c": 27, "humidity": 70, "wind_kph": 10, "uv_index": 3},
    {"condition": "foggy",  "temp_c": 22, "humidity": 85, "wind_kph": 4,  "uv_index": 2},
    {"condition": "sunny",  "temp_c": 35, "humidity": 40, "wind_kph": 18, "uv_index": 10},
]


def get_city_aqi(city_id: str, hour: int = None) -> int:
    """Get a realistic AQI for a city at a given hour (0-23)."""
    if hour is None:
        hour = datetime.now(IST).hour

    profile = CITY_AQI_PROFILES.get(city_id, {"base": 120, "variance": 50,
                                               "morning_spike": 30, "evening_spike": 40})
    base = profile["base"]
    variance = profile["variance"]

    # AQI pattern: spikes at 7–9am (traffic) and 6–9pm (traffic + cooking)
    hour_multiplier = 1.0
    if 6 <= hour <= 9:
        hour_multiplier = 1 + (profile["morning_spike"] / base)
    elif 18 <= hour <= 21:
        hour_multiplier = 1 + (profile["evening_spike"] / base)
    elif 2 <= hour <= 5:
        hour_multiplier = 0.75  # Cleanest hours

    aqi = int(base * hour_multiplier + random.randint(-variance//2, variance//2))
    return max(10, min(500, aqi))


def get_zone_aqi(city_id: str, zone_type: str, hour: int = None) -> int:
    """Get AQI for a specific zone, modified by zone type."""
    city_aqi = get_city_aqi(city_id, hour)
    modifier = ZONE_TYPE_MODIFIERS.get(zone_type, 1.0)
    zone_aqi = int(city_aqi * modifier + random.randint(-15, 15))
    return max(10, min(500, zone_aqi))


def get_12h_forecast(city_id: str) -> list[dict]:
    """Generate a 12-hour AQI forecast from now."""
    now = datetime.now(IST)
    forecast = []

    for i in range(13):  # 0 to 12 hours ahead
        dt = now + timedelta(hours=i)
        aqi = get_city_aqi(city_id, dt.hour)
        # Add some randomness for realism
        if i > 0:
            aqi = aqi + random.randint(-20, 20)
            aqi = max(10, min(500, aqi))

        forecast.append({
            "hour": dt.strftime("%I %p"),
            "hour_24": dt.hour,
            "timestamp": dt.isoformat(),
            "aqi": aqi,
            "label": f"{i}h" if i > 0 else "Now",
        })

    return forecast


def get_best_time_outside(forecast: list[dict]) -> dict:
    """Find the best hour(s) to go outside based on forecast."""
    sorted_fc = sorted(forecast, key=lambda x: x["aqi"])
    best = sorted_fc[0]

    # Find consecutive windows of good AQI
    good_windows = [f for f in forecast if f["aqi"] <= 150]

    return {
        "best_hour": best["hour"],
        "best_aqi": best["aqi"],
        "good_windows": good_windows[:3] if good_windows else [],
        "recommendation": _window_recommendation(best["aqi"], best["hour"])
    }


def _window_recommendation(aqi: int, hour: str) -> str:
    if aqi <= 50:
        return f"🌿 {hour} looks great — air quality is excellent!"
    elif aqi <= 100:
        return f"😊 Best window is around {hour} — satisfactory air quality."
    elif aqi <= 200:
        return f"😐 {hour} is your least-bad option today. Keep it short."
    else:
        return f"😷 No great time today. If you must go out, {hour} is least polluted."


def get_weather(city_id: str) -> dict:
    """Return mock weather for a city."""
    template = random.choice(WEATHER_TEMPLATES)
    return {**template, "feels_like_c": template["temp_c"] + random.randint(-2, 4)}


def get_calendar_data(city_id: str, days: int = 30) -> list[dict]:
    """Generate a month of good/bad air day history."""
    data = []
    for i in range(days - 1, -1, -1):
        dt = datetime.now(IST) - timedelta(days=i)
        aqi = get_city_aqi(city_id, 12)  # Noon reading
        aqi = aqi + random.randint(-40, 40)
        aqi = max(10, min(500, aqi))

        from utils.aqi_calculator import get_category
        cat, color = get_category(aqi)

        data.append({
            "date": dt.strftime("%Y-%m-%d"),
            "day": dt.strftime("%d"),
            "month": dt.strftime("%b"),
            "weekday": dt.strftime("%a"),
            "aqi": aqi,
            "category": cat,
            "color": color,
            "good_day": aqi <= 100,
        })
    return data


def get_indoor_venues(city_id: str) -> list[dict]:
    """Mock indoor venue suggestions by city."""
    venues = {
        "delhi": [
            {"name": "Anytime Fitness Saket", "type": "gym", "icon": "🏋️", "area": "Saket", "rating": 4.3},
            {"name": "DLF Mall of India", "type": "mall", "icon": "🏬", "area": "Noida", "rating": 4.5},
            {"name": "India Habitat Centre", "type": "indoor_park", "icon": "🌿", "area": "Lodhi Road", "rating": 4.6},
            {"name": "Cult.fit Connaught Place", "type": "gym", "icon": "🏋️", "area": "CP", "rating": 4.4},
            {"name": "Select Citywalk", "type": "mall", "icon": "🏬", "area": "Saket", "rating": 4.4},
        ],
        "bengaluru": [
            {"name": "Cult.fit Koramangala", "type": "gym", "icon": "🏋️", "area": "Koramangala", "rating": 4.5},
            {"name": "Phoenix MarketCity", "type": "mall", "icon": "🏬", "area": "Whitefield", "rating": 4.4},
            {"name": "Lalbagh Botanical Garden (Glasshouse)", "type": "indoor_park", "icon": "🌿", "area": "Lalbagh", "rating": 4.7},
            {"name": "Gold's Gym Indiranagar", "type": "gym", "icon": "🏋️", "area": "Indiranagar", "rating": 4.2},
        ],
        "mumbai": [
            {"name": "Palladium Mall", "type": "mall", "icon": "🏬", "area": "Lower Parel", "rating": 4.6},
            {"name": "Cult.fit Bandra", "type": "gym", "icon": "🏋️", "area": "Bandra", "rating": 4.4},
            {"name": "Powai Lake Walkway (covered)", "type": "indoor_park", "icon": "🌿", "area": "Powai", "rating": 4.3},
            {"name": "Infiniti Mall Andheri", "type": "mall", "icon": "🏬", "area": "Andheri", "rating": 4.3},
        ],
    }
    return venues.get(city_id, [
        {"name": "Local Gym (search nearby)", "type": "gym", "icon": "🏋️", "area": "Your area", "rating": 4.0},
        {"name": "Nearest Mall", "type": "mall", "icon": "🏬", "area": "City center", "rating": 4.0},
    ])


def get_community_data(city_id: str) -> dict:
    """Mock community stats for a city."""
    profiles = {
        "delhi":     {"score": 54, "reporters": 1240, "masked_today": 8900},
        "bengaluru": {"score": 72, "reporters": 890,  "masked_today": 4200},
        "mumbai":    {"score": 61, "reporters": 1100, "masked_today": 6700},
        "kolkata":   {"score": 58, "reporters": 720,  "masked_today": 3900},
        "hyderabad": {"score": 68, "reporters": 650,  "masked_today": 3100},
        "chennai":   {"score": 70, "reporters": 580,  "masked_today": 2800},
        "pune":      {"score": 75, "reporters": 490,  "masked_today": 2400},
        "ahmedabad": {"score": 60, "reporters": 420,  "masked_today": 2100},
    }
    return profiles.get(city_id, {"score": 60, "reporters": 500, "masked_today": 2500})