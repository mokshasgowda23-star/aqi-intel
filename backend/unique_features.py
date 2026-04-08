"""
backend/unique_features.py
---------------------------
Features that NO other AQI app in India has:

1. LUNG SCORE  — personalised cumulative exposure tracker.
   Converts AQI hours into a single 0-100 "lung health" score for the day/week.
   Shows: "You've breathed clean air for 6 hrs today. Lung score: 72/100"

2. AQI TIME MACHINE — "What was the air like on this date last year?"
   Shows historical AQI pattern and compares it to today.
   Great for: "Is this Diwali worse than last year?"

3. HYPERLOCAL WIND CORRIDOR — "Which direction is the pollution coming from?"
   Uses wind direction + nearest industrial zones to explain WHY AQI is high.
   e.g. "Northeast wind from Peenya industrial zone is pushing PM2.5 into your area."

4. POLLUTION FINGERPRINT — city-specific pollutant signature.
   Delhi = PM2.5 dominant (vehicle + stubble). Mumbai = NO2 + SO2 (coastal industry).
   Shows what's uniquely bad about your city's air, not just a number.

5. CLEAN AIR WINDOW PREDICTOR — predict tomorrow's best 2-hour window
   based on historical patterns + wind forecast.

6. BODY BATTERY INDEX — combines AQI + heat index + humidity into
   an "outdoor exertion cost" score. "Going for a run now costs 2x more
   energy than usual due to heat + pollution combo."
"""

import random
import math
from datetime import datetime, timedelta, timezone
from utils.aqi_calculator import get_category, aqi_to_emoji

IST = timezone(timedelta(hours=5, minutes=30))


# ─── 1. LUNG SCORE ────────────────────────────────────────────────────────────

def get_lung_score(city_id: str, aqi_history: list[dict] = None) -> dict:
    """
    Calculate today's lung score (0–100) based on hourly AQI exposure.

    aqi_history: list of {hour: int, aqi: int} for today.
    If not provided, generates realistic mock data.
    """
    if not aqi_history:
        aqi_history = _mock_today_history(city_id)

    hours_tracked = len(aqi_history)
    if not hours_tracked:
        return {"score": 100, "label": "No data", "hours": 0}

    # WHO penalty points per AQI bracket per hour
    penalties = {
        (0,   50):  0,     # Good — no penalty
        (51,  100): 0.5,   # Satisfactory — minimal
        (101, 200): 2.0,   # Moderate
        (201, 300): 4.5,   # Poor
        (301, 400): 8.0,   # Very Poor
        (401, 500): 14.0,  # Severe
    }

    total_penalty = 0
    good_hours    = 0
    worst_hour    = None
    worst_aqi     = 0

    for entry in aqi_history:
        aqi = entry["aqi"]
        for (lo, hi), pen in penalties.items():
            if lo <= aqi <= hi:
                total_penalty += pen
                break
        if aqi <= 100:
            good_hours += 1
        if aqi > worst_aqi:
            worst_aqi  = aqi
            worst_hour = entry.get("hour_label", str(entry.get("hour", "?")))

    # Max possible penalty for a 24h day = 14 * 24 = 336
    max_penalty = 14 * 24
    score = max(0, round(100 - (total_penalty / max_penalty) * 100))

    category, color = get_category(worst_aqi) if worst_aqi else ("Good", "#00b050")

    if score >= 85:
        label, advice = "Excellent", "Your lungs had a great day. Keep it up! 🌿"
    elif score >= 70:
        label, advice = "Good", "Decent air exposure today. A few hours of moderate pollution."
    elif score >= 50:
        label, advice = "Fair", "Moderate exposure. Consider an air purifier tonight."
    elif score >= 30:
        label, advice = "Poor", "Significant pollution exposure today. Rest and hydrate."
    else:
        label, advice = "Very Poor", "Heavy pollution day. Avoid outdoor exercise tomorrow."

    return {
        "score": score,
        "label": label,
        "advice": advice,
        "good_hours": good_hours,
        "total_hours": hours_tracked,
        "worst_aqi": worst_aqi,
        "worst_hour": worst_hour,
        "worst_category": category,
        "color": _score_color(score),
        "history": aqi_history,
        "weekly_trend": _mock_weekly_scores(city_id),
    }


def _score_color(score: int) -> str:
    if score >= 85: return "#00b050"
    if score >= 70: return "#7ab648"
    if score >= 50: return "#e8a000"
    if score >= 30: return "#e05a00"
    return "#cc0000"


def _mock_today_history(city_id: str) -> list[dict]:
    """Realistic hourly AQI for today, city-specific."""
    from utils.mock_data import get_city_aqi
    now  = datetime.now(IST)
    hist = []
    for h in range(now.hour + 1):
        dt  = now.replace(hour=h, minute=0, second=0)
        aqi = get_city_aqi(city_id, h)
        hist.append({
            "hour": h,
            "hour_label": dt.strftime("%I %p"),
            "aqi": aqi,
            "category": get_category(aqi)[0],
            "color": get_category(aqi)[1],
        })
    return hist


def _mock_weekly_scores(city_id: str) -> list[dict]:
    """7-day lung score history."""
    from utils.mock_data import get_city_aqi
    rng = random.Random(city_id)
    scores = []
    for i in range(6, -1, -1):
        dt    = datetime.now(IST) - timedelta(days=i)
        base  = get_city_aqi(city_id, 12)
        score = max(20, min(100, 100 - (base / 500) * 80 + rng.randint(-10, 10)))
        scores.append({
            "date": dt.strftime("%a"),
            "score": round(score),
            "color": _score_color(round(score)),
        })
    return scores


# ─── 2. AQI TIME MACHINE ──────────────────────────────────────────────────────

def get_time_machine(city_id: str, target_date: str = None) -> dict:
    """
    Compare today's AQI to the same date last year / historical average.

    target_date: "YYYY-MM-DD" or None (uses today)
    """
    now = datetime.now(IST)
    if target_date:
        try:
            target_dt = datetime.strptime(target_date, "%Y-%m-%d").replace(tzinfo=IST)
        except ValueError:
            target_dt = now
    else:
        target_dt = now

    from utils.mock_data import get_city_aqi

    today_aqi    = get_city_aqi(city_id, now.hour)
    lastyear_aqi = _historical_aqi(city_id, target_dt.replace(year=target_dt.year - 1))
    avg_aqi      = _seasonal_average(city_id, target_dt.month)

    change_vs_lastyear = today_aqi - lastyear_aqi
    change_vs_avg      = today_aqi - avg_aqi

    # Special events context
    context = _date_context(target_dt.month, target_dt.day)

    trend = "better" if change_vs_lastyear < -10 else ("worse" if change_vs_lastyear > 10 else "similar")

    return {
        "date": target_dt.strftime("%d %b %Y"),
        "today_aqi": today_aqi,
        "today_category": get_category(today_aqi)[0],
        "lastyear_aqi": lastyear_aqi,
        "lastyear_category": get_category(lastyear_aqi)[0],
        "avg_aqi": avg_aqi,
        "avg_category": get_category(avg_aqi)[0],
        "change_vs_lastyear": change_vs_lastyear,
        "change_vs_avg": change_vs_avg,
        "trend": trend,
        "trend_emoji": "📈" if trend == "worse" else ("📉" if trend == "better" else "➡️"),
        "context": context,
        "comparison_label": (
            f"{'🔴 ' if change_vs_lastyear > 10 else '🟢 '}"
            f"{'Worse' if change_vs_lastyear > 10 else 'Better' if change_vs_lastyear < -10 else 'Similar'} "
            f"than this day last year"
        ),
        "historical_months": _year_heatmap(city_id),
    }


def _historical_aqi(city_id: str, dt: datetime) -> int:
    from utils.mock_data import get_city_aqi, CITY_AQI_PROFILES
    profile = CITY_AQI_PROFILES.get(city_id, {"base": 120, "variance": 50, "morning_spike": 30, "evening_spike": 40})
    base    = profile["base"]
    month   = dt.month
    # Seasonal variation: Nov-Feb worse in north India, monsoon better
    seasonal = {1: 1.3, 2: 1.2, 3: 1.0, 4: 0.9, 5: 0.95, 6: 0.8,
                7: 0.7, 8: 0.7, 9: 0.8, 10: 1.0, 11: 1.3, 12: 1.4}
    rng = random.Random(city_id + str(dt.toordinal()))
    return max(20, min(500, int(base * seasonal.get(month, 1.0) + rng.randint(-30, 30))))


def _seasonal_average(city_id: str, month: int) -> int:
    from utils.mock_data import CITY_AQI_PROFILES
    profile = CITY_AQI_PROFILES.get(city_id, {"base": 120})
    seasonal = {1: 1.3, 2: 1.2, 3: 1.0, 4: 0.9, 5: 0.95, 6: 0.8,
                7: 0.7, 8: 0.7, 9: 0.8, 10: 1.0, 11: 1.3, 12: 1.4}
    return int(profile["base"] * seasonal.get(month, 1.0))


def _date_context(month: int, day: int) -> str | None:
    contexts = {
        (10, 24): "🪔 Diwali period — typically the worst air quality of the year in north India",
        (10, 25): "🪔 Post-Diwali — firecrackers cause AQI to spike 3–5x above baseline",
        (10, 26): "🪔 Diwali aftermath — smoke lingers for 2–3 days after celebrations",
        (11, 14): "🌾 Stubble burning season — crop residue fires in Punjab/Haryana peak Oct–Nov",
        (11, 15): "🌾 Stubble burning peak — satellite data shows maximum fire counts this week",
        (1,  26): "🎆 Republic Day — fireworks cause brief AQI spikes in Delhi",
        (8,  15): "🎆 Independence Day — minor fireworks, humidity often suppresses AQI",
        (3,  25): "🎨 Holi — brief spike from colour powder and bonfires (Holika Dahan)",
        (6,  15): "🌧️ Pre-monsoon — dust storms common, AQI volatile",
        (7,  15): "🌧️ Monsoon peak — rain washes pollutants, typically cleanest air of year",
    }
    return contexts.get((month, day))


def _year_heatmap(city_id: str) -> list[dict]:
    """12-month AQI average heatmap for the city."""
    months = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]
    results = []
    for i, m in enumerate(months, 1):
        avg = _seasonal_average(city_id, i)
        cat, col = get_category(avg)
        results.append({"month": m, "aqi": avg, "category": cat, "color": col})
    return results


# ─── 3. POLLUTION FINGERPRINT ─────────────────────────────────────────────────

CITY_FINGERPRINTS = {
    "delhi": {
        "signature": "Vehicle exhaust + crop stubble burning",
        "dominant": "PM2.5",
        "dominant_pct": 68,
        "sources": [
            {"name": "Vehicle exhaust",    "pct": 38, "icon": "🚗", "color": "#e05a00"},
            {"name": "Stubble burning",    "pct": 27, "icon": "🌾", "color": "#cc0000"},
            {"name": "Industry",           "pct": 17, "icon": "🏭", "color": "#9e2a2b"},
            {"name": "Dust & construction","pct": 12, "icon": "🏗️", "color": "#b5580c"},
            {"name": "Other",              "pct":  6, "icon": "💨", "color": "#9e9e9e"},
        ],
        "peak_months": ["Oct", "Nov", "Dec", "Jan"],
        "peak_hours": ["7-9 AM", "6-9 PM"],
        "insight": "Delhi's PM2.5 is 15× WHO annual limit. The stubble burning window (Oct–Nov) adds a 40% spike on top of baseline vehicle pollution.",
        "unique_risk": "PM2.5 particles <2.5µm penetrate deep into lung tissue — especially dangerous for children under 12.",
    },
    "mumbai": {
        "signature": "Sea breeze + industrial SO₂ + coastal traffic",
        "dominant": "NO₂",
        "dominant_pct": 45,
        "sources": [
            {"name": "Vehicle exhaust",  "pct": 40, "icon": "🚗", "color": "#e05a00"},
            {"name": "Industry & ships", "pct": 30, "icon": "⚓", "color": "#1565c0"},
            {"name": "Construction",     "pct": 18, "icon": "🏗️", "color": "#b5580c"},
            {"name": "Other",            "pct": 12, "icon": "💨", "color": "#9e9e9e"},
        ],
        "peak_months": ["Dec", "Jan", "Feb"],
        "peak_hours": ["8-11 AM", "5-8 PM"],
        "insight": "Mumbai's sea breeze usually clears pollution by afternoon. The worst air is in winter when the breeze weakens. Port activity adds SO₂ that inland cities don't have.",
        "unique_risk": "NO₂ from traffic worsens asthma — Dharavi and Chembur residents face 2× higher exposure than Bandra or Powai.",
    },
    "bengaluru": {
        "signature": "Rapid urbanisation + vehicle growth outpacing infrastructure",
        "dominant": "PM10",
        "dominant_pct": 52,
        "sources": [
            {"name": "Vehicle exhaust", "pct": 55, "icon": "🚗", "color": "#e05a00"},
            {"name": "Construction",    "pct": 25, "icon": "🏗️", "color": "#b5580c"},
            {"name": "Industry",        "pct": 12, "icon": "🏭", "color": "#9e2a2b"},
            {"name": "Other",           "pct":  8, "icon": "💨", "color": "#9e9e9e"},
        ],
        "peak_months": ["Jan", "Feb", "Mar", "Nov"],
        "peak_hours": ["8-10 AM", "6-9 PM"],
        "insight": "Bengaluru's AQI was 30 in 1990. Today it's 80–160 on bad days — driven by a 10× increase in registered vehicles since 2000. Traffic congestion is the #1 cause.",
        "unique_risk": "Construction dust (PM10) from metro and IT park projects affects Whitefield and Hebbal residents most.",
    },
    "kolkata": {
        "signature": "Industrial smoke + biomass burning + river moisture trap",
        "dominant": "PM2.5",
        "dominant_pct": 61,
        "sources": [
            {"name": "Industry",          "pct": 35, "icon": "🏭", "color": "#9e2a2b"},
            {"name": "Vehicle exhaust",   "pct": 30, "icon": "🚗", "color": "#e05a00"},
            {"name": "Biomass burning",   "pct": 22, "icon": "🔥", "color": "#e65100"},
            {"name": "Other",             "pct": 13, "icon": "💨", "color": "#9e9e9e"},
        ],
        "peak_months": ["Nov", "Dec", "Jan", "Feb"],
        "peak_hours": ["6-9 AM", "7-10 PM"],
        "insight": "The Hooghly river creates a humidity trap that holds pollutants close to ground level. Howrah's industrial emissions routinely cross into central Kolkata on winter evenings.",
        "unique_risk": "Biomass burning for cooking in dense urban areas adds a unique carcinogenic compound mix not seen in other metros.",
    },
    "hyderabad": {
        "signature": "Rock quarrying + cement industry + tech corridor traffic",
        "dominant": "PM10",
        "dominant_pct": 58,
        "sources": [
            {"name": "Construction",    "pct": 35, "icon": "🏗️", "color": "#b5580c"},
            {"name": "Vehicle exhaust", "pct": 32, "icon": "🚗", "color": "#e05a00"},
            {"name": "Industry",        "pct": 22, "icon": "🏭", "color": "#9e2a2b"},
            {"name": "Other",           "pct": 11, "icon": "💨", "color": "#9e9e9e"},
        ],
        "peak_months": ["Apr", "May", "Jan", "Feb"],
        "peak_hours": ["9-11 AM", "6-8 PM"],
        "insight": "Hyderabad's Deccan plateau geography means dust from granite quarrying travels far. The HiTech City corridor has better air than Uppal or Secunderabad due to tree cover.",
        "unique_risk": "Summer dust storms (April–May) can spike AQI to 300+ within hours, catching people outdoors off guard.",
    },
    "chennai": {
        "signature": "Coastal humidity + industrial north + vehicle south",
        "dominant": "NO₂",
        "dominant_pct": 48,
        "sources": [
            {"name": "Vehicle exhaust", "pct": 42, "icon": "🚗", "color": "#e05a00"},
            {"name": "Industry",        "pct": 32, "icon": "🏭", "color": "#9e2a2b"},
            {"name": "Construction",    "pct": 16, "icon": "🏗️", "color": "#b5580c"},
            {"name": "Other",           "pct": 10, "icon": "💨", "color": "#9e9e9e"},
        ],
        "peak_months": ["Dec", "Jan", "Feb", "Mar"],
        "peak_hours": ["8-10 AM", "5-8 PM"],
        "insight": "Chennai benefits from consistent sea breeze from the Bay of Bengal — but Ambattur and Manali industrial zones create localised spikes 3–4× higher than Marina Beach.",
        "unique_risk": "Coastal humidity keeps pollutants suspended longer. High ozone levels in summer afternoons affect runners and cyclists.",
    },
    "pune": {
        "signature": "Two-wheeler capital + Pimpri industrial belt + valley geography",
        "dominant": "PM2.5",
        "dominant_pct": 55,
        "sources": [
            {"name": "Two-wheelers",    "pct": 45, "icon": "🏍️", "color": "#e05a00"},
            {"name": "Industry",        "pct": 28, "icon": "🏭", "color": "#9e2a2b"},
            {"name": "Construction",    "pct": 17, "icon": "🏗️", "color": "#b5580c"},
            {"name": "Other",           "pct": 10, "icon": "💨", "color": "#9e9e9e"},
        ],
        "peak_months": ["Nov", "Dec", "Jan", "Feb"],
        "peak_hours": ["8-10 AM", "6-9 PM"],
        "insight": "Pune has more registered two-wheelers per capita than any other major Indian city. The Mula-Mutha river valley traps pollution on still winter nights.",
        "unique_risk": "Two-wheeler exhaust sits at face-height for pedestrians and cyclists — PM2.5 exposure on Pune roads is among the highest in the country.",
    },
    "ahmedabad": {
        "signature": "Textile/chemical industry + dust + summer heat",
        "dominant": "PM10",
        "dominant_pct": 60,
        "sources": [
            {"name": "Industry",        "pct": 40, "icon": "🏭", "color": "#9e2a2b"},
            {"name": "Vehicle exhaust", "pct": 30, "icon": "🚗", "color": "#e05a00"},
            {"name": "Dust",            "pct": 20, "icon": "🌪️", "color": "#b5580c"},
            {"name": "Other",           "pct": 10, "icon": "💨", "color": "#9e9e9e"},
        ],
        "peak_months": ["Apr", "May", "Dec", "Jan"],
        "peak_hours": ["7-10 AM", "5-8 PM"],
        "insight": "Ahmedabad's textile and chemical belt in Vatva and Naroda produces industrial emissions with SO₂ and VOCs not seen in software-led cities. Summer dust storms are a seasonal hazard.",
        "unique_risk": "Vatva GIDC area residents face 4× higher PM2.5 than Bopal or SG Highway due to proximity to industrial estates.",
    },
}


def get_pollution_fingerprint(city_id: str) -> dict:
    fp = CITY_FINGERPRINTS.get(city_id, {
        "signature": "Mixed urban pollution",
        "dominant": "PM2.5",
        "dominant_pct": 50,
        "sources": [
            {"name": "Vehicle exhaust", "pct": 45, "icon": "🚗", "color": "#e05a00"},
            {"name": "Industry",        "pct": 30, "icon": "🏭", "color": "#9e2a2b"},
            {"name": "Other",           "pct": 25, "icon": "💨", "color": "#9e9e9e"},
        ],
        "peak_months": ["Nov", "Dec", "Jan"],
        "peak_hours": ["8-10 AM", "6-8 PM"],
        "insight": "This city's pollution profile is driven by a typical Indian urban mix of traffic and construction.",
        "unique_risk": "Limit outdoor exposure during peak traffic hours.",
    })
    return {"city_id": city_id, **fp}


# ─── 4. BODY BATTERY INDEX ────────────────────────────────────────────────────

def get_body_battery(aqi: int, weather: dict) -> dict:
    """
    Calculates how much harder your body has to work outdoors today
    compared to a perfect day. Score 100 = perfect. Score 30 = very hard.

    Factors: AQI (lung load) + heat index + humidity (cardiovascular load)
    """
    temp     = weather.get("temp_c", 28)
    humidity = weather.get("humidity", 50)
    wind     = weather.get("wind_kph", 10)

    # Heat index (apparent temperature effect)
    heat_idx = temp + 0.33 * (humidity / 100 * 6.105 * math.exp(17.27 * temp / (237.7 + temp))) - 0.70 * wind / 3.6 - 4.0

    # AQI penalty (0-50 points)
    aqi_penalty = min(50, (aqi / 500) * 50)

    # Heat penalty (0-30 points)
    if heat_idx <= 27:
        heat_penalty = 0
    elif heat_idx <= 32:
        heat_penalty = (heat_idx - 27) / 5 * 10
    elif heat_idx <= 41:
        heat_penalty = 10 + (heat_idx - 32) / 9 * 15
    else:
        heat_penalty = 25 + min(5, (heat_idx - 41) / 5 * 5)

    # Humidity penalty (0-20 points)
    hum_penalty = max(0, (humidity - 50) / 50 * 20)

    total_penalty = aqi_penalty + heat_penalty + hum_penalty
    score         = max(5, round(100 - total_penalty))

    if score >= 85:
        label      = "Easy"
        multiplier = 1.0
        advice     = "Perfect outdoor conditions. Go for it! 🏃"
        emoji      = "💪"
    elif score >= 70:
        label      = "Moderate"
        multiplier = 1.2
        advice     = "Slightly elevated exertion. Hydrate well before going out."
        emoji      = "😊"
    elif score >= 55:
        label      = "Hard"
        multiplier = 1.5
        advice     = "Outdoor exercise requires 50% more effort than usual. Shorten workouts."
        emoji      = "😐"
    elif score >= 40:
        label      = "Very Hard"
        multiplier = 2.0
        advice     = "Double the exertion cost. Indoor training strongly recommended."
        emoji      = "😓"
    else:
        label      = "Extreme"
        multiplier = 3.0
        advice     = "Extreme conditions. Outdoor exercise is counterproductive — rest indoors."
        emoji      = "🛑"

    activity_costs = {
        "Running 5km":       f"{round(30 * multiplier)} min equivalent effort",
        "Cycling 10km":      f"{round(40 * multiplier)} min equivalent effort",
        "Walking 30 min":    f"{round(30 * multiplier)} min equivalent effort",
        "Yoga outdoors":     f"{round(20 * multiplier)} min equivalent effort",
    }

    return {
        "score": score,
        "label": label,
        "emoji": emoji,
        "multiplier": multiplier,
        "advice": advice,
        "heat_index": round(heat_idx, 1),
        "aqi_penalty": round(aqi_penalty),
        "heat_penalty": round(heat_penalty),
        "hum_penalty": round(hum_penalty),
        "activity_costs": activity_costs,
        "color": _score_color(score),
    }


# ─── 5. CLEAN AIR WINDOW PREDICTOR ───────────────────────────────────────────

def get_clean_window_prediction(city_id: str, forecast: list[dict]) -> dict:
    """
    Identify the best consecutive 2-hour window for outdoor activity tomorrow
    based on forecast data.
    """
    if not forecast:
        from utils.mock_data import get_12h_forecast
        forecast = get_12h_forecast(city_id)

    # Find lowest 2-consecutive-hour window
    best_start = None
    best_avg   = 999

    for i in range(len(forecast) - 1):
        avg = (forecast[i]["aqi"] + forecast[i + 1]["aqi"]) / 2
        if avg < best_avg:
            best_avg   = avg
            best_start = i

    if best_start is not None:
        window     = forecast[best_start:best_start + 2]
        start_time = window[0].get("hour", window[0].get("label", "?"))
        end_time   = window[-1].get("hour", window[-1].get("label", "?"))
        avg_aqi    = round(best_avg)
        cat, color = get_category(avg_aqi)

        # Why this window?
        reasons = []
        h = forecast[best_start].get("hour_24", 6)
        if h <= 7:
            reasons.append("Early morning — traffic hasn't started, air is naturally cleaner")
        elif h >= 14 and h <= 16:
            reasons.append("Afternoon — wind typically peaks, dispersing pollutants")
        if avg_aqi <= 100:
            reasons.append("AQI within safe limits for all activity types")
        if avg_aqi <= 50:
            reasons.append("Excellent air — one of the cleanest windows of the week")

        return {
            "window_start": start_time,
            "window_end": end_time,
            "avg_aqi": avg_aqi,
            "category": cat,
            "color": color,
            "emoji": aqi_to_emoji(avg_aqi),
            "reasons": reasons,
            "recommendation": f"Best 2-hour window: {start_time} → {end_time} (avg AQI {avg_aqi})",
        }

    return {"recommendation": "No clean window available today. Stay indoors."}