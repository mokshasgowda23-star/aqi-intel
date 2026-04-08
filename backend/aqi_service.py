"""
backend/aqi_service.py
----------------------
Core AQI data service.
- Fetches real-time AQI from WAQI API (aqicn.org)
- Falls back to realistic mock data when offline or no API key
- Provides zone/neighborhood heatmap data for cities
"""

import os
import json
import requests
from pathlib import Path
from utils.aqi_calculator import get_category, aqi_to_emoji
from utils.mock_data import get_city_aqi, get_zone_aqi, get_indoor_venues

WAQI_BASE = "https://api.waqi.info"
DATA_DIR = Path(__file__).parent.parent / "data"


def _load_cities() -> dict:
    cities_path = DATA_DIR / "cities.json"

    if not cities_path.exists():
        raise FileNotFoundError(
            f"\n\n  cities.json not found at: {cities_path}\n"
            "  Make sure the data/ folder is present in your project root.\n"
        )

    with open(cities_path, encoding="utf-8") as f:
        raw = f.read().strip()

    if not raw:
        raise ValueError(
            "\n\n  data/cities.json is empty.\n"
            "  Please re-copy the file from the project.\n"
        )

    data = json.loads(raw)

    # Support both {"cities": [...]} and a bare list [...]
    if isinstance(data, list):
        cities_list = data
    elif isinstance(data, dict) and "cities" in data:
        cities_list = data["cities"]
    else:
        raise ValueError(
            f"\n\n  Unexpected cities.json format.\n"
            f"  Expected {{\"cities\": [...]}} but found keys: "
            f"{list(data.keys()) if isinstance(data, dict) else type(data)}\n"
        )

    return {c["id"]: c for c in cities_list}


CITIES = _load_cities()


def get_current_aqi(city_id: str) -> dict:
    """
    Get current AQI for a city.
    Tries WAQI API first, falls back to mock data.
    """
    token = os.getenv("WAQI_TOKEN")
    city = CITIES.get(city_id)

    if not city:
        return {"error": f"Unknown city: {city_id}"}

    if token:
        try:
            return _fetch_waqi_city(city, token)
        except Exception as e:
            print(f"[aqi_service] WAQI API failed: {e} — using mock data")

    return _mock_city_aqi(city)


def _fetch_waqi_city(city: dict, token: str) -> dict:
    """Fetch live AQI from WAQI API using city lat/lon."""
    lat, lon = city["lat"], city["lon"]
    url = f"{WAQI_BASE}/feed/geo:{lat};{lon}/?token={token}"
    resp = requests.get(url, timeout=5)
    resp.raise_for_status()
    data = resp.json()

    if data.get("status") != "ok":
        raise ValueError(f"WAQI API returned status: {data.get('status')}")

    d = data["data"]
    aqi = d.get("aqi", 0)
    category, color = get_category(aqi)

    return {
        "city_id": city["id"],
        "city_name": city["name"],
        "aqi": aqi,
        "category": category,
        "color": color,
        "emoji": aqi_to_emoji(aqi),
        "station": d.get("city", {}).get("name", city["name"]),
        "pollutants": {
            "pm25": d.get("iaqi", {}).get("pm25", {}).get("v"),
            "pm10": d.get("iaqi", {}).get("pm10", {}).get("v"),
            "no2":  d.get("iaqi", {}).get("no2",  {}).get("v"),
            "so2":  d.get("iaqi", {}).get("so2",  {}).get("v"),
            "o3":   d.get("iaqi", {}).get("o3",   {}).get("v"),
            "co":   d.get("iaqi", {}).get("co",   {}).get("v"),
        },
        "updated_at": d.get("time", {}).get("s"),
        "source": "live",
    }


def _mock_city_aqi(city: dict) -> dict:
    """Generate realistic mock AQI for a city."""
    aqi = get_city_aqi(city["id"])
    category, color = get_category(aqi)
    return {
        "city_id": city["id"],
        "city_name": city["name"],
        "aqi": aqi,
        "category": category,
        "color": color,
        "emoji": aqi_to_emoji(aqi),
        "station": f"{city['name']} Central",
        "pollutants": {
            "pm25": round(aqi * 0.4 + 10, 1),
            "pm10": round(aqi * 0.7 + 20, 1),
            "no2":  round(aqi * 0.2 + 5, 1),
            "so2":  round(aqi * 0.1 + 3, 1),
            "o3":   round(aqi * 0.15 + 8, 1),
            "co":   round(aqi * 0.005, 2),
        },
        "updated_at": "Just now",
        "source": "demo",
    }


def get_zone_heatmap(city_id: str) -> dict:
    """
    Get AQI for all zones/neighborhoods in a city.
    Returns data suitable for rendering a heatmap.
    """
    city = CITIES.get(city_id)
    if not city:
        return {"error": f"Unknown city: {city_id}"}

    token = os.getenv("WAQI_TOKEN")
    zones = []

    for zone in city.get("zones", []):
        if token:
            try:
                aqi = _fetch_waqi_zone(zone, token)
            except Exception:
                aqi = get_zone_aqi(city_id, zone["type"])
        else:
            aqi = get_zone_aqi(city_id, zone["type"])

        category, color = get_category(aqi)
        zones.append({
            **zone,
            "aqi": aqi,
            "category": category,
            "color": color,
            "emoji": aqi_to_emoji(aqi),
        })

    zones.sort(key=lambda z: z["aqi"], reverse=True)

    return {
        "city_id": city_id,
        "city_name": city["name"],
        "city_lat": city["lat"],
        "city_lon": city["lon"],
        "zones": zones,
        "cleanest_zone": zones[-1]["name"] if zones else None,
        "worst_zone": zones[0]["name"] if zones else None,
    }


def _fetch_waqi_zone(zone: dict, token: str) -> int:
    """Fetch AQI for a specific zone coordinate."""
    url = f"{WAQI_BASE}/feed/geo:{zone['lat']};{zone['lon']}/?token={token}"
    resp = requests.get(url, timeout=5)
    data = resp.json()
    if data.get("status") == "ok":
        return data["data"].get("aqi", 100)
    raise ValueError("No data")


def get_all_cities_summary() -> list[dict]:
    """Get a summary AQI for all supported cities."""
    result = []
    for city_id, city in CITIES.items():
        aqi = get_city_aqi(city_id)
        category, color = get_category(aqi)
        result.append({
            "city_id": city_id,
            "city_name": city["name"],
            "aqi": aqi,
            "category": category,
            "color": color,
            "emoji": aqi_to_emoji(aqi),
            "lat": city["lat"],
            "lon": city["lon"],
        })
    return sorted(result, key=lambda x: x["aqi"], reverse=True)


def get_indoor_suggestions(city_id: str) -> list[dict]:
    """Return indoor venue suggestions for when AQI is bad."""
    return get_indoor_venues(city_id)