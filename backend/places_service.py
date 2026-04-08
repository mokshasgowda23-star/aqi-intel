"""
backend/places_service.py
--------------------------
Indoor venue finder for bad air quality days.
Finds gyms, malls, indoor parks, cafés, and co-working spaces.

When AQI is poor, this service suggests places where people can:
  - Exercise indoors (gyms, swimming pools, squash courts)
  - Spend leisure time (malls, cafés, museums)
  - Work in clean air (co-working spaces)
  - Kids activities (indoor play zones, libraries)

Priority: Google Places API → curated city data → generic fallback
"""

import os
import json
import math
import requests
from pathlib import Path

GOOGLE_PLACES_BASE = "https://maps.googleapis.com/maps/api/place"
DATA_DIR = Path(__file__).parent.parent / "data"

# ── Venue type definitions ──────────────────────────────────────────────────
VENUE_TYPES = {
    "gym": {
        "label": "Gym / Fitness",
        "icon": "🏋️",
        "google_type": "gym",
        "why": "Climate-controlled, filtered air, full workout possible",
        "aqi_trigger": 100,          # Suggest gyms when AQI > 100
    },
    "mall": {
        "label": "Shopping Mall",
        "icon": "🏬",
        "google_type": "shopping_mall",
        "why": "AC-filtered air, walking space, food options",
        "aqi_trigger": 150,
    },
    "swimming_pool": {
        "label": "Swimming Pool",
        "icon": "🏊",
        "google_type": "swimming_pool",
        "why": "Water environment filters surrounding air, great cardio",
        "aqi_trigger": 100,
    },
    "museum": {
        "label": "Museum / Gallery",
        "icon": "🏛️",
        "google_type": "museum",
        "why": "Spacious indoor environment with climate control",
        "aqi_trigger": 150,
    },
    "cafe": {
        "label": "Café (Indoor)",
        "icon": "☕",
        "google_type": "cafe",
        "why": "Work remotely or relax indoors with good air",
        "aqi_trigger": 150,
    },
    "library": {
        "label": "Library",
        "icon": "📚",
        "google_type": "library",
        "why": "Quiet, clean-air space — perfect for study or reading",
        "aqi_trigger": 150,
    },
    "coworking": {
        "label": "Co-working Space",
        "icon": "💻",
        "google_type": "coworking_space",
        "why": "Work without stepping into polluted air",
        "aqi_trigger": 150,
    },
    "indoor_play": {
        "label": "Kids Indoor Play",
        "icon": "🧸",
        "google_type": "amusement_center",
        "why": "Safe, fun space for kids on bad air days",
        "aqi_trigger": 150,
    },
}

# ── Curated venue data (used when Google Places unavailable) ─────────────────
CURATED_VENUES = {
    "delhi": [
        {
            "id": "dl-001", "name": "Cult.fit Connaught Place", "type": "gym",
            "area": "Connaught Place", "lat": 28.6315, "lon": 77.2167,
            "rating": 4.4, "price_range": "₹₹", "ac": True,
            "opening_hours": "6:00 AM – 10:00 PM",
            "highlights": ["Air-purified studio", "Group classes", "Personal trainers"],
            "phone": "+91-9999-000000", "maps_url": "https://maps.google.com/?q=Cult.fit+Connaught+Place"
        },
        {
            "id": "dl-002", "name": "Select CITYWALK Mall", "type": "mall",
            "area": "Saket", "lat": 28.5274, "lon": 77.2194,
            "rating": 4.5, "price_range": "₹₹₹", "ac": True,
            "opening_hours": "11:00 AM – 10:00 PM",
            "highlights": ["400+ stores", "Food court", "Multiplex cinema"],
            "phone": "+91-11-29569898", "maps_url": "https://maps.google.com/?q=Select+Citywalk+Saket"
        },
        {
            "id": "dl-003", "name": "India Habitat Centre", "type": "museum",
            "area": "Lodhi Road", "lat": 28.5908, "lon": 77.2225,
            "rating": 4.6, "price_range": "₹", "ac": True,
            "opening_hours": "9:00 AM – 9:00 PM",
            "highlights": ["Art galleries", "Green campus", "Café inside"],
            "phone": "+91-11-24682222", "maps_url": "https://maps.google.com/?q=India+Habitat+Centre"
        },
        {
            "id": "dl-004", "name": "DLF Mall of India", "type": "mall",
            "area": "Noida Sector 18", "lat": 28.5700, "lon": 77.3219,
            "rating": 4.4, "price_range": "₹₹₹", "ac": True,
            "opening_hours": "10:00 AM – 11:00 PM",
            "highlights": ["Largest mall in India", "Ice skating rink", "15-screen cinema"],
            "phone": "+91-120-6682100", "maps_url": "https://maps.google.com/?q=DLF+Mall+of+India+Noida"
        },
        {
            "id": "dl-005", "name": "Siri Fort Sports Complex (Aquatics)", "type": "swimming_pool",
            "area": "Siri Fort", "lat": 28.5490, "lon": 77.2182,
            "rating": 4.1, "price_range": "₹", "ac": False,
            "opening_hours": "6:00 AM – 8:00 PM",
            "highlights": ["Olympic-size pool", "Government facility", "Affordable entry"],
            "phone": "+91-11-26497310", "maps_url": "https://maps.google.com/?q=Siri+Fort+Sports+Complex"
        },
        {
            "id": "dl-006", "name": "National Museum", "type": "museum",
            "area": "Janpath", "lat": 28.6127, "lon": 77.2200,
            "rating": 4.3, "price_range": "₹", "ac": True,
            "opening_hours": "10:00 AM – 6:00 PM (Closed Mon)",
            "highlights": ["5000 years of Indian history", "Air-conditioned galleries"],
            "phone": "+91-11-23019272", "maps_url": "https://maps.google.com/?q=National+Museum+Delhi"
        },
        {
            "id": "dl-007", "name": "Digipreneur (Co-working)", "type": "coworking",
            "area": "Nehru Place", "lat": 28.5491, "lon": 77.2529,
            "rating": 4.2, "price_range": "₹₹", "ac": True,
            "opening_hours": "8:00 AM – 10:00 PM",
            "highlights": ["High-speed WiFi", "Meeting rooms", "Air-purified space"],
            "maps_url": "https://maps.google.com/?q=Digipreneur+Coworking+Nehru+Place"
        },
        {
            "id": "dl-008", "name": "Smaaash Entertainment", "type": "indoor_play",
            "area": "Pacific Mall, Jasola", "lat": 28.5350, "lon": 77.2820,
            "rating": 4.0, "price_range": "₹₹", "ac": True,
            "opening_hours": "11:00 AM – 10:00 PM",
            "highlights": ["VR games", "Cricket simulators", "Great for kids & teens"],
            "maps_url": "https://maps.google.com/?q=Smaaash+Pacific+Mall+Jasola"
        },
    ],
    "bengaluru": [
        {
            "id": "blr-001", "name": "Cult.fit Koramangala", "type": "gym",
            "area": "Koramangala", "lat": 12.9352, "lon": 77.6245,
            "rating": 4.5, "price_range": "₹₹", "ac": True,
            "opening_hours": "5:30 AM – 10:00 PM",
            "highlights": ["Air-purified studio", "HIIT & yoga classes", "Shower facility"],
            "maps_url": "https://maps.google.com/?q=Cult.fit+Koramangala"
        },
        {
            "id": "blr-002", "name": "Phoenix MarketCity", "type": "mall",
            "area": "Whitefield", "lat": 12.9977, "lon": 77.6961,
            "rating": 4.4, "price_range": "₹₹₹", "ac": True,
            "opening_hours": "10:00 AM – 10:00 PM",
            "highlights": ["7-screen multiplex", "International brands", "Sky dining"],
            "maps_url": "https://maps.google.com/?q=Phoenix+MarketCity+Whitefield"
        },
        {
            "id": "blr-003", "name": "Lalbagh Botanical Garden (Glasshouse)", "type": "museum",
            "area": "Lalbagh", "lat": 12.9507, "lon": 77.5848,
            "rating": 4.7, "price_range": "₹", "ac": False,
            "opening_hours": "6:00 AM – 7:00 PM",
            "highlights": ["Victorian glasshouse", "250-year-old trees", "Peaceful walks"],
            "maps_url": "https://maps.google.com/?q=Lalbagh+Botanical+Garden"
        },
        {
            "id": "blr-004", "name": "Inkmonk Café & Library", "type": "cafe",
            "area": "Indiranagar", "lat": 12.9784, "lon": 77.6408,
            "rating": 4.4, "price_range": "₹₹", "ac": True,
            "opening_hours": "8:00 AM – 10:00 PM",
            "highlights": ["Books + specialty coffee", "Work-friendly", "AC interior"],
            "maps_url": "https://maps.google.com/?q=Indiranagar+Cafe"
        },
        {
            "id": "blr-005", "name": "91Springboard HSR Layout", "type": "coworking",
            "area": "HSR Layout", "lat": 12.9081, "lon": 77.6476,
            "rating": 4.3, "price_range": "₹₹", "ac": True,
            "opening_hours": "8:00 AM – 11:00 PM",
            "highlights": ["Hot desks", "Conference rooms", "High-speed internet"],
            "maps_url": "https://maps.google.com/?q=91Springboard+HSR+Layout"
        },
        {
            "id": "blr-006", "name": "Smaaash Bengaluru", "type": "indoor_play",
            "area": "MG Road", "lat": 12.9750, "lon": 77.6057,
            "rating": 3.9, "price_range": "₹₹", "ac": True,
            "opening_hours": "11:00 AM – 11:00 PM",
            "highlights": ["Sports simulators", "Bowling", "Great for families"],
            "maps_url": "https://maps.google.com/?q=Smaaash+Bengaluru"
        },
        {
            "id": "blr-007", "name": "BBMP Swimming Pool (Koramangala)", "type": "swimming_pool",
            "area": "Koramangala", "lat": 12.9301, "lon": 77.6241,
            "rating": 4.0, "price_range": "₹", "ac": False,
            "opening_hours": "6:00 AM – 8:30 PM",
            "highlights": ["Olympic-size pool", "Affordable", "Coaching available"],
            "maps_url": "https://maps.google.com/?q=BBMP+Swimming+Pool+Koramangala"
        },
    ],
    "mumbai": [
        {
            "id": "mum-001", "name": "Palladium Mall", "type": "mall",
            "area": "Lower Parel", "lat": 18.9973, "lon": 72.8269,
            "rating": 4.6, "price_range": "₹₹₹₹", "ac": True,
            "opening_hours": "11:00 AM – 10:00 PM",
            "highlights": ["Luxury brands", "Fine dining", "Air-conditioned throughout"],
            "maps_url": "https://maps.google.com/?q=Palladium+Mall+Lower+Parel"
        },
        {
            "id": "mum-002", "name": "Cult.fit Bandra West", "type": "gym",
            "area": "Bandra West", "lat": 19.0596, "lon": 72.8295,
            "rating": 4.4, "price_range": "₹₹", "ac": True,
            "opening_hours": "6:00 AM – 10:00 PM",
            "highlights": ["Multiple workout formats", "Air-conditioned", "Sea-view building"],
            "maps_url": "https://maps.google.com/?q=Cult.fit+Bandra+West"
        },
        {
            "id": "mum-003", "name": "Chhatrapati Shivaji Maharaj Vastu Sangrahalaya", "type": "museum",
            "area": "Colaba", "lat": 18.9267, "lon": 72.8328,
            "rating": 4.6, "price_range": "₹₹", "ac": True,
            "opening_hours": "10:15 AM – 6:00 PM (Closed Mon)",
            "highlights": ["Colonial architecture", "Rare artefacts", "Fully air-conditioned"],
            "maps_url": "https://maps.google.com/?q=CSMVS+Mumbai"
        },
        {
            "id": "mum-004", "name": "Powai Lake Club (Indoor Pool)", "type": "swimming_pool",
            "area": "Powai", "lat": 19.1176, "lon": 72.9060,
            "rating": 4.2, "price_range": "₹₹₹", "ac": False,
            "opening_hours": "6:00 AM – 8:00 PM",
            "highlights": ["Lakeside setting", "Clean pool", "Coaching available"],
            "maps_url": "https://maps.google.com/?q=Powai+Lake+Swimming"
        },
        {
            "id": "mum-005", "name": "Versova Koliwada Café (Indoor)", "type": "cafe",
            "area": "Andheri West", "lat": 19.1280, "lon": 72.8180,
            "rating": 4.3, "price_range": "₹₹", "ac": True,
            "opening_hours": "8:00 AM – 11:00 PM",
            "highlights": ["Work-friendly", "Great coffee", "Indoor seating"],
            "maps_url": "https://maps.google.com/?q=Andheri+West+Cafe"
        },
        {
            "id": "mum-006", "name": "WeWork BKC", "type": "coworking",
            "area": "Bandra Kurla Complex", "lat": 19.0700, "lon": 72.8697,
            "rating": 4.4, "price_range": "₹₹₹", "ac": True,
            "opening_hours": "7:00 AM – 10:00 PM",
            "highlights": ["Premium coworking", "Floor-to-ceiling AC", "Stunning city views"],
            "maps_url": "https://maps.google.com/?q=WeWork+BKC+Mumbai"
        },
    ],
    "hyderabad": [
        {
            "id": "hyd-001", "name": "GVK One Mall", "type": "mall",
            "area": "Banjara Hills", "lat": 17.4239, "lon": 78.4481,
            "rating": 4.3, "price_range": "₹₹₹", "ac": True,
            "opening_hours": "10:00 AM – 10:00 PM",
            "highlights": ["Premium brands", "Food court", "Entertainment zone"],
            "maps_url": "https://maps.google.com/?q=GVK+One+Mall+Hyderabad"
        },
        {
            "id": "hyd-002", "name": "Anytime Fitness HiTech City", "type": "gym",
            "area": "HiTech City", "lat": 17.4435, "lon": 78.3772,
            "rating": 4.3, "price_range": "₹₹", "ac": True,
            "opening_hours": "Open 24/7",
            "highlights": ["24/7 access", "Modern equipment", "Air-conditioned"],
            "maps_url": "https://maps.google.com/?q=Anytime+Fitness+HiTech+City"
        },
        {
            "id": "hyd-003", "name": "Salar Jung Museum", "type": "museum",
            "area": "Dar-ul-Shifa", "lat": 17.3711, "lon": 78.4805,
            "rating": 4.4, "price_range": "₹", "ac": True,
            "opening_hours": "10:00 AM – 5:00 PM (Closed Fri)",
            "highlights": ["One of largest museums in India", "Air-conditioned halls"],
            "maps_url": "https://maps.google.com/?q=Salar+Jung+Museum+Hyderabad"
        },
        {
            "id": "hyd-004", "name": "T-Hub (Co-working)", "type": "coworking",
            "area": "IIIT Campus, Gachibowli", "lat": 17.4401, "lon": 78.3489,
            "rating": 4.5, "price_range": "₹₹", "ac": True,
            "opening_hours": "9:00 AM – 9:00 PM",
            "highlights": ["India's largest startup incubator", "Excellent AC", "Networking events"],
            "maps_url": "https://maps.google.com/?q=T-Hub+Hyderabad"
        },
    ],
    "kolkata": [
        {
            "id": "kol-001", "name": "South City Mall", "type": "mall",
            "area": "Jadavpur", "lat": 22.4997, "lon": 88.3714,
            "rating": 4.3, "price_range": "₹₹", "ac": True,
            "opening_hours": "10:00 AM – 10:00 PM",
            "highlights": ["Popular mall", "Food court", "Multiplex cinema"],
            "maps_url": "https://maps.google.com/?q=South+City+Mall+Kolkata"
        },
        {
            "id": "kol-002", "name": "Talkatora Indoor Stadium (Swimming)", "type": "swimming_pool",
            "area": "Salt Lake", "lat": 22.5775, "lon": 88.4177,
            "rating": 4.0, "price_range": "₹", "ac": False,
            "opening_hours": "6:00 AM – 8:00 PM",
            "highlights": ["SAI facility", "Affordable", "Olympic-standard"],
            "maps_url": "https://maps.google.com/?q=Sarojini+Naidu+Pool+Kolkata"
        },
        {
            "id": "kol-003", "name": "Victoria Memorial", "type": "museum",
            "area": "Maidan", "lat": 22.5448, "lon": 88.3426,
            "rating": 4.6, "price_range": "₹", "ac": True,
            "opening_hours": "10:00 AM – 5:00 PM (Closed Mon)",
            "highlights": ["Iconic heritage building", "Colonial artefacts", "Air-conditioned gallery"],
            "maps_url": "https://maps.google.com/?q=Victoria+Memorial+Kolkata"
        },
    ],
    "chennai": [
        {
            "id": "che-001", "name": "Phoenix MarketCity Chennai", "type": "mall",
            "area": "Velachery", "lat": 12.9815, "lon": 80.2180,
            "rating": 4.4, "price_range": "₹₹₹", "ac": True,
            "opening_hours": "10:00 AM – 10:00 PM",
            "highlights": ["Premium brands", "Food court", "Entertainment zone"],
            "maps_url": "https://maps.google.com/?q=Phoenix+MarketCity+Chennai"
        },
        {
            "id": "che-002", "name": "Government Museum Chennai", "type": "museum",
            "area": "Egmore", "lat": 13.0721, "lon": 80.2650,
            "rating": 4.2, "price_range": "₹", "ac": True,
            "opening_hours": "9:30 AM – 5:00 PM (Closed Wed)",
            "highlights": ["Second oldest museum in India", "Bronze gallery", "AC halls"],
            "maps_url": "https://maps.google.com/?q=Government+Museum+Chennai"
        },
        {
            "id": "che-003", "name": "Cult.fit Anna Nagar", "type": "gym",
            "area": "Anna Nagar", "lat": 13.0850, "lon": 80.2101,
            "rating": 4.4, "price_range": "₹₹", "ac": True,
            "opening_hours": "5:30 AM – 10:00 PM",
            "highlights": ["Multiple formats", "Air-conditioned", "Certified trainers"],
            "maps_url": "https://maps.google.com/?q=Cult.fit+Anna+Nagar+Chennai"
        },
    ],
    "pune": [
        {
            "id": "pun-001", "name": "Phoenix Marketcity Pune", "type": "mall",
            "area": "Nagar Road", "lat": 18.5584, "lon": 73.9279,
            "rating": 4.4, "price_range": "₹₹₹", "ac": True,
            "opening_hours": "10:00 AM – 10:00 PM",
            "highlights": ["400+ brands", "Food court", "Gaming zone"],
            "maps_url": "https://maps.google.com/?q=Phoenix+Marketcity+Pune"
        },
        {
            "id": "pun-002", "name": "Aga Khan Palace Museum", "type": "museum",
            "area": "Kalyani Nagar", "lat": 18.5530, "lon": 73.9012,
            "rating": 4.5, "price_range": "₹", "ac": True,
            "opening_hours": "9:00 AM – 5:30 PM",
            "highlights": ["Gandhi memorial", "Lush gardens", "AC gallery"],
            "maps_url": "https://maps.google.com/?q=Aga+Khan+Palace+Pune"
        },
        {
            "id": "pun-003", "name": "Anytime Fitness Hinjewadi", "type": "gym",
            "area": "Hinjewadi", "lat": 18.5912, "lon": 73.7389,
            "rating": 4.2, "price_range": "₹₹", "ac": True,
            "opening_hours": "Open 24/7",
            "highlights": ["24/7 access", "Tech park location", "AC throughout"],
            "maps_url": "https://maps.google.com/?q=Anytime+Fitness+Hinjewadi"
        },
        {
            "id": "pun-004", "name": "91Springboard Baner", "type": "coworking",
            "area": "Baner", "lat": 18.5591, "lon": 73.7868,
            "rating": 4.3, "price_range": "₹₹", "ac": True,
            "opening_hours": "8:00 AM – 10:00 PM",
            "highlights": ["Ergonomic seating", "High-speed WiFi", "Air-conditioned"],
            "maps_url": "https://maps.google.com/?q=91Springboard+Baner+Pune"
        },
    ],
    "ahmedabad": [
        {
            "id": "ahm-001", "name": "Palladium Mall Ahmedabad", "type": "mall",
            "area": "Prahlad Nagar", "lat": 23.0210, "lon": 72.5089,
            "rating": 4.3, "price_range": "₹₹₹", "ac": True,
            "opening_hours": "10:00 AM – 10:00 PM",
            "highlights": ["Premium brands", "Fine dining", "Indoor entertainment"],
            "maps_url": "https://maps.google.com/?q=Palladium+Mall+Ahmedabad"
        },
        {
            "id": "ahm-002", "name": "Calico Museum of Textiles", "type": "museum",
            "area": "Shahibaug", "lat": 23.0390, "lon": 72.5890,
            "rating": 4.7, "price_range": "₹", "ac": True,
            "opening_hours": "10:30 AM – 1:00 PM, 2:30–5:00 PM (Thu–Tue)",
            "highlights": ["World-class textile collection", "AC galleries", "Guided tours"],
            "maps_url": "https://maps.google.com/?q=Calico+Museum+Ahmedabad"
        },
        {
            "id": "ahm-003", "name": "Snap Fitness Navrangpura", "type": "gym",
            "area": "Navrangpura", "lat": 23.0395, "lon": 72.5600,
            "rating": 4.1, "price_range": "₹₹", "ac": True,
            "opening_hours": "5:00 AM – 11:00 PM",
            "highlights": ["Good equipment", "AC", "Reasonable pricing"],
            "maps_url": "https://maps.google.com/?q=Snap+Fitness+Navrangpura+Ahmedabad"
        },
    ],
}


def get_venues_for_city(city_id: str, aqi: int,
                         venue_types: list[str] = None,
                         max_results: int = 8) -> dict:
    """
    Get indoor venue suggestions for a city based on current AQI.

    venue_types: filter to specific types e.g. ["gym", "mall"]
    Returns venues relevant to the current AQI level.
    """
    all_venues = CURATED_VENUES.get(city_id, [])

    # Filter by relevant venue types for this AQI level
    relevant_types = _get_relevant_types(aqi)
    if venue_types:
        relevant_types = [t for t in relevant_types if t in venue_types]

    filtered = [v for v in all_venues if v["type"] in relevant_types]

    # Sort: AC venues first, then by rating
    filtered.sort(key=lambda v: (not v.get("ac", False), -v.get("rating", 0)))
    filtered = filtered[:max_results]

    # Try to enrich with live Google Places data
    api_key = os.getenv("GOOGLE_PLACES_KEY")
    if api_key and filtered:
        filtered = _enrich_with_google(filtered, api_key)

    return {
        "city_id": city_id,
        "aqi": aqi,
        "venues": [_format_venue(v) for v in filtered],
        "relevant_types": relevant_types,
        "type_definitions": {t: VENUE_TYPES[t] for t in relevant_types if t in VENUE_TYPES},
        "source": "curated",
        "why_indoors": _why_indoors_message(aqi),
    }


def search_venues_near(city_id: str, lat: float, lon: float,
                        venue_type: str, aqi: int,
                        radius_m: int = 3000) -> list[dict]:
    """
    Search for venues near a specific location using Google Places API.
    Falls back to curated data sorted by distance.
    """
    api_key = os.getenv("GOOGLE_PLACES_KEY")

    if api_key:
        try:
            return _google_nearby_search(lat, lon, venue_type, api_key, radius_m)
        except Exception as e:
            print(f"[places_service] Google Places failed: {e}")

    # Fallback: filter curated by distance
    all_venues = CURATED_VENUES.get(city_id, [])
    typed = [v for v in all_venues if v["type"] == venue_type]
    typed_with_dist = [
        {**v, "distance_km": _haversine(lat, lon, v["lat"], v["lon"])}
        for v in typed
    ]
    typed_with_dist.sort(key=lambda v: v["distance_km"])
    return [_format_venue(v) for v in typed_with_dist[:5]]


def get_venue_by_id(venue_id: str) -> dict | None:
    """Get a specific venue by its ID."""
    for city_venues in CURATED_VENUES.values():
        for venue in city_venues:
            if venue["id"] == venue_id:
                return _format_venue(venue)
    return None


def get_venues_by_type(city_id: str, venue_type: str) -> list[dict]:
    """Get all venues of a specific type in a city."""
    all_venues = CURATED_VENUES.get(city_id, [])
    return [_format_venue(v) for v in all_venues if v["type"] == venue_type]


# ── Private helpers ──────────────────────────────────────────────────────────

def _get_relevant_types(aqi: int) -> list[str]:
    """Return venue types relevant to this AQI level."""
    return [
        vtype for vtype, vdata in VENUE_TYPES.items()
        if aqi >= vdata["aqi_trigger"]
    ]


def _format_venue(v: dict) -> dict:
    """Standardize venue format for API responses."""
    vtype = v.get("type", "gym")
    type_data = VENUE_TYPES.get(vtype, {})
    return {
        "id": v.get("id"),
        "name": v["name"],
        "type": vtype,
        "type_label": type_data.get("label", vtype.replace("_", " ").title()),
        "icon": type_data.get("icon", "🏢"),
        "area": v.get("area", ""),
        "lat": v.get("lat"),
        "lon": v.get("lon"),
        "rating": v.get("rating"),
        "price_range": v.get("price_range", "₹₹"),
        "ac": v.get("ac", True),
        "opening_hours": v.get("opening_hours", ""),
        "highlights": v.get("highlights", []),
        "phone": v.get("phone"),
        "maps_url": v.get("maps_url"),
        "why": type_data.get("why", "Clean indoor environment"),
        "distance_km": v.get("distance_km"),
    }


def _why_indoors_message(aqi: int) -> str:
    if aqi > 300:
        return "Severe AQI — outdoor exposure is dangerous. These venues offer clean, filtered air."
    elif aqi > 200:
        return "Poor air quality — stay indoors as much as possible. These are your best options."
    elif aqi > 150:
        return "Moderate AQI — good day to move workouts and leisure time indoors."
    else:
        return "AQI is borderline — indoor options available if you want to be cautious."


def _haversine(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate distance in km between two lat/lon points."""
    R = 6371
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    a = (math.sin(dlat / 2) ** 2 +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) ** 2)
    return round(R * 2 * math.asin(math.sqrt(a)), 2)


def _google_nearby_search(lat: float, lon: float, venue_type: str,
                           api_key: str, radius_m: int) -> list[dict]:
    """Search Google Places API for nearby venues."""
    google_type = VENUE_TYPES.get(venue_type, {}).get("google_type", venue_type)
    url = f"{GOOGLE_PLACES_BASE}/nearbysearch/json"
    params = {
        "location": f"{lat},{lon}",
        "radius": radius_m,
        "type": google_type,
        "key": api_key,
    }
    resp = requests.get(url, params=params, timeout=8)
    resp.raise_for_status()
    data = resp.json()

    results = []
    for place in data.get("results", [])[:6]:
        loc = place.get("geometry", {}).get("location", {})
        results.append({
            "id": place.get("place_id"),
            "name": place.get("name"),
            "type": venue_type,
            "area": place.get("vicinity", ""),
            "lat": loc.get("lat"),
            "lon": loc.get("lng"),
            "rating": place.get("rating"),
            "price_range": "₹" * (place.get("price_level", 2) or 2),
            "ac": True,  # Assume AC for Places results
            "opening_hours": "",
            "highlights": [],
            "maps_url": f"https://maps.google.com/?place_id={place.get('place_id')}",
            "distance_km": _haversine(lat, lon, loc.get("lat", lat), loc.get("lng", lon)),
        })
    return [_format_venue(r) for r in results]


def _enrich_with_google(venues: list[dict], api_key: str) -> list[dict]:
    """
    Optionally enrich curated venues with live Google Places details
    (ratings, current hours). Silently falls back on failure.
    """
    enriched = []
    for venue in venues:
        try:
            url = f"{GOOGLE_PLACES_BASE}/findplacefromtext/json"
            params = {
                "input": venue["name"],
                "inputtype": "textquery",
                "fields": "rating,opening_hours,place_id",
                "locationbias": f"point:{venue.get('lat')},{venue.get('lon')}",
                "key": api_key,
            }
            resp = requests.get(url, params=params, timeout=4)
            data = resp.json()
            candidates = data.get("candidates", [])
            if candidates:
                c = candidates[0]
                if c.get("rating"):
                    venue = {**venue, "rating": c["rating"]}
                if c.get("place_id"):
                    venue = {**venue, "maps_url": f"https://maps.google.com/?place_id={c['place_id']}"}
        except Exception:
            pass
        enriched.append(venue)
    return enriched