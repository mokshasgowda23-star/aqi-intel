"""
backend/school_mode.py
-----------------------
Kids and School Mode — AQI intelligence for parents and schools.
Answers: "Is it safe for outdoor recess? Should kids wear masks on the way to school?"
"""

from utils.aqi_calculator import get_category, aqi_to_emoji


RECESS_THRESHOLDS = {
    "safe":    100,   # AQI ≤ 100: full outdoor play
    "limited": 150,   # AQI 101–150: shorter outdoor time
    "indoor":  200,   # AQI > 150: bring recess indoors
    "cancel":  300,   # AQI > 300: no outdoor activity whatsoever
}

# Age groups and their sensitivity levels
AGE_GROUPS = {
    "toddler":    {"label": "Toddlers (0–3 yrs)",  "sensitivity": "very_high", "max_safe": 50},
    "preschool":  {"label": "Preschool (3–6 yrs)",  "sensitivity": "high",      "max_safe": 75},
    "primary":    {"label": "Primary (6–12 yrs)",   "sensitivity": "moderate",  "max_safe": 100},
    "secondary":  {"label": "Secondary (12–18 yrs)","sensitivity": "moderate",  "max_safe": 100},
}


def get_school_report(aqi: int, city_id: str) -> dict:
    """
    Generate a school-mode report for parents and school administrators.
    """
    category, color = get_category(aqi)

    recess = _recess_decision(aqi)
    commute = _school_commute_advice(aqi)
    age_reports = {age: _age_specific_advice(aqi, data)
                   for age, data in AGE_GROUPS.items()}

    general_advisory = _general_school_advisory(aqi)

    return {
        "aqi": aqi,
        "category": category,
        "color": color,
        "emoji": aqi_to_emoji(aqi),
        "recess": recess,
        "commute": commute,
        "age_groups": age_reports,
        "general_advisory": general_advisory,
        "school_alert_level": _alert_level(aqi),
        "parent_message": _parent_sms_message(aqi),
    }


def _recess_decision(aqi: int) -> dict:
    if aqi <= RECESS_THRESHOLDS["safe"]:
        return {
            "allowed": True,
            "type": "full",
            "duration": "Normal",
            "icon": "⛹️",
            "message": "✅ Full outdoor recess — air quality is good!",
            "color": "#00b050",
        }
    elif aqi <= RECESS_THRESHOLDS["limited"]:
        return {
            "allowed": True,
            "type": "limited",
            "duration": "Shorten to 15 min",
            "icon": "⏱️",
            "message": "⚠️ Limit outdoor recess to 15 minutes. No strenuous play.",
            "color": "#ffbf00",
        }
    elif aqi <= RECESS_THRESHOLDS["indoor"]:
        return {
            "allowed": False,
            "type": "indoor_only",
            "duration": "Move indoors",
            "icon": "🏠",
            "message": "🚫 Move recess indoors. AQI is too high for outdoor play.",
            "color": "#ff6600",
        }
    else:
        return {
            "allowed": False,
            "type": "cancel",
            "duration": "Cancel outdoor activities",
            "icon": "❌",
            "message": "❌ Cancel all outdoor activities. Severe air quality.",
            "color": "#cc0000",
        }


def _school_commute_advice(aqi: int) -> dict:
    if aqi <= 100:
        return {
            "mask": False,
            "walk_ok": True,
            "message": "✅ Safe to walk or cycle to school today.",
            "icon": "🚶",
        }
    elif aqi <= 200:
        return {
            "mask": True,
            "mask_type": "surgical",
            "walk_ok": True,
            "message": "😷 Mask recommended during commute. Keep it short.",
            "icon": "😷",
        }
    else:
        return {
            "mask": True,
            "mask_type": "N95",
            "walk_ok": False,
            "message": "🚗 Commute by enclosed vehicle if possible. N95 mask required outdoors.",
            "icon": "🚗",
        }


def _age_specific_advice(aqi: int, age_data: dict) -> dict:
    max_safe = age_data["max_safe"]
    is_safe = aqi <= max_safe
    is_caution = max_safe < aqi <= max_safe + 50

    if is_safe:
        status = "safe"
        advice = f"Safe for {age_data['label']} today. Normal activities OK."
        color = "#00b050"
    elif is_caution:
        status = "caution"
        advice = f"Caution for {age_data['label']}. Limit outdoor time to 20 minutes."
        color = "#ffbf00"
    else:
        status = "unsafe"
        advice = f"Unsafe for {age_data['label']}. Keep indoors — children's lungs are more vulnerable."
        color = "#cc0000"

    return {
        "label": age_data["label"],
        "sensitivity": age_data["sensitivity"],
        "max_safe_aqi": max_safe,
        "status": status,
        "advice": advice,
        "color": color,
    }


def _general_school_advisory(aqi: int) -> list[str]:
    tips = []

    if aqi > 100:
        tips.append("🪟 Keep classroom windows closed during poor AQI periods")
    if aqi > 150:
        tips.append("📢 Send notification to parents about today's AQI conditions")
        tips.append("🏃 Replace PE period with indoor activities")
    if aqi > 200:
        tips.append("🏫 Consider issuing school-wide mask advisory")
        tips.append("💧 Ensure kids stay hydrated — pollution can cause throat irritation")
    if aqi > 300:
        tips.append("📱 Alert parents — consider early dismissal or work-from-home for staff")
        tips.append("🚑 Have first aid ready — respiratory complaints may increase")

    if not tips:
        tips.append("🌿 Great air day! All outdoor activities are safe.")

    return tips


def _alert_level(aqi: int) -> dict:
    if aqi <= 100:
        return {"level": 1, "label": "Green", "color": "#00b050", "action": "Normal school day"}
    elif aqi <= 150:
        return {"level": 2, "label": "Yellow", "color": "#ffbf00", "action": "Limited outdoor activity"}
    elif aqi <= 200:
        return {"level": 3, "label": "Orange", "color": "#ff6600", "action": "Indoor recess only"}
    elif aqi <= 300:
        return {"level": 4, "label": "Red", "color": "#cc0000", "action": "No outdoor activities"}
    else:
        return {"level": 5, "label": "Purple", "color": "#660000", "action": "Emergency protocol"}


def _parent_sms_message(aqi: int) -> str:
    """Generate a short SMS/WhatsApp message schools can send parents."""
    if aqi <= 100:
        return f"🌿 Today's AQI is {aqi} (Good). Normal school day — outdoor activities are safe!"
    elif aqi <= 200:
        return f"⚠️ AQI Alert: Today's AQI is {aqi} (Moderate/Poor). Recess moved indoors. Please pack a mask for your child."
    else:
        return (
            f"🚨 High AQI Alert: AQI is {aqi} today. All outdoor activities cancelled. "
            "N95 masks required. Please pick up your child early if possible."
        )