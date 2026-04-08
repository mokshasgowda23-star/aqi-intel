"""
backend/city_search.py
-----------------------
Handles AQI lookup for ANY Indian city — not just the 8 preset ones.

Strategy (in order):
1. Check if it matches a preset city → return from aqi_service
2. Search WAQI API by city name  → returns live AQI
3. Look up lat/lon from india_cities.json → fetch by coordinates
4. Fall back to mock data based on city name hash

This lets users search for Hassan, Mandya, Tumkur, Ooty, Leh — anything.
"""

import os
import json
import hashlib
import requests
from pathlib import Path
from utils.aqi_calculator import get_category, aqi_to_emoji

DATA_DIR = Path(__file__).parent.parent / "data"
WAQI_BASE = "https://api.waqi.info"

# Load India cities list once
def _load_india_cities() -> list[dict]:
    p = DATA_DIR / "india_cities.json"
    if not p.exists():
        return []
    with open(p, encoding="utf-8") as f:
        return json.load(f)

INDIA_CITIES = _load_india_cities()

# Quick name → city lookup (lowercase)
_CITY_INDEX = {c["name"].lower(): c for c in INDIA_CITIES}
# Also index by first word for partials (e.g. "hassan" → Hassan)
_CITY_FIRST_WORD = {}
for c in INDIA_CITIES:
    first = c["name"].lower().split()[0]
    if first not in _CITY_FIRST_WORD:
        _CITY_FIRST_WORD[first] = c


def search_city_aqi(city_name: str) -> dict:
    """
    Get AQI for any Indian city by name.
    Returns the same shape as get_current_aqi().
    """
    token = os.getenv("WAQI_TOKEN")
    name_clean = city_name.strip()

    # 1. Try WAQI search by name (live data)
    if token:
        result = _waqi_search_by_name(name_clean, token)
        if result:
            return result

    # 2. Look up coordinates from our database, then fetch by geo
    city_info = _find_city_info(name_clean)
    if city_info:
        if token:
            result = _waqi_fetch_by_geo(city_info, token)
            if result:
                return result
        # No token or geo fetch failed → realistic mock
        return _mock_aqi(city_info)

    # 3. Total fallback — unknown city, generic mock
    return _unknown_city_mock(name_clean)


def autocomplete_cities(query: str, limit: int = 8) -> list[dict]:
    """
    Return city suggestions matching a partial query.
    Used for the search autocomplete dropdown.
    """
    q = query.lower().strip()
    if len(q) < 2:
        return []

    results = []
    seen = set()

    for city in INDIA_CITIES:
        name_lower = city["name"].lower()
        if name_lower.startswith(q) or q in name_lower:
            key = city["name"]
            if key not in seen:
                seen.add(key)
                results.append({
                    "name": city["name"],
                    "state": city["state"],
                    "lat": city["lat"],
                    "lon": city["lon"],
                    "display": f"{city['name']}, {city['state']}",
                })
            if len(results) >= limit:
                break

    return results


def get_all_india_cities() -> list[dict]:
    """Return the full list of cities for frontend use."""
    return [
        {"name": c["name"], "state": c["state"], "display": f"{c['name']}, {c['state']}"}
        for c in INDIA_CITIES
    ]


# ── Private helpers ──────────────────────────────────────────────────────────

def _waqi_search_by_name(name: str, token: str) -> dict | None:
    """Search WAQI API by city name string."""
    try:
        url = f"{WAQI_BASE}/search/?keyword={name}&token={token}"
        resp = requests.get(url, timeout=6)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "ok":
            return None

        stations = data.get("data", [])
        if not stations:
            return None

        # Pick the best match — prefer exact city name match
        best = None
        for s in stations:
            city_info = s.get("station", {})
            station_name = city_info.get("name", "").lower()
            if name.lower() in station_name or station_name.startswith(name.lower()):
                best = s
                break
        if not best:
            best = stations[0]  # Take first result

        aqi = best.get("aqi")
        if not aqi or aqi == "-":
            return None

        aqi = int(aqi)
        category, color = get_category(aqi)
        station_name = best.get("station", {}).get("name", name)

        return {
            "city_id": name.lower().replace(" ", "-"),
            "city_name": name.title(),
            "aqi": aqi,
            "category": category,
            "color": color,
            "emoji": aqi_to_emoji(aqi),
            "station": station_name,
            "pollutants": _extract_pollutants(best),
            "updated_at": best.get("station", {}).get("time", ""),
            "source": "live",
            "lat": best.get("station", {}).get("geo", [None, None])[0],
            "lon": best.get("station", {}).get("geo", [None, None])[1],
        }
    except Exception as e:
        print(f"[city_search] WAQI name search failed for '{name}': {e}")
        return None


def _waqi_fetch_by_geo(city_info: dict, token: str) -> dict | None:
    """Fetch AQI using lat/lon from our city database."""
    try:
        lat, lon = city_info["lat"], city_info["lon"]
        url = f"{WAQI_BASE}/feed/geo:{lat};{lon}/?token={token}"
        resp = requests.get(url, timeout=6)
        resp.raise_for_status()
        data = resp.json()

        if data.get("status") != "ok":
            return None

        d = data["data"]
        aqi = d.get("aqi", 0)
        if not aqi:
            return None

        category, color = get_category(aqi)
        return {
            "city_id": city_info["name"].lower().replace(" ", "-"),
            "city_name": city_info["name"],
            "aqi": aqi,
            "category": category,
            "color": color,
            "emoji": aqi_to_emoji(aqi),
            "station": d.get("city", {}).get("name", city_info["name"]),
            "pollutants": {
                "pm25": d.get("iaqi", {}).get("pm25", {}).get("v"),
                "pm10": d.get("iaqi", {}).get("pm10", {}).get("v"),
                "no2":  d.get("iaqi", {}).get("no2",  {}).get("v"),
                "so2":  d.get("iaqi", {}).get("so2",  {}).get("v"),
                "o3":   d.get("iaqi", {}).get("o3",   {}).get("v"),
                "co":   d.get("iaqi", {}).get("co",   {}).get("v"),
            },
            "updated_at": d.get("time", {}).get("s", ""),
            "source": "live",
            "lat": lat,
            "lon": lon,
            "state": city_info.get("state", ""),
        }
    except Exception as e:
        print(f"[city_search] WAQI geo fetch failed for '{city_info['name']}': {e}")
        return None


def _find_city_info(name: str) -> dict | None:
    """Look up city info from our database. Fuzzy match."""
    nl = name.lower().strip()
    # Exact match
    if nl in _CITY_INDEX:
        return _CITY_INDEX[nl]
    # Prefix match on first word
    first = nl.split()[0]
    if first in _CITY_FIRST_WORD:
        return _CITY_FIRST_WORD[first]
    # Substring scan
    for city in INDIA_CITIES:
        if nl in city["name"].lower():
            return city
    return None


def _mock_aqi(city_info: dict) -> dict:
    """
    Generate a realistic mock AQI for a known city.
    Uses city coordinates to seed the random number so the same
    city always gets a similar AQI range.
    """
    import random
    seed = int(abs(city_info["lat"] * 1000 + city_info["lon"] * 100)) % 10000
    rng = random.Random(seed)

    state = city_info.get("state", "")
    # States with generally better air
    clean_states = {"Kerala", "Goa", "Himachal Pradesh", "Uttarakhand",
                    "Sikkim", "Meghalaya", "Arunachal Pradesh", "Mizoram",
                    "Nagaland", "Manipur", "Tripura"}
    # States with generally worse air
    polluted_states = {"Delhi", "Uttar Pradesh", "Bihar", "Haryana",
                       "Jharkhand", "West Bengal", "Rajasthan"}

    if state in clean_states:
        base = rng.randint(30, 90)
    elif state in polluted_states:
        base = rng.randint(120, 260)
    else:
        base = rng.randint(60, 180)

    # Add current-hour variation
    from datetime import datetime, timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    hour = datetime.now(IST).hour
    if 6 <= hour <= 9 or 18 <= hour <= 21:
        base = int(base * 1.2)
    elif 2 <= hour <= 5:
        base = int(base * 0.75)

    aqi = max(10, min(500, base + rng.randint(-20, 20)))
    category, color = get_category(aqi)

    return {
        "city_id": city_info["name"].lower().replace(" ", "-"),
        "city_name": city_info["name"],
        "aqi": aqi,
        "category": category,
        "color": color,
        "emoji": aqi_to_emoji(aqi),
        "station": f"{city_info['name']} (estimated)",
        "pollutants": {
            "pm25": round(aqi * 0.4 + 10, 1),
            "pm10": round(aqi * 0.7 + 20, 1),
            "no2":  round(aqi * 0.2 + 5, 1),
            "so2":  round(aqi * 0.1 + 3, 1),
            "o3":   round(aqi * 0.15 + 8, 1),
            "co":   round(aqi * 0.005, 2),
        },
        "updated_at": "Estimated",
        "source": "estimated",
        "lat": city_info["lat"],
        "lon": city_info["lon"],
        "state": city_info.get("state", ""),
    }


def _unknown_city_mock(name: str) -> dict:
    """Fallback for a city not in our database at all."""
    import random
    seed = int(hashlib.md5(name.lower().encode()).hexdigest(), 16) % 10000
    aqi = random.Random(seed).randint(60, 180)
    category, color = get_category(aqi)
    return {
        "city_id": name.lower().replace(" ", "-"),
        "city_name": name.title(),
        "aqi": aqi,
        "category": category,
        "color": color,
        "emoji": aqi_to_emoji(aqi),
        "station": f"{name.title()} (estimated — no monitoring station data)",
        "pollutants": {
            "pm25": round(aqi * 0.4 + 10, 1),
            "pm10": round(aqi * 0.7 + 20, 1),
            "no2":  round(aqi * 0.2 + 5, 1),
        },
        "updated_at": "Estimated",
        "source": "estimated",
        "lat": None,
        "lon": None,
        "state": "India",
    }


def _extract_pollutants(station_data: dict) -> dict:
    """Extract pollutant values from WAQI station search result."""
    return {
        "pm25": station_data.get("iaqi", {}).get("pm25", {}).get("v") if isinstance(station_data.get("iaqi"), dict) else None,
        "pm10": station_data.get("iaqi", {}).get("pm10", {}).get("v") if isinstance(station_data.get("iaqi"), dict) else None,
        "no2":  station_data.get("iaqi", {}).get("no2",  {}).get("v") if isinstance(station_data.get("iaqi"), dict) else None,
        "so2":  station_data.get("iaqi", {}).get("so2",  {}).get("v") if isinstance(station_data.get("iaqi"), dict) else None,
        "o3":   station_data.get("iaqi", {}).get("o3",   {}).get("v") if isinstance(station_data.get("iaqi"), dict) else None,
        "co":   station_data.get("iaqi", {}).get("co",   {}).get("v") if isinstance(station_data.get("iaqi"), dict) else None,
    }