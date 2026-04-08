# 🌫️ AQI Intelligence — India

A personalized air quality intelligence tool built for Indian cities.
Not just numbers — your daily life guide based on the air you breathe.

## Project Structure

```
aqi-intel/
├── app.py                    # Flask entry point (thin — just routes)
├── requirements.txt
├── README.md
│
├── backend/
│   ├── aqi_service.py        # AQI fetching & zone heatmap data
│   ├── forecast_service.py   # 12-hour AQI forecast + best time to go outside
│   ├── activity_service.py   # Outdoor activity intelligence (run/walk/cycle)
│   ├── alert_service.py      # Threshold alerts & notification logic
│   ├── calendar_service.py   # Good air days calendar
│   ├── community_service.py  # Streaks, badges, city cleanliness score
│   ├── daily_brief.py        # "Wear a mask, skip the jog" daily briefing
│   ├── places_service.py     # Indoor venues (gyms, cafés, malls) finder
│   └── school_mode.py        # Kids/school mode — recess safety
│   └── health_profile.py 
|   └── unique_features.py
├── data/
│   ├── cities.json           # Indian cities + zones/neighborhoods
│   ├── badges.json           # Badge definitions
│   └── thresholds.json       # AQI category thresholds (India NAQI)
│
├── utils/
│   ├── aqi_calculator.py     # NAQI calculation helpers
│   ├── weather_mapper.py     # Map weather + AQI to recommendations
│   └── mock_data.py          # Realistic mock data for demo/offline use
│
└── frontend/
    ├── index.html            # Main SPA shell
    |   └── static/
    |   └── app.js   
    ├── styles/
    │   ├── main.css          # Global styles, CSS variables, typography
    │   ├── heatmap.css       # Zone heatmap styles
    │   └── components.css    # Cards, badges, alerts
    ├── pages/
    │   ├── dashboard.js      # Main dashboard page
    │   ├── heatmap.js        # Zone heatmap view
    │   ├── forecast.js       # 12-hour forecast + best time
    │   ├── activities.js     # Outdoor activity intelligence
    │   ├── calendar.js       # Good air days calendar
    │   ├── community.js      # Streaks, badges, city score
    │   └── school.js         # Kids/school mode
    └── components/
        ├── aqi_gauge.js      # Circular AQI gauge component
        ├── alert_banner.js   # Alert system component
        ├── daily_brief.js    # Daily brief card
        └── nav.js            # Navigation
```

## Setup

```bash
pip install -r requirements.txt
python app.py
```

Open http://localhost:5000

## API Keys Needed
- WAQI API (World Air Quality Index): https://aqicn.org/api/
- OpenWeatherMap API (free tier works)
- Google Places API (for indoor venue finder)

Set in `.env`:
```
WAQI_TOKEN=your_token_here
OWM_API_KEY=your_key_here
GOOGLE_PLACES_KEY=your_key_here
```

## India NAQI Scale
| AQI     | Category       | Color  |
|---------|---------------|--------|
| 0-50    | Good          | Green  |
| 51-100  | Satisfactory  | Yellow |
| 101-200 | Moderate      | Orange |
| 201-300 | Poor          | Red    |
| 301-400 | Very Poor     | Purple |
| 401-500 | Severe        | Maroon |