"""
utils/aqi_calculator.py
-----------------------
India NAQI (National Air Quality Index) calculation helpers.
Converts raw pollutant concentrations → sub-indices → overall AQI.
"""

# India NAQI breakpoints per pollutant
# Format: (Clo, Chi, Ilo, Ihi)
BREAKPOINTS = {
    "pm25": [
        (0,    30,   0,   50),
        (30,   60,   51,  100),
        (60,   90,   101, 200),
        (90,   120,  201, 300),
        (120,  250,  301, 400),
        (250,  500,  401, 500),
    ],
    "pm10": [
        (0,    50,   0,   50),
        (50,   100,  51,  100),
        (100,  250,  101, 200),
        (250,  350,  201, 300),
        (350,  430,  301, 400),
        (430,  600,  401, 500),
    ],
    "no2": [
        (0,    40,   0,   50),
        (40,   80,   51,  100),
        (80,   180,  101, 200),
        (180,  280,  201, 300),
        (280,  400,  301, 400),
        (400,  800,  401, 500),
    ],
    "so2": [
        (0,    40,   0,   50),
        (40,   80,   51,  100),
        (80,   380,  101, 200),
        (380,  800,  201, 300),
        (800,  1600, 301, 400),
        (1600, 2100, 401, 500),
    ],
    "o3": [
        (0,    50,   0,   50),
        (50,   100,  51,  100),
        (100,  168,  101, 200),
        (168,  208,  201, 300),
        (208,  748,  301, 400),
        (748,  1000, 401, 500),
    ],
    "co": [
        (0,    1,    0,   50),
        (1,    2,    51,  100),
        (2,    10,   101, 200),
        (10,   17,   201, 300),
        (17,   34,   301, 400),
        (34,   50,   401, 500),
    ],
}

CATEGORIES = [
    (0,   50,  "Good",        "#00b050"),
    (51,  100, "Satisfactory","#92d050"),
    (101, 200, "Moderate",    "#ffbf00"),
    (201, 300, "Poor",        "#ff6600"),
    (301, 400, "Very Poor",   "#cc0000"),
    (401, 500, "Severe",      "#660000"),
]


def sub_index(pollutant: str, concentration: float) -> int | None:
    """Calculate sub-index for a single pollutant using linear interpolation."""
    bps = BREAKPOINTS.get(pollutant)
    if bps is None or concentration is None:
        return None

    for clo, chi, ilo, ihi in bps:
        if clo <= concentration <= chi:
            # Linear interpolation formula
            si = ((ihi - ilo) / (chi - clo)) * (concentration - clo) + ilo
            return round(si)

    # If beyond scale, return 500
    return 500


def calculate_aqi(pollutants: dict) -> dict:
    """
    Calculate overall AQI from a dict of pollutant concentrations.
    Returns: { aqi, dominant_pollutant, sub_indices, category, color }

    pollutants = {
        "pm25": 45.2,
        "pm10": 89.0,
        "no2": 32.1,
        ...
    }
    """
    sub_indices = {}
    for pollutant, conc in pollutants.items():
        if conc is not None:
            si = sub_index(pollutant, conc)
            if si is not None:
                sub_indices[pollutant] = si

    if not sub_indices:
        return {"aqi": None, "error": "No valid pollutant data"}

    # Overall AQI = max of all sub-indices (India NAQI definition)
    dominant = max(sub_indices, key=sub_indices.get)
    aqi_value = sub_indices[dominant]

    category, color = get_category(aqi_value)

    return {
        "aqi": aqi_value,
        "dominant_pollutant": dominant,
        "sub_indices": sub_indices,
        "category": category,
        "color": color,
    }


def get_category(aqi: int) -> tuple[str, str]:
    """Return (category_name, hex_color) for an AQI value."""
    for lo, hi, cat, color in CATEGORIES:
        if lo <= aqi <= hi:
            return cat, color
    return "Severe", "#660000"


def aqi_to_emoji(aqi: int) -> str:
    emojis = {
        (0, 50): "😊",
        (51, 100): "🙂",
        (101, 200): "😐",
        (201, 300): "😷",
        (301, 400): "🚨",
        (401, 500): "☠️",
    }
    for (lo, hi), emoji in emojis.items():
        if lo <= aqi <= hi:
            return emoji
    return "☠️"


def is_safe_for_activity(aqi: int, activity: str, thresholds: dict) -> dict:
    """
    Check if AQI is safe for a given activity.
    Returns: { safe: bool, caution: bool, message: str }
    """
    acts = thresholds.get("activities", {})
    act = acts.get(activity)
    if not act:
        return {"safe": True, "caution": False, "message": "No data for this activity"}

    if aqi <= act["max_aqi_safe"]:
        return {"safe": True, "caution": False, "message": f"✅ Safe to {act['label'].lower()} today!"}
    elif aqi <= act["max_aqi_caution"]:
        return {
            "safe": False,
            "caution": True,
            "message": f"⚠️ Use caution. {act['reason_unsafe']}"
        }
    else:
        return {
            "safe": False,
            "caution": False,
            "message": f"❌ Not recommended. {act['reason_unsafe']}"
        }