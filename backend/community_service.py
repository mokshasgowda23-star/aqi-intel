"""
backend/community_service.py
-----------------------------
Community gamification layer.
- Daily check-in streaks
- Badges ("Masked Up 7 Days", "Stayed Indoors on Red Day")
- City Cleanliness Score based on community actions
- In-memory user store (use DB in production)
"""

import json
from datetime import datetime, timedelta
from pathlib import Path
from datetime import timezone, timedelta

IST = timezone(timedelta(hours=5, minutes=30))
DATA_DIR = Path(__file__).parent.parent / "data"

# In-memory store for demo purposes
# Production: replace with SQLite / PostgreSQL
_users: dict = {}


def _load_badge_defs() -> list[dict]:
    with open(DATA_DIR / "thresholds.json", encoding="utf-8") as f:
        data = json.load(f)
    return data.get("badges", [])


BADGE_DEFS = _load_badge_defs()


def get_or_create_user(session_id: str, city_id: str) -> dict:
    if session_id not in _users:
        _users[session_id] = {
            "session_id": session_id,
            "city_id": city_id,
            "streak": 0,
            "last_checkin": None,
            "badges": [],
            "actions": [],
            "masked_days": 0,
            "indoor_days": 0,
            "check_count": 0,
            "school_checks": 0,
            "reports_submitted": 0,
            "joined_at": datetime.now(IST).isoformat(),
        }
    return _users[session_id]


def daily_checkin(session_id: str, city_id: str, current_aqi: int,
                  wore_mask: bool = False, stayed_indoors: bool = False) -> dict:
    """
    Record a daily check-in. Updates streak + evaluates badge unlocks.
    """
    user = get_or_create_user(session_id, city_id)
    now = datetime.now(IST)
    today = now.date()

    # Update streak
    last = user.get("last_checkin")
    if last:
        last_date = datetime.fromisoformat(last).date()
        if last_date == today:
            # Already checked in today
            return {"status": "already_checked_in", "user": user}
        elif last_date == today - timedelta(days=1):
            user["streak"] += 1
        else:
            user["streak"] = 1  # Streak broken
    else:
        user["streak"] = 1

    user["last_checkin"] = now.isoformat()
    user["check_count"] += 1

    # Record actions
    if wore_mask:
        user["masked_days"] += 1
    if stayed_indoors and current_aqi > 200:
        user["indoor_days"] += 1

    user["actions"].append({
        "date": today.isoformat(),
        "aqi": current_aqi,
        "wore_mask": wore_mask,
        "stayed_indoors": stayed_indoors,
    })

    # Check for new badges
    new_badges = _evaluate_badges(user)

    return {
        "status": "checked_in",
        "streak": user["streak"],
        "check_count": user["check_count"],
        "new_badges": new_badges,
        "user": user,
    }


def _evaluate_badges(user: dict) -> list[dict]:
    """Check which badges the user has newly earned."""
    existing_ids = {b["id"] for b in user.get("badges", [])}
    new_badges = []

    for badge in BADGE_DEFS:
        if badge["id"] in existing_ids:
            continue

        earned = False

        if badge["id"] == "masked-7" and user["masked_days"] >= 7:
            earned = True
        elif badge["id"] == "stayed-in-red" and user["indoor_days"] >= 1:
            earned = True
        elif badge["id"] == "streak-30" and user["streak"] >= 30:
            earned = True
        elif badge["id"] == "streak-7" and user["streak"] >= 7:
            earned = True
        elif badge["id"] == "school-guard" and user["school_checks"] >= 15:
            earned = True
        elif badge["id"] == "community-star" and user["reports_submitted"] >= 5:
            earned = True
        elif badge["id"] == "early-bird" and user["check_count"] >= 5:
            earned = True

        if earned:
            badge_record = {**badge, "earned_at": datetime.now(IST).isoformat()}
            user["badges"].append(badge_record)
            new_badges.append(badge_record)

    return new_badges


def get_user_profile(session_id: str, city_id: str) -> dict:
    user = get_or_create_user(session_id, city_id)
    return {
        "streak": user["streak"],
        "check_count": user["check_count"],
        "badges": user["badges"],
        "masked_days": user["masked_days"],
        "indoor_days": user["indoor_days"],
        "all_badge_defs": BADGE_DEFS,
        "progress": _badge_progress(user),
        "rank": _get_rank(user["streak"]),
    }


def _badge_progress(user: dict) -> list[dict]:
    """Return progress toward unearned badges."""
    earned_ids = {b["id"] for b in user.get("badges", [])}
    progress = []

    for badge in BADGE_DEFS:
        if badge["id"] in earned_ids:
            continue

        current = 0
        required = badge.get("days_required", 1)

        if badge["id"] == "masked-7":
            current = user["masked_days"]
        elif badge["id"] == "stayed-in-red":
            current = user["indoor_days"]
        elif badge["id"] == "streak-30":
            current = user["streak"]
        elif badge["id"] == "school-guard":
            current = user["school_checks"]
        elif badge["id"] == "community-star":
            current = user["reports_submitted"]
        elif badge["id"] == "early-bird":
            current = user["check_count"]

        progress.append({
            **badge,
            "current": current,
            "required": required,
            "percent": min(100, round(current / required * 100)),
        })

    return progress


def _get_rank(streak: int) -> dict:
    if streak >= 60:
        return {"title": "Air Guardian", "icon": "🏆", "color": "#ffd700"}
    elif streak >= 30:
        return {"title": "Clean Air Champion", "icon": "🥇", "color": "#c0c0c0"}
    elif streak >= 14:
        return {"title": "Streak Keeper", "icon": "🔥", "color": "#ff6b35"}
    elif streak >= 7:
        return {"title": "Week Warrior", "icon": "⭐", "color": "#4fc3f7"}
    elif streak >= 3:
        return {"title": "Getting Started", "icon": "🌱", "color": "#66bb6a"}
    else:
        return {"title": "Newcomer", "icon": "👋", "color": "#9e9e9e"}


def get_city_score(city_id: str) -> dict:
    """
    Community city cleanliness score.
    Based on: actions reported, compliance rate, streak data.
    In production: aggregate from real user data.
    """
    from utils.mock_data import get_community_data
    data = get_community_data(city_id)

    score = data["score"]
    return {
        "city_id": city_id,
        "score": score,
        "grade": _score_grade(score),
        "reporters_today": data["reporters"],
        "masked_today": data["masked_today"],
        "trend": "improving" if score > 65 else ("declining" if score < 50 else "stable"),
        "message": _city_score_message(score, city_id),
    }


def _score_grade(score: int) -> dict:
    if score >= 80:
        return {"letter": "A", "color": "#00b050", "label": "Excellent"}
    elif score >= 65:
        return {"letter": "B", "color": "#92d050", "label": "Good"}
    elif score >= 50:
        return {"letter": "C", "color": "#ffbf00", "label": "Average"}
    elif score >= 35:
        return {"letter": "D", "color": "#ff6600", "label": "Below Average"}
    else:
        return {"letter": "F", "color": "#cc0000", "label": "Poor"}


def _city_score_message(score: int, city_id: str) -> str:
    name = city_id.replace("-", " ").title()
    if score >= 75:
        return f"{name} is doing great! Community compliance is high. 🌟"
    elif score >= 55:
        return f"{name} is making progress. Keep masking up on bad air days."
    else:
        return f"{name} needs more community action. Report air quality, stay safe."