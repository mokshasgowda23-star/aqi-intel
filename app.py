"""
app.py
------
AQI Intelligence — Flask application entry point.
This file ONLY contains routes. All logic lives in backend/ modules.

Routes:
  GET  /api/cities                     — All cities summary
  GET  /api/city/<city_id>             — Current AQI for a city
  GET  /api/city/<city_id>/heatmap     — Zone heatmap data
  GET  /api/city/<city_id>/forecast    — 12-hour AQI forecast
  GET  /api/city/<city_id>/brief       — Full daily brief
  GET  /api/city/<city_id>/activities  — Activity intelligence
  GET  /api/city/<city_id>/calendar    — Monthly good/bad air calendar
  GET  /api/city/<city_id>/school      — School/kids mode report
  GET  /api/city/<city_id>/indoor      — Indoor venue suggestions
  GET  /api/city/<city_id>/community   — City cleanliness score
  POST /api/alert/set                  — Set AQI threshold alert
  GET  /api/alert/<session_id>/<city>  — Check alert status
  POST /api/checkin                    — Daily check-in + streak
  GET  /api/user/<session_id>/<city>   — User profile + badges
"""

import json
import os
from flask import Flask, jsonify, request, send_from_directory
from flask_cors import CORS
from dotenv import load_dotenv

# Backend services
from backend.aqi_service import (
    get_current_aqi, get_zone_heatmap,
    get_all_cities_summary, get_indoor_suggestions,
)
from backend.forecast_service import get_forecast, get_weather_data
from backend.activity_service import get_activity_report
from backend.alert_service import set_alert, get_alert_status, get_smart_threshold_suggestion
from backend.calendar_service import get_monthly_calendar, get_weekly_summary, get_best_days_analysis
from backend.community_service import daily_checkin, get_user_profile, get_city_score
from backend.daily_brief import get_full_brief
from backend.school_mode import get_school_report
from backend.places_service import get_venues_for_city, search_venues_near, get_venues_by_type
from backend.city_search import search_city_aqi, autocomplete_cities, get_all_india_cities
from backend.unique_features import get_lung_score, get_time_machine, get_pollution_fingerprint, get_body_battery, get_clean_window_prediction
from backend.health_profile import (
    save_profile, get_profile, search_conditions,
    get_all_conditions, get_personal_aqi_report, HEALTH_CONDITIONS, AGE_GROUPS, CATEGORIES
)

load_dotenv()

app = Flask(__name__, static_folder="frontend", static_url_path="")

# Serve JS/CSS from frontend/static/
@app.route("/static/<path:filename>")
def static_files(filename):
    return send_from_directory("frontend/static", filename)
CORS(app)

# ──────────────────────────────────────────────
# Load city data once at startup
# ──────────────────────────────────────────────
with open("data/cities.json", encoding="utf-8") as f:
    _cities_raw = json.load(f)
CITY_MAP = {c["id"]: c for c in _cities_raw["cities"]}


def _get_city(city_id: str):
    """Helper: return city dict or abort with 404."""
    city = CITY_MAP.get(city_id)
    if not city:
        return None, jsonify({"error": f"City '{city_id}' not found"}), 404
    return city, None, None


# ──────────────────────────────────────────────
# Frontend
# ──────────────────────────────────────────────
@app.route("/")
def index():
    return send_from_directory("frontend", "index.html")


# ──────────────────────────────────────────────
# Cities
# ──────────────────────────────────────────────
@app.route("/api/cities")
def all_cities():
    """Summary AQI for all supported Indian cities."""
    return jsonify(get_all_cities_summary())


@app.route("/api/city/<city_id>")
def city_aqi(city_id):
    """Current AQI for a single city."""
    return jsonify(get_current_aqi(city_id))


# ──────────────────────────────────────────────
# Heatmap
# ──────────────────────────────────────────────
@app.route("/api/city/<city_id>/heatmap")
def city_heatmap(city_id):
    """Zone-level AQI heatmap for a city."""
    return jsonify(get_zone_heatmap(city_id))


# ──────────────────────────────────────────────
# Forecast
# ──────────────────────────────────────────────
@app.route("/api/city/<city_id>/forecast")
def city_forecast(city_id):
    """12-hour AQI forecast + best time to go outside."""
    city, err, code = _get_city(city_id)
    if err:
        return err, code
    return jsonify(get_forecast(city_id, city["lat"], city["lon"]))


# ──────────────────────────────────────────────
# Daily Brief
# ──────────────────────────────────────────────
@app.route("/api/city/<city_id>/brief")
def city_brief(city_id):
    """Full daily life brief: clothing, mask, commute, food, tips."""
    city, err, code = _get_city(city_id)
    if err:
        return err, code

    aqi_data = get_current_aqi(city_id)
    weather = get_weather_data(city_id, city["lat"], city["lon"])
    aqi = aqi_data.get("aqi", 100)

    # Optional user profile from query params
    profile = {
        "has_kids":    request.args.get("kids", "false").lower() == "true",
        "has_pets":    request.args.get("pets", "false").lower() == "true",
        "is_runner":   request.args.get("runner", "false").lower() == "true",
        "is_cyclist":  request.args.get("cyclist", "false").lower() == "true",
        "health_conditions": request.args.get("conditions", "").split(","),
    }

    return jsonify(get_full_brief(city_id, city["name"], aqi, weather, profile))


# ──────────────────────────────────────────────
# Activity Intelligence
# ──────────────────────────────────────────────
@app.route("/api/city/<city_id>/activities")
def city_activities(city_id):
    """Outdoor activity intelligence for a city."""
    city, err, code = _get_city(city_id)
    if err:
        return err, code

    aqi_data = get_current_aqi(city_id)
    weather = get_weather_data(city_id, city["lat"], city["lon"])
    aqi = aqi_data.get("aqi", 100)

    return jsonify(get_activity_report(aqi, weather))


# ──────────────────────────────────────────────
# Calendar
# ──────────────────────────────────────────────
@app.route("/api/city/<city_id>/calendar")
def city_calendar(city_id):
    """Monthly good/bad air day calendar."""
    return jsonify(get_monthly_calendar(city_id))


@app.route("/api/city/<city_id>/calendar/week")
def city_week(city_id):
    """This week's air quality summary."""
    return jsonify(get_weekly_summary(city_id))


@app.route("/api/city/<city_id>/calendar/analysis")
def city_calendar_analysis(city_id):
    """Which days of the week tend to be cleaner."""
    return jsonify(get_best_days_analysis(city_id))


# ──────────────────────────────────────────────
# School / Kids Mode
# ──────────────────────────────────────────────
@app.route("/api/city/<city_id>/school")
def city_school(city_id):
    """School/kids mode report — recess, commute, age group advice."""
    aqi_data = get_current_aqi(city_id)
    aqi = aqi_data.get("aqi", 100)
    return jsonify(get_school_report(aqi, city_id))


# ──────────────────────────────────────────────
# Indoor Venues
# ──────────────────────────────────────────────
@app.route("/api/city/<city_id>/indoor")
def city_indoor(city_id):
    """Indoor venue suggestions when AQI is bad."""
    return jsonify({
        "venues": get_indoor_suggestions(city_id),
        "city_id": city_id,
    })


# ──────────────────────────────────────────────
# Community
# ──────────────────────────────────────────────
@app.route("/api/city/<city_id>/community")
def city_community(city_id):
    """City cleanliness score and community stats."""
    return jsonify(get_city_score(city_id))


# ──────────────────────────────────────────────
# Alert System
# ──────────────────────────────────────────────
@app.route("/api/alert/set", methods=["POST"])
def alert_set():
    """Set a user's AQI alert threshold."""
    data = request.get_json()
    session_id = data.get("session_id", "default")
    city_id = data.get("city_id", "delhi")
    threshold = int(data.get("threshold", 150))
    return jsonify(set_alert(session_id, city_id, threshold))


@app.route("/api/alert/<session_id>/<city_id>")
def alert_check(session_id, city_id):
    """Check if current AQI triggers the user's alert."""
    aqi_data = get_current_aqi(city_id)
    aqi = aqi_data.get("aqi", 100)
    status = get_alert_status(session_id, aqi)
    status["suggestion"] = get_smart_threshold_suggestion(city_id)
    return jsonify(status)


# ──────────────────────────────────────────────
# Community / Gamification
# ──────────────────────────────────────────────
@app.route("/api/checkin", methods=["POST"])
def checkin():
    """Daily check-in — updates streak and evaluates badges."""
    data = request.get_json()
    session_id = data.get("session_id", "default")
    city_id = data.get("city_id", "delhi")
    aqi_data = get_current_aqi(city_id)
    aqi = aqi_data.get("aqi", 100)

    return jsonify(daily_checkin(
        session_id=session_id,
        city_id=city_id,
        current_aqi=aqi,
        wore_mask=data.get("wore_mask", False),
        stayed_indoors=data.get("stayed_indoors", False),
    ))


@app.route("/api/user/<session_id>/<city_id>")
def user_profile(session_id, city_id):
    """User profile: streak, badges, progress."""
    return jsonify(get_user_profile(session_id, city_id))


# ──────────────────────────────────────────────
# Places / Indoor Venues (places_service)
# ──────────────────────────────────────────────
@app.route("/api/city/<city_id>/places")
def city_places(city_id):
    """Indoor venue suggestions with AQI-aware filtering."""
    city, err, code = _get_city(city_id)
    if err:
        return err, code

    aqi_data = get_current_aqi(city_id)
    aqi = aqi_data.get("aqi", 100)

    venue_types = request.args.get("types", "").split(",")
    venue_types = [t for t in venue_types if t]  # strip empty strings
    max_results = int(request.args.get("max", 8))

    return jsonify(get_venues_for_city(
        city_id=city_id,
        aqi=aqi,
        venue_types=venue_types or None,
        max_results=max_results,
    ))


@app.route("/api/city/<city_id>/places/<venue_type>")
def city_places_by_type(city_id, venue_type):
    """Get venues of a specific type in a city."""
    return jsonify({
        "venues": get_venues_by_type(city_id, venue_type),
        "city_id": city_id,
        "type": venue_type,
    })


@app.route("/api/places/nearby")
def places_nearby():
    """Find venues near a specific lat/lon."""
    try:
        lat  = float(request.args.get("lat", 0))
        lon  = float(request.args.get("lon", 0))
        city = request.args.get("city", "bengaluru")
        vtype = request.args.get("type", "gym")
        radius = int(request.args.get("radius", 3000))
    except ValueError:
        return jsonify({"error": "Invalid lat/lon"}), 400

    return jsonify(search_venues_near(city, lat, lon, vtype, 0, radius))





# ──────────────────────────────────────────────
# Health Profile — Personalised AQI
# ──────────────────────────────────────────────

@app.route("/api/health/conditions")
def health_conditions_all():
    """All health conditions grouped by category."""
    return jsonify(get_all_conditions())


@app.route("/api/health/conditions/search")
def health_conditions_search():
    """Search health conditions by keyword."""
    q     = request.args.get("q", "").strip()
    limit = int(request.args.get("limit", 8))
    return jsonify(search_conditions(q, limit))


@app.route("/api/health/conditions/meta")
def health_conditions_meta():
    """Return categories, age groups, and full condition list for profile setup."""
    return jsonify({
        "categories":  CATEGORIES,
        "age_groups":  AGE_GROUPS,
        "conditions": [
            {"id": k, "name": v["name"], "icon": v["icon"],
             "color": v["color"], "category": v["category"]}
            for k, v in HEALTH_CONDITIONS.items()
        ],
    })


@app.route("/api/health/profile", methods=["POST"])
def health_profile_save():
    """Save a user's health profile."""
    data       = request.get_json() or {}
    session_id = data.get("session_id", "default")
    return jsonify(save_profile(session_id, data))


@app.route("/api/health/profile/<session_id>")
def health_profile_get(session_id):
    """Get a user's health profile."""
    return jsonify(get_profile(session_id))


@app.route("/api/health/report/<session_id>/<city_id>")
def health_personal_report(session_id, city_id):
    """Generate personalised AQI report for this user + city."""
    aqi_data = get_current_aqi(city_id)
    aqi      = aqi_data.get("aqi", 100)
    city     = CITY_MAP.get(city_id)
    weather  = {}
    if city:
        weather = get_weather_data(city_id, city["lat"], city["lon"])
    return jsonify(get_personal_aqi_report(session_id, aqi, weather))


# ──────────────────────────────────────────────
# Unique Features
# ──────────────────────────────────────────────

@app.route("/api/city/<city_id>/lung-score")
def city_lung_score(city_id):
    """Personalised cumulative AQI exposure tracker — Lung Score."""
    return jsonify(get_lung_score(city_id))


@app.route("/api/city/<city_id>/time-machine")
def city_time_machine(city_id):
    """Compare today's AQI to same date last year."""
    target = request.args.get("date")
    return jsonify(get_time_machine(city_id, target))


@app.route("/api/city/<city_id>/fingerprint")
def city_fingerprint(city_id):
    """City pollution fingerprint — what exactly is in your air."""
    return jsonify(get_pollution_fingerprint(city_id))


@app.route("/api/city/<city_id>/body-battery")
def city_body_battery(city_id):
    """Body Battery Index — how hard outdoor activity is today."""
    city, err, code = _get_city(city_id)
    if err:
        return err, code
    aqi_data = get_current_aqi(city_id)
    weather  = get_weather_data(city_id, city["lat"], city["lon"])
    return jsonify(get_body_battery(aqi_data.get("aqi", 100), weather))


@app.route("/api/city/<city_id>/clean-window")
def city_clean_window(city_id):
    """Predict the best 2-hour outdoor window from forecast."""
    fc = get_forecast(city_id, 0, 0)
    return jsonify(get_clean_window_prediction(city_id, fc.get("forecast", [])))


# ──────────────────────────────────────────────
# City Search — any Indian city
# ──────────────────────────────────────────────
@app.route("/api/search/city")
def search_any_city():
    """Get AQI for any Indian city by name (Hassan, Mandya, Ooty, etc.)"""
    name = request.args.get("q", "").strip()
    if not name or len(name) < 2:
        return jsonify({"error": "Query too short"}), 400
    return jsonify(search_city_aqi(name))


@app.route("/api/search/autocomplete")
def city_autocomplete():
    """Autocomplete suggestions for city search."""
    q = request.args.get("q", "").strip()
    limit = int(request.args.get("limit", 8))
    return jsonify(autocomplete_cities(q, limit))


@app.route("/api/search/cities")
def all_searchable_cities():
    """Full list of Indian cities for frontend search."""
    return jsonify(get_all_india_cities())


# ──────────────────────────────────────────────
# Run
# ──────────────────────────────────────────────
if __name__ == "__main__":
    import threading

    # Guard: Flask must run from the main thread.
    # If you see a signal/thread error you are running this through Streamlit.
    # Fix: open a terminal and run   python app.py
    if threading.current_thread() is not threading.main_thread():
        print("\n❌  Run this directly in a terminal:\n")
        print("      python app.py\n")
        raise RuntimeError(
            "Flask must run in the main thread. "
            "Do not use  streamlit run app.py  —  use  python app.py  instead."
        )

    port = int(os.getenv("PORT", 5000))
    debug = os.getenv("DEBUG", "true").lower() == "true"

    # Disable the Werkzeug reloader by default — avoids signal() errors on Windows
    use_reloader = os.getenv("FLASK_RELOADER", "false").lower() == "true"

    print(f"\n🌫️  AQI Intelligence running at http://localhost:{port}")
    print(f"   Mode: {'Demo (mock data)' if not os.getenv('WAQI_TOKEN') else 'Live data'}")
    print(f"   Open: http://localhost:{port}\n")

    app.run(
        host="0.0.0.0",
        port=port,
        debug=debug,
        use_reloader=use_reloader,
        threaded=True,
    )