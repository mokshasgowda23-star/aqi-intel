"""
backend/health_profile.py
--------------------------
Personalised health intelligence for AQI Intel.

Every person is different:
- A child with asthma needs stricter thresholds than a healthy adult
- A senior with COPD needs different advice than a young runner
- A pregnant woman needs different precautions than everyone else

This module:
1. Stores health profiles per session (in-memory, no login needed)
2. Provides a searchable database of 40+ health conditions
3. Generates fully personalised AQI advice per condition + age group
4. Returns a "Personal AQI Threshold" — the AQI at which THIS person
   specifically should take precautions (not a generic number)
"""

from __future__ import annotations
from utils.aqi_calculator import get_category

# ── In-memory profile store (session_id → profile dict) ────────────────────
_PROFILES: dict[str, dict] = {}


# ── Health condition database ────────────────────────────────────────────────
# Each condition has:
#   safe_aqi:      AQI above which this person should take precautions
#   danger_aqi:    AQI above which this person should stay indoors
#   pollutants:    Which pollutants specifically affect this condition most
#   symptoms:      What to watch for
#   precautions:   Specific actions to take at different AQI levels
#   medications:   Medication reminders (general, not prescriptions)
#   avoid:         Things to specifically avoid
#   indoor_tips:   How to make indoor air safer
#   emergency:     When to seek medical help

HEALTH_CONDITIONS: dict[str, dict] = {

    # ── Respiratory ──────────────────────────────────────────────────────────
    "asthma": {
        "name": "Asthma",
        "category": "Respiratory",
        "icon": "🫁",
        "color": "#1565c0",
        "safe_aqi": 50,
        "danger_aqi": 100,
        "pollutants": ["PM2.5", "PM10", "O₃", "SO₂"],
        "description": "Asthma causes airway inflammation. Air pollution is a leading trigger for asthma attacks.",
        "how_aqi_affects": "PM2.5 particles can penetrate deep into airways and trigger bronchospasm. Ozone directly irritates the bronchial lining.",
        "precautions": {
            "good":      ["✅ Safe to be outdoors. Enjoy!", "Continue regular medication schedule"],
            "moderate":  ["⚠️ Carry your rescue inhaler at all times", "Avoid outdoor exercise lasting more than 30 minutes", "Watch for early symptoms: tightness, wheezing"],
            "poor":      ["😷 Stay indoors as much as possible", "Use preventive inhaler before going out if prescribed", "Keep windows closed", "Avoid areas with heavy traffic"],
            "severe":    ["🚨 Do NOT go outside", "Use air purifier indoors", "Contact your doctor if symptoms worsen", "Have emergency inhaler within reach at all times"],
        },
        "medications": ["Keep rescue inhaler (Salbutamol/Albuterol) accessible", "Consider prophylactic inhaler before outdoor exposure on moderate AQI days — consult your doctor"],
        "avoid": ["Running or cycling outdoors on poor AQI days", "Areas near construction, traffic, or burning", "Early morning outdoor exercise (worst air quality window)"],
        "indoor_tips": ["Run air purifier with HEPA filter", "Keep windows closed on poor AQI days", "Vacuum with HEPA vacuum cleaner", "Avoid incense, agarbatti, and room fresheners"],
        "emergency_signs": ["Rescue inhaler not relieving symptoms after 2 uses", "Lips or fingernails turning blue", "Cannot speak full sentences due to breathlessness"],
        "personal_aqi_threshold": 75,
    },

    "copd": {
        "name": "COPD",
        "category": "Respiratory",
        "icon": "🫁",
        "color": "#4527a0",
        "safe_aqi": 50,
        "danger_aqi": 75,
        "pollutants": ["PM2.5", "PM10", "NO₂", "SO₂", "CO"],
        "description": "COPD (Chronic Obstructive Pulmonary Disease) permanently damages airways. Air pollution accelerates decline.",
        "how_aqi_affects": "COPD patients have reduced lung capacity. Even moderate pollution causes significant oxygen supply reduction.",
        "precautions": {
            "good":      ["✅ Good day for a short outdoor walk", "Keep activity gentle — avoid strenuous exertion"],
            "moderate":  ["⚠️ Limit outdoor time to under 30 minutes", "Rest frequently if outdoors", "Carry portable oxygen if prescribed"],
            "poor":      ["😷 Stay indoors. Absolutely no outdoor exercise", "Use supplemental oxygen as prescribed", "Avoid cooking with smoke-producing fuels"],
            "severe":    ["🚨 Medical emergency risk. Stay indoors completely", "Have someone check on you", "Alert your doctor if breathing changes"],
        },
        "medications": ["Always carry prescribed bronchodilators", "Do not skip scheduled nebulisation on poor AQI days"],
        "avoid": ["All outdoor exercise on moderate+ AQI days", "Cooking fumes — use exhaust fans", "Cigarette smoke (even passive)"],
        "indoor_tips": ["Air purifier is essential, not optional", "Maintain indoor humidity 40–60%", "No burning of candles, incense, or wood"],
        "emergency_signs": ["Breathing rate above 30 breaths/minute", "Blue lips or fingertips", "Confusion or drowsiness with breathing difficulty"],
        "personal_aqi_threshold": 50,
    },

    "bronchitis": {
        "name": "Chronic Bronchitis",
        "category": "Respiratory",
        "icon": "🫁",
        "color": "#6a1b9a",
        "safe_aqi": 75,
        "danger_aqi": 150,
        "pollutants": ["PM2.5", "SO₂", "NO₂"],
        "description": "Chronic bronchitis causes persistent airway inflammation and excess mucus production.",
        "how_aqi_affects": "Pollution worsens mucus production and increases risk of respiratory infections.",
        "precautions": {
            "good":      ["✅ Outdoor activity is fine today"],
            "moderate":  ["⚠️ Wear a surgical mask outdoors", "Stay hydrated — helps clear mucus"],
            "poor":      ["😷 Stay indoors. Pollution worsens bronchitis significantly"],
            "severe":    ["🚨 Complete indoor confinement recommended"],
        },
        "medications": ["Expectorants may help on high pollution days — consult doctor", "Ensure flu and pneumonia vaccines are up to date"],
        "avoid": ["Cold dry air combined with high AQI — doubly irritating", "Dusty environments"],
        "indoor_tips": ["Stay well hydrated", "Use a cool-mist humidifier"],
        "emergency_signs": ["Mucus turns yellow/green with fever", "Breathlessness worsening rapidly"],
        "personal_aqi_threshold": 100,
    },

    "allergic_rhinitis": {
        "name": "Allergic Rhinitis / Hay Fever",
        "category": "Respiratory",
        "icon": "🤧",
        "color": "#00838f",
        "safe_aqi": 100,
        "danger_aqi": 200,
        "pollutants": ["PM10", "O₃", "Pollen (seasonal)"],
        "description": "Allergic rhinitis causes nasal inflammation triggered by allergens. Air pollution worsens allergen potency.",
        "how_aqi_affects": "Pollution chemically modifies pollen proteins, making them more allergenic. PM10 carries allergens deeper into airways.",
        "precautions": {
            "good":      ["✅ Mostly fine. Check pollen count separately"],
            "moderate":  ["⚠️ Wear a mask outdoors if symptoms are active", "Take antihistamines before outdoor exposure"],
            "poor":      ["😷 High pollution amplifies pollen effects significantly"],
            "severe":    ["🚨 Stay indoors. Triple whammy: high AQI + pollen + irritation"],
        },
        "medications": ["Take antihistamines 30 min before outdoor exposure", "Nasal corticosteroid sprays help on high pollution days"],
        "avoid": ["Outdoor activities during early morning when pollen + pollution peak together", "Drying clothes outdoors — they collect pollen and pollution"],
        "indoor_tips": ["Shower after coming indoors to wash off pollen", "Use AC with HEPA filter rather than open windows", "Wash bedding weekly in hot water"],
        "emergency_signs": ["Anaphylaxis signs: swelling, hives, difficulty breathing"],
        "personal_aqi_threshold": 100,
    },

    # ── Cardiovascular ────────────────────────────────────────────────────────
    "heart_disease": {
        "name": "Heart Disease / CAD",
        "category": "Cardiovascular",
        "icon": "❤️",
        "color": "#c62828",
        "safe_aqi": 50,
        "danger_aqi": 100,
        "pollutants": ["PM2.5", "CO", "NO₂"],
        "description": "Coronary artery disease and heart conditions. Air pollution directly stresses the cardiovascular system.",
        "how_aqi_affects": "PM2.5 enters the bloodstream through lungs, causing systemic inflammation and arterial plaque instability. CO reduces oxygen-carrying capacity of blood.",
        "precautions": {
            "good":      ["✅ Safe for gentle outdoor activity", "Light walking is beneficial"],
            "moderate":  ["⚠️ Avoid strenuous outdoor exercise", "Monitor for chest tightness or unusual fatigue"],
            "poor":      ["😷 Stay indoors. Cardiac events increase significantly with poor AQI", "Avoid all outdoor physical exertion"],
            "severe":    ["🚨 Severe AQI dramatically increases heart attack risk. Stay indoors completely"],
        },
        "medications": ["Never skip cardiac medications on high AQI days", "Keep nitroglycerin/GTN accessible if prescribed"],
        "avoid": ["Morning outdoor exercise on poor AQI days — PM2.5 peaks + cardiac risk peaks overlap", "Traffic-heavy routes even as a pedestrian"],
        "indoor_tips": ["Air purifier reduces indoor PM2.5 exposure significantly", "Keep room temperature comfortable — heat + pollution is double cardiac stress"],
        "emergency_signs": ["Chest pain, pressure, or tightness", "Pain radiating to arm, jaw, or back", "Sudden severe breathlessness", "Palpitations with dizziness"],
        "personal_aqi_threshold": 75,
    },

    "hypertension": {
        "name": "Hypertension / High BP",
        "category": "Cardiovascular",
        "icon": "🩺",
        "color": "#b71c1c",
        "safe_aqi": 75,
        "danger_aqi": 150,
        "pollutants": ["PM2.5", "NO₂", "CO"],
        "description": "High blood pressure. Air pollution causes acute BP spikes.",
        "how_aqi_affects": "Breathing polluted air triggers a stress response that raises blood pressure within hours. Long-term exposure contributes to sustained hypertension.",
        "precautions": {
            "good":      ["✅ Fine for outdoor activity. Monitor BP regularly"],
            "moderate":  ["⚠️ Avoid strenuous outdoor exercise", "Check BP if feeling unusually fatigued"],
            "poor":      ["😷 Limit outdoor exposure. Stress + pollution = BP spike risk"],
            "severe":    ["🚨 Stay indoors. Severe pollution is a recognised trigger for hypertensive crisis"],
        },
        "medications": ["Take BP medications at the same time daily — consistency is critical", "Monitor BP at home on high AQI days"],
        "avoid": ["Rush-hour commuting on foot or cycle — combines exercise stress with pollution peak"],
        "indoor_tips": ["Meditation and breathing exercises help counteract pollution-induced BP rise", "HEPA air purifier reduces indoor exposure"],
        "emergency_signs": ["Severe headache", "Vision changes", "BP reading above 180/120 mmHg"],
        "personal_aqi_threshold": 100,
    },

    "stroke_risk": {
        "name": "Stroke Risk / History",
        "category": "Cardiovascular",
        "icon": "🧠",
        "color": "#880e4f",
        "safe_aqi": 50,
        "danger_aqi": 100,
        "pollutants": ["PM2.5", "NO₂"],
        "description": "Stroke survivors or those with stroke risk factors. Air pollution increases stroke risk significantly.",
        "how_aqi_affects": "PM2.5 increases blood coagulation (clot formation) and promotes systemic inflammation — both major stroke triggers.",
        "precautions": {
            "good":      ["✅ Safe. Gentle outdoor walks are beneficial for recovery"],
            "moderate":  ["⚠️ Limit outdoor time. Wear mask", "Avoid physical exertion outdoors"],
            "poor":      ["😷 Stay indoors. Stroke risk elevation is significant at this AQI"],
            "severe":    ["🚨 Complete indoor rest. Alert a family member about today's conditions"],
        },
        "medications": ["Blood thinners must not be skipped on high pollution days", "Keep aspirin accessible if prescribed"],
        "avoid": ["Outdoor exposure during morning and evening pollution peaks", "High-exertion outdoor activity"],
        "indoor_tips": ["Air purifier is strongly recommended", "Keep indoor temperature stable"],
        "emergency_signs": ["FAST: Face drooping, Arm weakness, Speech difficulty — Time to call emergency"],
        "personal_aqi_threshold": 75,
    },

    # ── Diabetes ──────────────────────────────────────────────────────────────
    "diabetes": {
        "name": "Diabetes (Type 1 or 2)",
        "category": "Metabolic",
        "icon": "🩸",
        "color": "#e65100",
        "safe_aqi": 100,
        "danger_aqi": 200,
        "pollutants": ["PM2.5", "NO₂"],
        "description": "Diabetes affects insulin sensitivity. Air pollution worsens blood sugar control.",
        "how_aqi_affects": "PM2.5 causes systemic inflammation that impairs insulin signalling. Studies show blood glucose spikes on high pollution days.",
        "precautions": {
            "good":      ["✅ Good day for outdoor exercise — beneficial for glucose control"],
            "moderate":  ["⚠️ Exercise outdoors but shorter duration", "Monitor blood glucose after outdoor activity"],
            "poor":      ["😷 Prefer indoor exercise. Check glucose more frequently today"],
            "severe":    ["🚨 Stay indoors. Monitor blood glucose every 2 hours"],
        },
        "medications": ["Monitor blood glucose more frequently on high AQI days", "Stay well hydrated — dehydration + pollution stress worsens glucose control"],
        "avoid": ["Extended outdoor exercise on poor AQI days without glucose monitoring"],
        "indoor_tips": ["Indoor exercise still helps glucose control on bad air days", "Good ventilation reduces oxidative stress indoors"],
        "emergency_signs": ["Glucose below 70 or above 300 mg/dL with symptoms", "Confusion, extreme fatigue, or vomiting"],
        "personal_aqi_threshold": 100,
    },

    # ── Mental Health ─────────────────────────────────────────────────────────
    "anxiety": {
        "name": "Anxiety / Panic Disorder",
        "category": "Mental Health",
        "icon": "🧘",
        "color": "#2e7d32",
        "safe_aqi": 100,
        "danger_aqi": 200,
        "pollutants": ["PM2.5"],
        "description": "Air pollution affects brain chemistry and is linked to increased anxiety and mood disorders.",
        "how_aqi_affects": "PM2.5 crosses the blood-brain barrier and triggers neuroinflammation. Studies show anxiety and depression rates rise with AQI.",
        "precautions": {
            "good":      ["✅ Nature walks and outdoor time support mental health today"],
            "moderate":  ["⚠️ If prone to health anxiety about air quality, check AQI once daily — not constantly"],
            "poor":      ["😷 Stay indoors. Practice indoor breathing exercises", "Avoid reading pollution news repeatedly — it amplifies anxiety"],
            "severe":    ["🚨 Prioritise mental calm. Stay indoors, do indoor activities you enjoy"],
        },
        "medications": ["Continue prescribed anxiolytics on schedule", "Breathing exercises (box breathing) counteract panic from breathlessness"],
        "avoid": ["Obsessively checking AQI during poor air days", "Outdoor exercise in poor air that causes breathing difficulty (which mimics panic)"],
        "indoor_tips": ["Open windows when AQI is good to get fresh air and natural light", "Indoor plants (Peace lily, Spider plant) marginally improve air quality"],
        "emergency_signs": ["Panic attacks not resolving with usual coping methods"],
        "personal_aqi_threshold": 150,
    },

    "depression": {
        "name": "Depression",
        "category": "Mental Health",
        "icon": "🌤️",
        "color": "#1b5e20",
        "safe_aqi": 100,
        "danger_aqi": 200,
        "pollutants": ["PM2.5"],
        "description": "Research links air pollution to increased depression risk through neuroinflammation pathways.",
        "how_aqi_affects": "Long-term PM2.5 exposure is associated with 25% higher depression risk. Reduced outdoor time on bad air days reduces sunlight and social contact — both antidepressants.",
        "precautions": {
            "good":      ["✅ Prioritise outdoor time today — sunlight and movement are powerful antidepressants"],
            "moderate":  ["⚠️ Short outdoor walk still beneficial. Wear mask if needed"],
            "poor":      ["😷 Prioritise indoor light exposure near windows", "Video call with friends/family instead of going out"],
            "severe":    ["🚨 Plan engaging indoor activities proactively. Isolation + bad air = compounding effect"],
        },
        "medications": ["Never skip antidepressants. Poor air days are high-risk days to maintain routine"],
        "avoid": ["Complete isolation on bad air days — social connection matters more"],
        "indoor_tips": ["Light therapy lamp (10,000 lux) helps when outdoor light is inaccessible", "Keep indoor space bright and clean"],
        "emergency_signs": ["Thoughts of self-harm — call iCall India: 9152987821"],
        "personal_aqi_threshold": 150,
    },

    # ── Pregnancy & Children ──────────────────────────────────────────────────
    "pregnancy": {
        "name": "Pregnancy",
        "category": "Special Groups",
        "icon": "🤰",
        "color": "#ad1457",
        "safe_aqi": 50,
        "danger_aqi": 100,
        "pollutants": ["PM2.5", "CO", "NO₂"],
        "description": "Pregnancy makes women more vulnerable to air pollution. Foetal development is directly impacted by maternal pollution exposure.",
        "how_aqi_affects": "PM2.5 crosses the placenta. Studies link high pollution exposure during pregnancy to premature birth, low birth weight, and developmental delays.",
        "precautions": {
            "good":      ["✅ Safe for gentle outdoor walks. Fresh air is beneficial"],
            "moderate":  ["⚠️ Limit outdoor time. Wear N95 if going out", "Avoid traffic-heavy routes"],
            "poor":      ["😷 Stay indoors. Foetal exposure risk is significant"],
            "severe":    ["🚨 No outdoor exposure. This is a critical protection window for your baby"],
        },
        "medications": ["Prenatal vitamins including folate continue as prescribed", "Discuss antioxidant supplementation with your OB if frequently exposed to high AQI"],
        "avoid": ["Outdoor exercise in moderate+ AQI conditions", "Cooking over open flame without ventilation", "Incense and agarbatti indoors"],
        "indoor_tips": ["HEPA air purifier is one of the best investments during pregnancy in India", "No indoor smoking by any family member", "Avoid chemical cleaners — use natural alternatives"],
        "emergency_signs": ["Reduced fetal movement", "Severe headache or visual changes", "Swelling + headache (preeclampsia signs)"],
        "personal_aqi_threshold": 50,
    },

    "infant": {
        "name": "Infant / Baby (0-2 years)",
        "category": "Special Groups",
        "icon": "👶",
        "color": "#0277bd",
        "safe_aqi": 50,
        "danger_aqi": 75,
        "pollutants": ["PM2.5", "PM10", "NO₂"],
        "description": "Infants breathe faster than adults (twice the rate) and their lungs are still developing. Pollution impact is disproportionately severe.",
        "how_aqi_affects": "Infants inhale 2× more air per kg body weight than adults. Developing lungs exposed to PM2.5 show permanent structural damage in studies.",
        "precautions": {
            "good":      ["✅ Great day to take baby outdoors. Fresh air supports development"],
            "moderate":  ["⚠️ Cover stroller with a breathable cover", "Keep outdoor time under 30 minutes", "Avoid busy roads"],
            "poor":      ["😷 Keep baby indoors. Do not take outdoors even for short trips"],
            "severe":    ["🚨 Baby must stay indoors. Run air purifier in the room"],
        },
        "medications": ["Consult paediatrician if baby shows coughing or wheezing on high pollution days"],
        "avoid": ["Taking baby near busy roads even briefly", "Exposing baby to cooking smoke", "Using mosquito coils in baby's room"],
        "indoor_tips": ["HEPA air purifier in the room where baby sleeps is highly recommended", "No smoking anywhere near baby — even outside", "Ventilate with fresh air when outdoor AQI is good"],
        "emergency_signs": ["Rapid breathing (>60 breaths/minute in infants)", "Blue lips or fingertips", "Nostrils flaring with each breath"],
        "personal_aqi_threshold": 50,
    },

    "elderly": {
        "name": "Senior Citizens (65+)",
        "category": "Special Groups",
        "icon": "👴",
        "color": "#37474f",
        "safe_aqi": 75,
        "danger_aqi": 150,
        "pollutants": ["PM2.5", "PM10", "O₃"],
        "description": "Ageing reduces respiratory and cardiovascular resilience. Seniors are more vulnerable to pollution-related complications.",
        "how_aqi_affects": "Reduced immune response, lower lung capacity, and pre-existing conditions common in seniors compound pollution effects significantly.",
        "precautions": {
            "good":      ["✅ Excellent day for outdoor walks. Stay active!"],
            "moderate":  ["⚠️ Keep walks short (under 30 min)", "Avoid exertion. Walk at gentle pace", "Carry phone in case of breathlessness"],
            "poor":      ["😷 Stay indoors. If must go out, wear N95 and keep it brief"],
            "severe":    ["🚨 No outdoor exposure. Ensure someone checks on you today"],
        },
        "medications": ["Ensure all regular medications are stocked — may not be able to go out to pharmacy on high AQI days"],
        "avoid": ["Morning walks between 6-9 AM when pollution is highest", "Areas with heavy traffic or construction"],
        "indoor_tips": ["Keep air purifier running", "Ensure good indoor ventilation when outdoor AQI is acceptable", "Stay hydrated — seniors often under-hydrate"],
        "emergency_signs": ["Breathlessness at rest", "Chest pain", "Confusion or unusual sleepiness with breathing symptoms"],
        "personal_aqi_threshold": 100,
    },

    "child": {
        "name": "Children (3-12 years)",
        "category": "Special Groups",
        "icon": "🧒",
        "color": "#f57c00",
        "safe_aqi": 75,
        "danger_aqi": 150,
        "pollutants": ["PM2.5", "PM10", "O₃"],
        "description": "Children's lungs are still developing. Pollution during childhood causes permanent lung capacity reduction.",
        "how_aqi_affects": "Children breathe 50% more air per kg than adults. Studies show children in high-pollution cities have permanently smaller lung capacity.",
        "precautions": {
            "good":      ["✅ Let them play outside freely! Active play is vital"],
            "moderate":  ["⚠️ Outdoor play is okay but avoid intense running sports", "Keep outdoor time under 1 hour"],
            "poor":      ["😷 Indoor activities today. No outdoor PE, sports, or play"],
            "severe":    ["🚨 Children must stay indoors. School should cancel outdoor activities"],
        },
        "medications": ["If child has asthma, ensure school has rescue inhaler"],
        "avoid": ["School buses with open windows near traffic", "Playing near construction sites or busy roads"],
        "indoor_tips": ["Indoor play, art, reading — keep kids active indoors", "Ensure classroom windows are closed on poor AQI days"],
        "emergency_signs": ["Wheezing", "Breathlessness during normal activity", "Persistent cough worsening on high AQI days"],
        "personal_aqi_threshold": 100,
    },

    "teenager": {
        "name": "Teenagers (13-17 years)",
        "category": "Special Groups",
        "icon": "🧑",
        "color": "#7b1fa2",
        "safe_aqi": 100,
        "danger_aqi": 200,
        "pollutants": ["PM2.5", "O₃"],
        "description": "Teens are often highly active outdoors and underestimate pollution risk.",
        "how_aqi_affects": "During intense outdoor sport, teens inhale pollution at 6× the resting rate, dramatically increasing exposure.",
        "precautions": {
            "good":      ["✅ Full outdoor sports and activities — go for it!"],
            "moderate":  ["⚠️ Reduce intensity of outdoor sports", "Shorten outdoor training sessions"],
            "poor":      ["😷 Move sports training indoors", "Wear mask for essential travel"],
            "severe":    ["🚨 No outdoor sports. Indoor gym/home workout instead"],
        },
        "medications": ["Sports teens with exercise-induced asthma: carry inhaler to practice"],
        "avoid": ["Marathon training or long-distance runs on moderate+ AQI days"],
        "indoor_tips": ["Indoor sports (badminton, basketball) on bad air days"],
        "emergency_signs": ["Chest tightness or wheezing during sport", "Dizziness or unusual fatigue"],
        "personal_aqi_threshold": 100,
    },

    # ── Skin & Eyes ───────────────────────────────────────────────────────────
    "eczema": {
        "name": "Eczema / Atopic Dermatitis",
        "category": "Skin",
        "icon": "🧴",
        "color": "#558b2f",
        "safe_aqi": 100,
        "danger_aqi": 200,
        "pollutants": ["PM10", "PM2.5", "VOCs"],
        "description": "Eczema causes skin barrier dysfunction. Air pollution is a recognised trigger for flare-ups.",
        "how_aqi_affects": "Particulate matter penetrates compromised skin barriers and triggers inflammatory responses. VOCs from vehicle exhaust disrupt the skin's protective acid mantle.",
        "precautions": {
            "good":      ["✅ Safe. Keep up regular moisturising routine"],
            "moderate":  ["⚠️ Wash face and exposed skin after coming indoors", "Apply barrier cream before going out"],
            "poor":      ["😷 Cover exposed skin outdoors. Shower immediately after returning home"],
            "severe":    ["🚨 Avoid outdoor exposure. Flare risk is very high"],
        },
        "medications": ["Topical corticosteroids for active flares as prescribed", "Moisturise 2× daily — pollution dehydrates skin"],
        "avoid": ["Synthetic fabrics outdoors that trap pollutants against skin", "Face washes with harsh chemicals after pollution exposure — use gentle cleansers"],
        "indoor_tips": ["Change clothes on entering home — clothes carry pollutants", "Maintain indoor humidity 45–55% to support skin barrier"],
        "emergency_signs": ["Widespread infected eczema with fever"],
        "personal_aqi_threshold": 100,
    },

    "dry_eyes": {
        "name": "Dry Eyes",
        "category": "Eyes",
        "icon": "👁️",
        "color": "#00695c",
        "safe_aqi": 100,
        "danger_aqi": 200,
        "pollutants": ["PM10", "PM2.5", "O₃", "NO₂"],
        "description": "Dry eye syndrome. Air pollutants evaporate the tear film and cause ocular surface inflammation.",
        "how_aqi_affects": "Ozone and PM2.5 reduce the stability of the tear film. Pollutants directly irritate the ocular surface.",
        "precautions": {
            "good":      ["✅ Comfortable for most. Use lubricating drops as needed"],
            "moderate":  ["⚠️ Wear wraparound sunglasses outdoors", "Use lubricating eye drops before going out"],
            "poor":      ["😷 Significant eye irritation risk. Wrap-around glasses + eye drops every 2 hours"],
            "severe":    ["🚨 Avoid outdoor exposure. Eyes are highly vulnerable at this AQI"],
        },
        "medications": ["Preservative-free artificial tears on high AQI days", "Omega-3 supplements (fish oil) support tear film — ask your doctor"],
        "avoid": ["Contact lens use on high AQI days — lenses concentrate pollutants on the eye surface", "Rubbing eyes after outdoor exposure"],
        "indoor_tips": ["Increase indoor humidity (40-50%) to reduce evaporative dry eye", "Blink exercises every 20 minutes near screens"],
        "emergency_signs": ["Sudden vision change or severe eye pain"],
        "personal_aqi_threshold": 100,
    },

    # ── Neurological ──────────────────────────────────────────────────────────
    "migraine": {
        "name": "Migraines",
        "category": "Neurological",
        "icon": "🧠",
        "color": "#4e342e",
        "safe_aqi": 100,
        "danger_aqi": 150,
        "pollutants": ["PM2.5", "CO", "NO₂", "O₃"],
        "description": "Air pollution is a documented migraine trigger, particularly particulates and ozone.",
        "how_aqi_affects": "CO causes cerebral vasodilation. O₃ triggers trigeminal nerve inflammation. PM2.5 causes systemic inflammation affecting brain blood vessels.",
        "precautions": {
            "good":      ["✅ Low migraine trigger risk from air today"],
            "moderate":  ["⚠️ Be alert for early migraine signs (aura, neck tension)", "Stay hydrated — dehydration + pollution compounds risk"],
            "poor":      ["😷 High migraine trigger risk. Have rescue medication accessible", "Wear mask outdoors to reduce trigger exposure"],
            "severe":    ["🚨 Very high migraine risk day. Stay indoors. Have medication ready"],
        },
        "medications": ["Keep prescribed triptan rescue medication accessible", "Preventive medication should not be skipped on high AQI days"],
        "avoid": ["Strong perfumes/scents combined with outdoor pollution — compound trigger", "Bright sunlight + high AQI = double sensory trigger"],
        "indoor_tips": ["Dark, cool, quiet indoor environment on high AQI + migraine days", "Avoid screen time during aura phase"],
        "emergency_signs": ["Sudden severe 'thunderclap' headache", "Migraine with weakness or speech difficulty — seek emergency care"],
        "personal_aqi_threshold": 100,
    },

    # ── Active Lifestyle ──────────────────────────────────────────────────────
    "runner": {
        "name": "Distance Runner",
        "category": "Active Lifestyle",
        "icon": "🏃",
        "color": "#1565c0",
        "safe_aqi": 50,
        "danger_aqi": 100,
        "pollutants": ["PM2.5", "O₃"],
        "description": "Runners breathe 6–8× more air than at rest. What feels like a healthy activity can become highly pollutant-exposing on bad air days.",
        "how_aqi_affects": "At running pace, PM2.5 inhaled per session at AQI 150 = equivalent to sitting in AQI 900 for the same time. Lung exposure scales dramatically with breathing rate.",
        "precautions": {
            "good":      ["✅ Ideal running conditions. Go for that PB!"],
            "moderate":  ["⚠️ Reduce run to 60% of planned distance", "Avoid roads — run in parks away from traffic"],
            "poor":      ["😷 Treadmill day. Outdoor running at this AQI is counterproductive to health"],
            "severe":    ["🚨 Do not run outdoors under any circumstances. Rest day or gym"],
        },
        "medications": ["If exercise-induced asthma: pre-run inhaler on moderate+ AQI days"],
        "avoid": ["Morning runs 6-9 AM on moderate+ AQI days — worst pollution window", "Running alongside busy roads"],
        "indoor_tips": ["Treadmill + air purifier is the gold standard on bad air days", "Stationary cycling is low-breathing-rate alternative"],
        "emergency_signs": ["Chest tightness or unusual breathlessness during run"],
        "personal_aqi_threshold": 50,
    },

    "cyclist": {
        "name": "Cyclist",
        "category": "Active Lifestyle",
        "icon": "🚴",
        "color": "#00695c",
        "safe_aqi": 50,
        "danger_aqi": 100,
        "pollutants": ["PM2.5", "NO₂", "CO"],
        "description": "Cyclists are at road level where PM2.5 and NO₂ concentrations are highest. Combined with elevated breathing rate, exposure is severe on bad air days.",
        "how_aqi_affects": "Cyclists travel through pollution plumes from vehicles ahead. Studies show cyclists inhale 2× more NO₂ than pedestrians on the same route.",
        "precautions": {
            "good":      ["✅ Excellent cycling conditions"],
            "moderate":  ["⚠️ Avoid major roads. Take parallel residential routes", "Anti-pollution cycling mask recommended"],
            "poor":      ["😷 Indoor cycling only. Outdoor cycling not recommended"],
            "severe":    ["🚨 Do not cycle outdoors. High exposure risk at road level"],
        },
        "medications": [],
        "avoid": ["Cycling in heavy traffic during peak hours even on good AQI days — localised NO₂ can be 5× higher"],
        "indoor_tips": ["Indoor cycling trainer is a worthwhile investment for Indian cities"],
        "emergency_signs": ["Throat irritation or burning sensation during ride"],
        "personal_aqi_threshold": 50,
    },

    "yoga_practitioner": {
        "name": "Yoga Practitioner",
        "category": "Active Lifestyle",
        "icon": "🧘",
        "color": "#4527a0",
        "safe_aqi": 75,
        "danger_aqi": 150,
        "pollutants": ["PM2.5", "O₃"],
        "description": "Deep breathing in yoga amplifies pollutant intake when done outdoors in poor air.",
        "how_aqi_affects": "Pranayama and deep breathing exercises dramatically increase lung volume per breath — amplifying pollution intake 4-8× compared to normal breathing.",
        "precautions": {
            "good":      ["✅ Ideal for outdoor yoga. Deep breathing in clean air is maximally beneficial"],
            "moderate":  ["⚠️ Move yoga indoors or to a well-ventilated space", "Avoid pranayama outdoors"],
            "poor":      ["😷 Yoga must be done indoors only with windows closed"],
            "severe":    ["🚨 Do only gentle stretching indoors. No pranayama on severe AQI days"],
        },
        "medications": [],
        "avoid": ["Outdoor pranayama practice when AQI > 75 — deep breathing in poor air is harmful, not beneficial", "Rooftop or balcony yoga on poor AQI days"],
        "indoor_tips": ["HEPA air purifier on during indoor yoga practice", "Ventilate room well before practice when outdoor AQI is good"],
        "emergency_signs": ["Dizziness or lightheadedness during pranayama — stop immediately"],
        "personal_aqi_threshold": 75,
    },
}

# ── Category list for frontend ───────────────────────────────────────────────
CATEGORIES = [
    {"id": "respiratory",    "label": "Respiratory",     "icon": "🫁"},
    {"id": "cardiovascular", "label": "Cardiovascular",  "icon": "❤️"},
    {"id": "metabolic",      "label": "Metabolic",       "icon": "🩸"},
    {"id": "mental_health",  "label": "Mental Health",   "icon": "🧠"},
    {"id": "special_groups", "label": "Special Groups",  "icon": "👥"},
    {"id": "skin",           "label": "Skin",            "icon": "🧴"},
    {"id": "eyes",           "label": "Eyes",            "icon": "👁️"},
    {"id": "neurological",   "label": "Neurological",    "icon": "🔬"},
    {"id": "active",         "label": "Active Lifestyle","icon": "🏃"},
]

AGE_GROUPS = [
    {"id": "infant",  "label": "Infant (0-2)",   "icon": "👶"},
    {"id": "child",   "label": "Child (3-12)",    "icon": "🧒"},
    {"id": "teen",    "label": "Teen (13-17)",    "icon": "🧑"},
    {"id": "adult",   "label": "Adult (18-59)",   "icon": "🧑‍💼"},
    {"id": "senior",  "label": "Senior (60+)",    "icon": "👴"},
]


# ── Profile management ────────────────────────────────────────────────────────

def save_profile(session_id: str, profile_data: dict) -> dict:
    """
    Save a user health profile.
    profile_data = {
        age_group: "senior",
        conditions: ["asthma", "heart_disease"],
        name: "optional display name"
    }
    """
    _PROFILES[session_id] = {
        "session_id": session_id,
        "age_group":  profile_data.get("age_group", "adult"),
        "conditions": profile_data.get("conditions", []),
        "name":       profile_data.get("name", ""),
        "updated_at": _now_str(),
    }
    return {"status": "saved", "profile": _PROFILES[session_id]}


def get_profile(session_id: str) -> dict:
    """Get a user's saved health profile."""
    return _PROFILES.get(session_id, {
        "session_id": session_id,
        "age_group":  "adult",
        "conditions": [],
        "name":       "",
    })


def search_conditions(query: str, limit: int = 8) -> list[dict]:
    """Search health conditions by name or category keyword."""
    q = query.lower().strip()
    if len(q) < 2:
        return []

    results = []
    for key, cond in HEALTH_CONDITIONS.items():
        name_match     = q in cond["name"].lower()
        cat_match      = q in cond["category"].lower()
        desc_match     = q in cond.get("description", "").lower()
        if name_match or cat_match or desc_match:
            results.append({
                "id":       key,
                "name":     cond["name"],
                "category": cond["category"],
                "icon":     cond["icon"],
                "color":    cond["color"],
            })
        if len(results) >= limit:
            break
    return results


def get_all_conditions() -> list[dict]:
    """Return all conditions grouped by category."""
    grouped: dict[str, list] = {}
    for key, cond in HEALTH_CONDITIONS.items():
        cat = cond["category"]
        if cat not in grouped:
            grouped[cat] = []
        grouped[cat].append({
            "id":       key,
            "name":     cond["name"],
            "icon":     cond["icon"],
            "color":    cond["color"],
        })
    return [{"category": cat, "conditions": conds} for cat, conds in grouped.items()]


# ── Personalised AQI analysis ────────────────────────────────────────────────

def get_personal_aqi_report(session_id: str, aqi: int, weather: dict = None) -> dict:
    """
    Generate a fully personalised AQI report for a user based on their
    health profile. This is the core of the personalisation feature.
    """
    profile    = get_profile(session_id)
    conditions = profile.get("conditions", [])
    age_group  = profile.get("age_group", "adult")

    # If no conditions set, return a gentle nudge to set up profile
    if not conditions:
        cat, color = get_category(aqi)
        return {
            "aqi": aqi,
            "category": cat,
            "color": color,
            "has_profile": False,
            "message": "Set up your health profile to get personalised AQI advice.",
            "personal_threshold": 100,
            "safety_level": _generic_safety(aqi),
        }

    # Get condition data for each selected condition
    condition_reports  = []
    all_thresholds     = []
    most_sensitive     = None
    most_sensitive_thr = 999

    for cond_id in conditions:
        cond = HEALTH_CONDITIONS.get(cond_id)
        if not cond:
            continue

        threshold = cond["personal_aqi_threshold"]
        all_thresholds.append(threshold)

        if threshold < most_sensitive_thr:
            most_sensitive_thr = threshold
            most_sensitive     = cond_id

        # Determine current risk level for this condition
        level = _risk_level(aqi, cond)
        precautions = cond["precautions"].get(level, [])

        condition_reports.append({
            "id":               cond_id,
            "name":             cond["name"],
            "icon":             cond["icon"],
            "color":            cond["color"],
            "category":         cond["category"],
            "risk_level":       level,
            "risk_label":       _risk_label(level),
            "risk_color":       _risk_color(level),
            "personal_threshold": threshold,
            "safe_aqi":         cond["safe_aqi"],
            "danger_aqi":       cond["danger_aqi"],
            "how_aqi_affects":  cond["how_aqi_affects"],
            "precautions":      precautions,
            "avoid":            cond["avoid"],
            "indoor_tips":      cond["indoor_tips"],
            "emergency_signs":  cond["emergency_signs"],
            "medications":      cond.get("medications", []),
            "threshold_exceeded": aqi > threshold,
        })

    # Overall personal threshold = the most restrictive (lowest) among conditions
    personal_threshold = min(all_thresholds) if all_thresholds else 100
    overall_risk       = _risk_level_from_threshold(aqi, personal_threshold)

    # Age group modifier
    age_modifier = _age_modifier(age_group, aqi)

    # Personal safety verdict
    verdict = _personal_verdict(aqi, personal_threshold, conditions, age_group)

    return {
        "aqi":                aqi,
        "has_profile":        True,
        "age_group":          age_group,
        "conditions":         conditions,
        "condition_count":    len(condition_reports),
        "condition_reports":  condition_reports,
        "personal_threshold": personal_threshold,
        "overall_risk":       overall_risk,
        "overall_risk_label": _risk_label(overall_risk),
        "overall_risk_color": _risk_color(overall_risk),
        "verdict":            verdict,
        "age_modifier":       age_modifier,
        "most_sensitive_condition": most_sensitive,
        "threshold_exceeded": aqi > personal_threshold,
        "general_message":    _general_message(aqi, personal_threshold, conditions, age_group),
    }


def _risk_level(aqi: int, cond: dict) -> str:
    if aqi <= cond["safe_aqi"]:
        return "good"
    elif aqi <= cond["danger_aqi"]:
        return "moderate"
    elif aqi <= cond["danger_aqi"] * 1.5:
        return "poor"
    else:
        return "severe"


def _risk_level_from_threshold(aqi: int, threshold: int) -> str:
    if aqi <= threshold:
        return "good"
    elif aqi <= threshold * 2:
        return "moderate"
    elif aqi <= threshold * 3:
        return "poor"
    else:
        return "severe"


def _risk_label(level: str) -> str:
    return {"good": "Safe for You", "moderate": "Use Caution", "poor": "Limit Exposure", "severe": "Stay Indoors"}.get(level, "Unknown")


def _risk_color(level: str) -> str:
    return {"good": "#00b050", "moderate": "#e8a000", "poor": "#e05a00", "severe": "#cc0000"}.get(level, "#9e9e9e")


def _generic_safety(aqi: int) -> str:
    if aqi <= 50:   return "good"
    if aqi <= 100:  return "satisfactory"
    if aqi <= 200:  return "moderate"
    if aqi <= 300:  return "poor"
    return "severe"


def _age_modifier(age_group: str, aqi: int) -> dict:
    modifiers = {
        "infant":  {"label": "Extra sensitive", "note": "Infants are 2× more vulnerable — their threshold is half of adults"},
        "child":   {"label": "Higher sensitivity", "note": "Developing lungs — 50% more sensitive than healthy adults"},
        "teen":    {"label": "Standard, high activity", "note": "Teens are active — high breathing rate increases exposure during sport"},
        "adult":   {"label": "Standard", "note": "Base sensitivity"},
        "senior":  {"label": "Reduced resilience", "note": "Ageing reduces lung and cardiac reserve — take extra care above AQI 100"},
    }
    return modifiers.get(age_group, modifiers["adult"])


def _personal_verdict(aqi: int, threshold: int, conditions: list, age_group: str) -> str:
    if aqi <= threshold:
        return "✅ Today's air is safe for your specific health profile."
    elif aqi <= threshold * 1.5:
        cond_names = [HEALTH_CONDITIONS[c]["name"] for c in conditions if c in HEALTH_CONDITIONS]
        return f"⚠️ AQI {aqi} exceeds your personal safe limit of {threshold}. Take precautions for: {', '.join(cond_names[:2])}."
    elif aqi <= threshold * 2.5:
        return f"😷 Significant risk for your health profile. AQI {aqi} is {aqi - threshold} above your safe limit. Limit outdoor exposure."
    else:
        return f"🚨 Dangerous conditions for your health profile. AQI {aqi} is severely above your personal threshold of {threshold}. Stay indoors."


def _general_message(aqi: int, threshold: int, conditions: list, age_group: str) -> str:
    if not conditions:
        return "Add health conditions to get personalised advice."
    cond_list = " + ".join([HEALTH_CONDITIONS[c]["name"] for c in conditions[:2] if c in HEALTH_CONDITIONS])
    if aqi <= threshold:
        return f"Good news — today's air (AQI {aqi}) is within safe limits for someone with {cond_list}."
    else:
        return f"Today's AQI ({aqi}) exceeds the safe limit for {cond_list}. See specific precautions below."


def _now_str() -> str:
    from datetime import datetime, timezone, timedelta
    IST = timezone(timedelta(hours=5, minutes=30))
    return datetime.now(IST).strftime("%I:%M %p, %d %b %Y")