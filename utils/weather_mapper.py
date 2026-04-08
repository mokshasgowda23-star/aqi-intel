"""
utils/weather_mapper.py
-----------------------
Maps weather conditions + AQI to clothing, activity, and health recommendations.
This is the "daily life intelligence" layer — beyond just showing numbers.
"""

from utils.aqi_calculator import get_category


def get_daily_brief(aqi: int, weather: dict) -> dict:
    """
    Combine AQI + weather to produce a rich daily brief.

    weather = {
        "temp_c": 32,
        "humidity": 65,
        "wind_kph": 12,
        "condition": "hazy",   # clear, hazy, cloudy, rainy, foggy
        "uv_index": 7,
        "feels_like_c": 35
    }

    Returns a dict with clothing, mask, activity tips, and a one-liner summary.
    """
    category, color = get_category(aqi)
    temp = weather.get("temp_c", 28)
    humidity = weather.get("humidity", 50)
    wind = weather.get("wind_kph", 10)
    condition = weather.get("condition", "clear").lower()
    uv = weather.get("uv_index", 5)

    brief = {
        "aqi": aqi,
        "category": category,
        "color": color,
        "clothing": _clothing_advice(temp, humidity, condition),
        "mask": _mask_advice(aqi, condition),
        "sunscreen": _sunscreen_advice(uv),
        "outdoor_timing": _outdoor_timing(aqi, wind, condition),
        "headline": _headline(aqi, temp, condition),
        "tips": _tips(aqi, temp, humidity, wind, condition),
        "indoor_air": _indoor_air_advice(aqi, wind),
    }
    return brief


def _clothing_advice(temp: float, humidity: float, condition: str) -> str:
    advice = []

    if temp >= 35:
        advice.append("Wear light, breathable cotton or linen")
    elif temp >= 28:
        advice.append("Light clothes — it's warm out")
    elif temp >= 20:
        advice.append("Light layers work well today")
    elif temp >= 12:
        advice.append("Carry a light jacket")
    else:
        advice.append("Bundle up — it's cold")

    if humidity > 75:
        advice.append("sweat-wicking fabric recommended")
    if condition in ("rainy", "drizzle"):
        advice.append("carry an umbrella or rain jacket")

    return ", ".join(advice).capitalize() + "."


def _mask_advice(aqi: int, condition: str) -> dict:
    if aqi <= 100:
        return {"needed": False, "type": None, "message": "No mask needed today 🌿"}
    elif aqi <= 200:
        if condition in ("hazy", "foggy", "smog"):
            return {"needed": True, "type": "surgical", "message": "Surgical mask recommended due to haze"}
        return {"needed": False, "type": None, "message": "Mask optional for sensitive individuals"}
    elif aqi <= 300:
        return {"needed": True, "type": "N95", "message": "Carry an N95 — air quality is poor today 😷"}
    else:
        return {"needed": True, "type": "N95", "message": "N95 mandatory. Limit outdoor time. ☠️"}


def _sunscreen_advice(uv: int) -> str:
    if uv <= 2:
        return "Low UV — sunscreen optional"
    elif uv <= 5:
        return "Apply SPF 30+ if spending time outside"
    elif uv <= 7:
        return "Moderate-high UV — SPF 50+ recommended"
    elif uv <= 10:
        return "High UV — SPF 50+, hat, and sunglasses a must"
    else:
        return "Extreme UV — minimize sun exposure 11am–3pm"


def _outdoor_timing(aqi: int, wind: float, condition: str) -> str:
    """Suggest best timing to go outside."""
    if aqi <= 100:
        return "Any time is fine today!"
    elif aqi <= 200:
        if wind > 15:
            return "Wind helps — mid-morning or late afternoon are best"
        return "Early morning (6–8am) or evening after 6pm"
    elif aqi <= 300:
        return "If you must go out — very early morning (before 7am) is least bad"
    else:
        return "No good time to go outside today. Stay in."


def _headline(aqi: int, temp: float, condition: str) -> str:
    """One punchy sentence for the daily brief card."""
    if aqi <= 50:
        return f"Great air day! {int(temp)}°C and clean skies. Get outside."
    elif aqi <= 100:
        return f"Decent day. {int(temp)}°C, air's satisfactory — enjoy it."
    elif aqi <= 200:
        return f"Moderate air quality ({int(temp)}°C). Limit strenuous outdoor time."
    elif aqi <= 300:
        return f"Poor air today. Wear a mask if you step out ({int(temp)}°C outside)."
    elif aqi <= 400:
        return f"Very poor air. Stay indoors. Keep windows closed."
    else:
        return f"Severe pollution alert. Do not go outside. Air purifier on."


def _tips(aqi, temp, humidity, wind, condition) -> list[str]:
    tips = []

    # AQI-based tips
    if aqi > 150:
        tips.append("🌿 Run air purifier indoors if you have one")
    if aqi > 200:
        tips.append("🪟 Keep windows and doors closed")
        tips.append("😷 N95 mask before stepping out")
    if aqi > 300:
        tips.append("🧘 Do breathing exercises indoors, not outside")
        tips.append("🐕 Shorten pet walks — they breathe at ground level")

    # Weather-based tips
    if humidity > 80:
        tips.append("💧 Stay hydrated — high humidity can feel draining")
    if temp > 38:
        tips.append("☀️ Avoid direct sun 11am–3pm — heat + pollution is a double hit")
    if condition == "foggy":
        tips.append("🌫️ Fog traps pollutants — AQI near roads may be higher than readings")
    if wind > 20:
        tips.append("💨 Good wind today — it'll help clear the air naturally")

    return tips


def _indoor_air_advice(aqi: int, wind: float) -> str:
    if aqi <= 100:
        if wind > 10:
            return "Open windows — outdoor air is fresh and there's a good breeze"
        return "Feel free to open windows for ventilation"
    elif aqi <= 200:
        return "Partial ventilation OK — keep windows cracked, not wide open"
    else:
        return "Keep all windows shut. Use air purifier if available."


def weather_condition_emoji(condition: str) -> str:
    mapping = {
        "clear": "☀️",
        "sunny": "☀️",
        "partly cloudy": "⛅",
        "cloudy": "☁️",
        "overcast": "☁️",
        "hazy": "🌫️",
        "foggy": "🌫️",
        "smog": "🌫️",
        "drizzle": "🌦️",
        "rainy": "🌧️",
        "thunderstorm": "⛈️",
        "snow": "❄️",
        "windy": "💨",
    }
    return mapping.get(condition.lower(), "🌤️")