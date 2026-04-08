"""
backend/forecast_service.py
---------------------------
12-hour AQI forecast engine.
- Fetches hourly forecast from OpenWeatherMap Air Pollution API
- Falls back to pattern-based mock forecasts
- Identifies the "best time to go outside" window
"""

import os
import requests
from datetime import datetime, timedelta, timezone
from utils.mock_data import get_12h_forecast, get_best_time_outside, get_weather
from utils.aqi_calculator import get_category, aqi_to_emoji

IST = timezone(timedelta(hours=5, minutes=30))
OWM_BASE = "https://api.openweathermap.org/data/2.5"


def get_forecast(city_id: str, lat: float, lon: float) -> dict:
    """
    Get 12-hour AQI forecast for a city.
    Returns hourly breakdown + best time recommendation.
    """
    api_key = os.getenv("OWM_API_KEY")

    if api_key:
        try:
            return _fetch_owm_forecast(city_id, lat, lon, api_key)
        except Exception as e:
            print(f"[forecast_service] OWM API failed: {e} — using mock")

    return _mock_forecast(city_id)


def _fetch_owm_forecast(city_id: str, lat: float, lon: float, api_key: str) -> dict:
    """Fetch air pollution forecast from OpenWeatherMap."""
    url = f"{OWM_BASE}/air_pollution/forecast"
    params = {"lat": lat, "lon": lon, "appid": api_key}
    resp = requests.get(url, params=params, timeout=8)
    resp.raise_for_status()
    data = resp.json()

    now = datetime.now(IST)
    cutoff = now + timedelta(hours=12)

    hourly = []
    for entry in data.get("list", []):
        dt = datetime.fromtimestamp(entry["dt"], tz=IST)
        if dt > cutoff:
            break

        owm_aqi = entry.get("main", {}).get("aqi", 2)
        aqi = _owm_to_naqi(owm_aqi, entry.get("components", {}))
        category, color = get_category(aqi)

        hourly.append({
            "hour":      dt.strftime("%I %p"),
            "hour_24":   dt.hour,
            "timestamp": dt.isoformat(),
            "aqi":       aqi,
            "category":  category,
            "color":     color,
            "emoji":     aqi_to_emoji(aqi),
            "label":     _relative_label(dt, now),
        })

    best = get_best_time_outside(hourly)
    return {
        "city_id":   city_id,
        "forecast":  hourly,
        "best_time": best,
        "source":    "live",
    }


def _owm_to_naqi(owm_aqi: int, components: dict) -> int:
    """Convert OWM EU AQI (1-5) to India NAQI (0-500) using PM2.5."""
    pm25 = components.get("pm2_5", 0)
    if pm25 <= 30:
        return int((pm25 / 30) * 50)
    elif pm25 <= 60:
        return int(50 + ((pm25 - 30) / 30) * 50)
    elif pm25 <= 90:
        return int(100 + ((pm25 - 60) / 30) * 100)
    elif pm25 <= 120:
        return int(200 + ((pm25 - 90) / 30) * 100)
    elif pm25 <= 250:
        return int(300 + ((pm25 - 120) / 130) * 100)
    else:
        return min(500, int(400 + ((pm25 - 250) / 250) * 100))


def _relative_label(dt: datetime, now: datetime) -> str:
    diff = int((dt - now).total_seconds() / 3600)
    if diff == 0:
        return "Now"
    elif diff == 1:
        return "1h"
    else:
        return f"{diff}h"


def _mock_forecast(city_id: str) -> dict:
    """Generate a realistic mock 12-hour forecast."""
    hourly_raw = get_12h_forecast(city_id)
    hourly = []

    for entry in hourly_raw:
        category, color = get_category(entry["aqi"])
        hourly.append({
            **entry,
            "category": category,
            "color":    color,
            "emoji":    aqi_to_emoji(entry["aqi"]),
        })

    best = get_best_time_outside(hourly_raw)

    return {
        "city_id":   city_id,
        "forecast":  hourly,
        "best_time": best,
        "source":    "demo",
    }


def get_weather_data(city_id: str, lat: float, lon: float) -> dict:
    """Fetch current weather. Falls back to mock."""
    api_key = os.getenv("OWM_API_KEY")

    if api_key:
        try:
            url = f"{OWM_BASE}/weather"
            params = {"lat": lat, "lon": lon, "appid": api_key, "units": "metric"}
            resp = requests.get(url, params=params, timeout=5)
            resp.raise_for_status()
            data = resp.json()
            return {
                "temp_c":      round(data["main"]["temp"], 1),
                "feels_like_c": round(data["main"]["feels_like"], 1),
                "humidity":    data["main"]["humidity"],
                "wind_kph":    round(data["wind"]["speed"] * 3.6, 1),
                "condition":   data["weather"][0]["description"],
                "uv_index":    6,
                "source":      "live",
            }
        except Exception as e:
            print(f"[forecast_service] Weather API failed: {e}")

    weather = get_weather(city_id)
    weather["source"] = "demo"
    return weather