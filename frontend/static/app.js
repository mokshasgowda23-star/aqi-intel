// ─────────────────────────────────────────────────────────────────────────────
// AQI Intel — frontend/static/app.js
// ─────────────────────────────────────────────────────────────────────────────

// ── Utility functions ─────────────────────────────────────────────────────────

function aqiColor(v) {
  if (v <= 50)  return "#00b050";
  if (v <= 100) return "#7ab648";
  if (v <= 200) return "#e8a000";
  if (v <= 300) return "#e05a00";
  if (v <= 400) return "#cc0000";
  return "#660000";
}

function aqiBg(v) {
  if (v <= 50)  return "#e8f8ee";
  if (v <= 100) return "#f2fae8";
  if (v <= 200) return "#fff9e0";
  if (v <= 300) return "#fff0e6";
  if (v <= 400) return "#ffe6e6";
  return "#ffd6d6";
}

function aqiCat(v) {
  if (v <= 50)  return "Good";
  if (v <= 100) return "Satisfactory";
  if (v <= 200) return "Moderate";
  if (v <= 300) return "Poor";
  if (v <= 400) return "Very Poor";
  return "Severe";
}

function aqiEmoji(v) {
  if (v <= 50)  return "😊";
  if (v <= 100) return "🙂";
  if (v <= 200) return "😐";
  if (v <= 300) return "😷";
  if (v <= 400) return "🚨";
  return "☠️";
}

function zoneIcon(t) {
  const map = { industrial: "🏭", residential: "🏠", commercial: "🏬", green: "🌿", tech: "💻", transport: "🚌" };
  return map[t] || "📍";
}

function el(id) {
  return document.getElementById(id);
}

function skel(h) {
  return '<div class="skel" style="height:' + h + 'px;border-radius:8px"></div>';
}

async function api(path) {
  try {
    const r = await fetch(path);
    if (!r.ok) throw new Error("HTTP " + r.status);
    return await r.json();
  } catch (e) {
    console.error("[API]", path, e.message);
    return null;
  }
}

function makePollutantCard(key, val) {
  const labels = { pm25: "PM2.5", pm10: "PM10", no2: "NO₂", so2: "SO₂", o3: "O₃", co: "CO" };
  const units  = { pm25: "µg/m³", pm10: "µg/m³", no2: "µg/m³", so2: "µg/m³", o3: "µg/m³", co: "mg/m³" };
  const safe   = { pm25: 30, pm10: 50, no2: 40, so2: 40, o3: 50, co: 1 };
  const over   = val > safe[key];
  const color  = over ? aqiColor(250) : aqiColor(50);
  const pct    = Math.min(100, Math.round((val / (safe[key] * 5)) * 100));
  const div    = document.createElement("div");
  div.style.cssText = "background:var(--cream);border-radius:var(--r2);padding:12px;border:1px solid var(--border)";
  div.innerHTML = [
    '<div style="font-size:.68rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">' + (labels[key] || key) + "</div>",
    '<div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:600;color:' + color + ';margin:4px 0">',
    val + '<span style="font-size:.62rem;opacity:.7"> ' + (units[key] || "") + "</span></div>",
    '<div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden">',
    '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:2px;transition:width .5s"></div></div>',
    over ? '<div style="font-size:.62rem;color:' + color + ';margin-top:3px">Above safe limit</div>' : ""
  ].join("");
  return div;
}

function makeForecastHour(h, isBest) {
  const color = aqiColor(h.aqi);
  const div   = document.createElement("div");
  div.className = "fc-hr" + (isBest ? " best" : "");
  div.title     = (h.hour || h.label) + ": AQI " + h.aqi;
  div.innerHTML = [
    '<div class="fc-label">' + (h.label || h.hour) + "</div>",
    '<div style="font-size:.9rem">' + (h.emoji || aqiEmoji(h.aqi)) + "</div>",
    '<div class="fc-aqi" style="color:' + color + '">' + h.aqi + "</div>",
    '<div class="fc-strip" style="background:' + color + '"></div>',
    isBest ? '<div class="fc-best-tag">BEST</div>' : ""
  ].join("");
  return div;
}

function makeCityCard(c, activeCity) {
  const color   = c.color || aqiColor(c.aqi);
  const bg      = aqiBg(c.aqi);
  const isActive = c.city_id === activeCity;
  const div     = document.createElement("div");
  div.style.cssText = [
    "background:" + bg,
    "border:1.5px solid " + (isActive ? color : "transparent"),
    "border-radius:10px",
    "padding:12px",
    "cursor:pointer",
    "transition:transform .15s,box-shadow .15s"
  ].join(";");
  div.innerHTML = [
    '<div style="display:flex;justify-content:space-between;align-items:center">',
    '<div style="font-size:.8rem;font-weight:600">' + c.city_name + "</div>",
    '<div style="font-size:1.1rem">' + (c.emoji || aqiEmoji(c.aqi)) + "</div></div>",
    '<div style="font-family:var(--font-display);font-size:1.7rem;font-weight:900;color:' + color + ';line-height:1;margin-top:5px">' + c.aqi + "</div>",
    '<div style="font-size:.7rem;color:' + color + ';font-weight:600;margin-top:2px">' + c.category + "</div>"
  ].join("");
  div.addEventListener("mouseover", function () { this.style.transform = "translateY(-2px)"; this.style.boxShadow = "0 4px 12px rgba(0,0,0,.1)"; });
  div.addEventListener("mouseout",  function () { this.style.transform = "";                 this.style.boxShadow = ""; });
  div.addEventListener("click",     function () { Search.selectCity(c.city_name, ""); });
  return div;
}

function makeAlertBar(aqi, message, detail, dismissId) {
  const color = aqiColor(aqi);
  const bar   = document.createElement("div");
  bar.className = "alert-bar";
  bar.style.cssText = "background:" + aqiBg(aqi) + ";border-left-color:" + color;
  const closeBtn = dismissId
    ? '<button onclick="el(\'' + dismissId + '\').innerHTML=\'\'" style="background:none;border:none;cursor:pointer;color:#999;font-size:1.1rem;flex-shrink:0">✕</button>'
    : "";
  bar.innerHTML = [
    '<span style="font-size:1.4rem;flex-shrink:0">' + aqiEmoji(aqi) + "</span>",
    '<div style="flex:1"><strong style="color:' + color + '">' + message + "</strong>",
    detail ? '<div style="font-size:.82rem;color:var(--text-muted);margin-top:2px">' + detail + "</div>" : "",
    "</div>",
    closeBtn
  ].join("");
  return bar;
}

// ── City Search ───────────────────────────────────────────────────────────────

const PRESET_CITIES = [
  { name: "Delhi",      state: "Delhi" },
  { name: "Mumbai",     state: "Maharashtra" },
  { name: "Bengaluru",  state: "Karnataka" },
  { name: "Kolkata",    state: "West Bengal" },
  { name: "Hyderabad",  state: "Telangana" },
  { name: "Chennai",    state: "Tamil Nadu" },
  { name: "Pune",       state: "Maharashtra" },
  { name: "Ahmedabad",  state: "Gujarat" },
  { name: "Mysuru",     state: "Karnataka" },
  { name: "Coimbatore", state: "Tamil Nadu" },
  { name: "Kochi",      state: "Kerala" },
  { name: "Jaipur",     state: "Rajasthan" },
  { name: "Lucknow",    state: "Uttar Pradesh" },
  { name: "Chandigarh", state: "Chandigarh" },
];

const PRESET_ID_MAP = {
  "Delhi": "delhi", "Mumbai": "mumbai", "Bengaluru": "bengaluru",
  "Kolkata": "kolkata", "Hyderabad": "hyderabad", "Chennai": "chennai",
  "Pune": "pune", "Ahmedabad": "ahmedabad"
};

const Search = {
  _timer:   null,
  _focused: -1,
  _items:   [],

  init() {
    const input = el("searchInput");
    input.addEventListener("input",   (e) => this._onInput(e.target.value));
    input.addEventListener("keydown", (e) => this._onKey(e));
    input.addEventListener("focus",   ()  => this._onFocus());
    document.addEventListener("click", (e) => {
      if (!el("searchWrap").contains(e.target)) this._close();
    });
  },

  _onFocus() {
    const q = el("searchInput").value.trim();
    if (q.length < 2) {
      this._renderPresets();
    }
  },

  _onInput(val) {
    clearTimeout(this._timer);
    this._focused = -1;
    const clearBtn = el("searchClear");
    if (clearBtn) clearBtn.style.display = val ? "block" : "none";
    if (val.length < 2) { this._renderPresets(); return; }
    this._timer = setTimeout(() => this._fetch(val), 220);
  },

  _onKey(e) {
    const box  = el("suggestions");
    const rows = box.querySelectorAll(".sug-item");
    if (e.key === "ArrowDown") {
      e.preventDefault();
      this._focused = Math.min(this._focused + 1, rows.length - 1);
      this._highlightRows(rows);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      this._focused = Math.max(this._focused - 1, -1);
      this._highlightRows(rows);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (this._focused >= 0 && rows[this._focused]) {
        rows[this._focused].click();
      } else {
        const q = el("searchInput").value.trim();
        if (q.length >= 2) this.selectCity(q, "India");
      }
    } else if (e.key === "Escape") {
      this._close();
    }
  },

  _highlightRows(rows) {
    rows.forEach((r, i) => {
      r.classList.toggle("focused", i === this._focused);
    });
    if (this._focused >= 0 && rows[this._focused]) {
      rows[this._focused].scrollIntoView({ block: "nearest" });
    }
  },

  async _fetch(q) {
    const spinner = el("searchSpinner");
    if (spinner) spinner.style.display = "inline";
    const data = await api("/api/search/autocomplete?q=" + encodeURIComponent(q) + "&limit=9");
    if (spinner) spinner.style.display = "none";
    this._renderResults(data || []);
  },

  _renderPresets() {
    const box = el("suggestions");
    box.innerHTML = "";
    const section = document.createElement("div");
    section.className = "sug-section";
    section.textContent = "Popular Cities";
    box.appendChild(section);
    PRESET_CITIES.forEach((c) => box.appendChild(this._makeItem(c.name, c.state, "popular")));
    box.classList.add("open");
  },

  _renderResults(results) {
    const box = el("suggestions");
    box.innerHTML = "";
    if (results.length === 0) {
      const msg = document.createElement("div");
      msg.className = "sug-no-result";
      msg.textContent = "No cities found — try a different spelling.";
      box.appendChild(msg);
    } else {
      const section = document.createElement("div");
      section.className = "sug-section";
      section.textContent = "Search Results";
      box.appendChild(section);
      results.forEach((c) => box.appendChild(this._makeItem(c.name, c.state, "result")));
    }
    box.classList.add("open");
  },

  _makeItem(name, state, badgeType) {
    const item  = document.createElement("div");
    item.className = "sug-item";
    const left  = document.createElement("div");
    const nameEl = document.createElement("div");
    nameEl.className = "sug-name";
    nameEl.textContent = name;
    const stateEl = document.createElement("div");
    stateEl.className = "sug-state";
    stateEl.textContent = state;
    left.appendChild(nameEl);
    left.appendChild(stateEl);
    const badge = document.createElement("span");
    badge.className = "sug-badge " + badgeType;
    badge.textContent = badgeType === "popular" ? "Popular" : "Search";
    item.appendChild(left);
    item.appendChild(badge);
    item.addEventListener("click", () => this.selectCity(name, state));
    return item;
  },

  selectCity(name, state) {
    const input = el("searchInput");
    input.value = "";
    input.placeholder = name;
    const chip = el("cityChip");
    if (chip) chip.textContent = "📍 " + name;
    const clearBtn = el("searchClear");
    if (clearBtn) clearBtn.style.display = "none";
    this._close();

    const presetId = PRESET_ID_MAP[name];
    if (presetId) {
      App.cityId   = presetId;
      App.cityName = name;
      App.isCustom = false;
      App.go(App.page, true);
    } else {
      App.cityId   = name.toLowerCase().replace(/\s+/g, "-");
      App.cityName = name;
      App.isCustom = true;
      App.loadCustomCity(name);
    }
  },

  clear() {
    const input = el("searchInput");
    input.value = "";
    input.placeholder = "Search any city in India…";
    const clearBtn = el("searchClear");
    if (clearBtn) clearBtn.style.display = "none";
    this._close();
  },

  _close() {
    el("suggestions").classList.remove("open");
    this._focused = -1;
  }
};

// ── App ───────────────────────────────────────────────────────────────────────

const App = {
  cityId:   "bengaluru",
  cityName: "Bengaluru",
  isCustom: false,
  page:     "dashboard",
  session:  localStorage.getItem("aqi_sess") || ("s" + Math.random().toString(36).slice(2, 9)),
  _chart:   null,
  _zones:   [],

  init() {
    localStorage.setItem("aqi_sess", this.session);
    Search.init();
    this._startClock();
    this.go("dashboard");
  },

  _startClock() {
    const tick = () => {
      const lbl = el("tsLabel");
      if (lbl) lbl.textContent = "Updated " + new Date().toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
    };
    tick();
    setInterval(tick, 30000);
  },

  go(page, force) {
    if (this.page === page && !force) return;
    this.page = page;
    document.querySelectorAll(".page").forEach((p)     => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    const pg = el("page-" + page);
    if (pg) pg.classList.add("active");
    const ni = document.querySelector('[data-page="' + page + '"]');
    if (ni) ni.classList.add("active");

    if (this.isCustom) {
      this.loadCustomCity(this.cityName);
      return;
    }

    const loaders = {
      dashboard:   () => this.loadDashboard(),
      heatmap:     () => this.loadHeatmap(),
      forecast:    () => this.loadForecast(),
      brief:       () => this.loadBrief(),
      activities:  () => this.loadActivities(),
      calendar:    () => this.loadCalendar(),
      school:      () => this.loadSchool(),
      alerts:      () => this.loadAlerts(),
      community:   () => this.loadCommunity(),
      lungscore:   () => loadLungScore(this.cityId),
      timemachine: () => loadTimeMachine(this.cityId),
      fingerprint: () => loadFingerprint(this.cityId, this.cityName),
      bodybattery: () => loadBodyBattery(this.cityId),
      health:      () => HealthProfile.load(this.cityId)
    };
    if (loaders[page]) loaders[page]();
  },

  // ── DASHBOARD ───────────────────────────────────────────────────────────────
  async loadDashboard() {
    const city = this.cityId;
    const [aqiData, fcData, briefData, citiesData] = await Promise.all([
      api("/api/city/" + city),
      api("/api/city/" + city + "/forecast"),
      api("/api/city/" + city + "/brief"),
      api("/api/cities")
    ]);

    if (aqiData) this._renderAqi(aqiData);
    if (briefData) this._renderWeather(briefData);
    if (aqiData && aqiData.pollutants) this._renderPollutants(aqiData.pollutants);
    if (fcData) this._renderFcBar("db-fcbar", fcData);
    if (citiesData) this._renderCities(citiesData);
  },

  _renderAqi(aqi) {
    const color = aqi.color || aqiColor(aqi.aqi);
    const bg    = aqiBg(aqi.aqi);
    el("db-num").textContent    = aqi.aqi;
    el("db-num").style.color    = color;
    el("db-emoji").textContent  = aqi.emoji || aqiEmoji(aqi.aqi);
    el("db-pill").textContent   = aqi.category;
    el("db-pill").style.background = color;
    el("db-station").textContent   = "📍 " + (aqi.station || aqi.city_name || this.cityName);
    el("db-src").textContent       = aqi.source === "live" ? "🟢 live" : "🔵 demo";
    // Hero card uses dark theme, not gradient
    el("db-card").style.background = "";
    el("db-card").style.borderColor = "transparent"; el("db-card").style.boxShadow = "0 2px 8px rgba(0,0,0,.08), 0 8px 24px rgba(0,0,0,.06)";

    const alertEl = el("db-alert");
    alertEl.innerHTML = "";
    if (aqi.aqi > 100) {
      const detail = aqi.aqi > 200 ? "Wear N95 mask outdoors."
        : aqi.aqi > 150 ? "Sensitive groups: limit outdoor time."
        : "Keep an eye on it.";
      const bar = makeAlertBar(aqi.aqi, aqi.category + " Air — AQI " + aqi.aqi, detail, "db-alert");
      alertEl.appendChild(bar);
    }
  },

  _renderWeather(brief) {
    el("w-emoji").textContent  = brief.weather_emoji || "🌤️";
    el("w-temp").textContent   = (brief.temp_c != null ? brief.temp_c : "—") + "°C";
    el("w-cond").textContent   = brief.condition || "—";
    el("w-hum").textContent    = brief.humidity  != null ? brief.humidity + "%" : "—";
    el("w-wind").textContent   = brief.wind_kph  != null ? brief.wind_kph + " km/h" : "—";
    el("w-feels").textContent  = brief.feels_like_c != null ? brief.feels_like_c + "°C" : "—";
    el("w-uv").textContent     = brief.uv_index  != null ? brief.uv_index : "—";
  },

  _renderPollutants(pollutants) {
    const grid = el("db-poll");
    grid.innerHTML = "";
    Object.entries(pollutants).forEach(([key, val]) => {
      if (val != null) grid.appendChild(makePollutantCard(key, val));
    });
    if (!grid.children.length) grid.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem;padding:10px">No pollutant data.</div>';
  },

  _renderFcBar(containerId, fcData) {
    const bar  = el(containerId);
    const best = fcData.best_time || {};
    bar.innerHTML = "";
    (fcData.forecast || []).forEach((h) => {
      bar.appendChild(makeForecastHour(h, h.aqi === best.best_aqi));
    });
    const bestEl = el("db-best");
    if (bestEl && best.best_hour) {
      bestEl.textContent = best.best_hour + " (AQI " + best.best_aqi + ") — " + (best.recommendation || "");
    }
  },

  _renderCities(cities) {
    const grid = el("db-cities");
    grid.innerHTML = "";
    cities.forEach((c) => grid.appendChild(makeCityCard(c, this.cityId)));
  },

  // ── HEATMAP ─────────────────────────────────────────────────────────────────
  async loadHeatmap() {
    el("hm-zones").innerHTML = skel(140);
    const data = await api("/api/city/" + this.cityId + "/heatmap");
    if (!data) { el("hm-zones").innerHTML = "<p>Failed to load zone data.</p>"; return; }
    this._zones = data.zones || [];
    this._drawZones(this._zones);
    const avg = Math.round(this._zones.reduce((a, z) => a + z.aqi, 0) / Math.max(1, this._zones.length));
    el("hm-insights").innerHTML = "";
    const ins = document.createElement("div");
    ins.className = "card";
    ins.innerHTML = [
      '<div class="card-title">Zone Insights — ' + data.city_name + "</div>",
      '<div class="g3">',
      this._insightTile("Cleanest Zone", "🌿 " + (data.cleanest_zone || "—"), "var(--good)"),
      this._insightTile("City Average", avg + '<div style="font-size:.7rem;color:' + aqiColor(avg) + ';font-weight:600">' + aqiCat(avg) + "</div>", aqiColor(avg)),
      this._insightTile("Most Polluted", "🏭 " + (data.worst_zone || "—"), "var(--very-poor)"),
      "</div>"
    ].join("");
    el("hm-insights").appendChild(ins);
  },

  _insightTile(label, value, color) {
    return [
      '<div style="text-align:center;padding:12px;background:var(--bg);border-radius:8px">',
      '<div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase">' + label + "</div>",
      '<div style="font-weight:700;color:' + color + ';margin-top:4px;font-family:var(--font-display);font-size:1.1rem">' + value + "</div>",
      "</div>"
    ].join("");
  },

  _drawZones(zones) {
    const grid = el("hm-zones");
    grid.innerHTML = "";
    if (!zones.length) { grid.innerHTML = '<p style="color:var(--text-muted)">No zones match.</p>'; return; }
    zones.forEach((z) => {
      const color = z.color || aqiColor(z.aqi);
      const card  = document.createElement("div");
      card.className = "zone-card";
      card.style.background = color;
      card.innerHTML = [
        '<div style="display:flex;justify-content:space-between;align-items:flex-start">',
        '<div><div style="font-weight:700;font-size:.88rem;color:rgba(255,255,255,.97)">' + z.name + "</div>",
        '<div style="font-size:.65rem;color:rgba(255,255,255,.75);text-transform:uppercase;letter-spacing:.04em;margin-top:2px">' + zoneIcon(z.type) + " " + z.type + "</div></div>",
        '<div style="font-size:1.3rem">' + (z.emoji || aqiEmoji(z.aqi)) + "</div></div>",
        '<div style="font-family:var(--font-display);font-size:2.4rem;font-weight:900;color:rgba(255,255,255,.97);line-height:1;margin-top:10px;letter-spacing:-.03em">' + z.aqi + "</div>",
        '<div style="font-size:.7rem;color:rgba(255,255,255,.82);font-weight:600;text-transform:uppercase;letter-spacing:.04em;margin-top:2px">' + z.category + "</div>",
        '<div style="height:3px;background:rgba(255,255,255,.2);border-radius:2px;margin-top:8px;overflow:hidden">',
        '<div style="height:100%;width:' + Math.min(100, (z.aqi / 500) * 100) + '%;background:rgba(255,255,255,.6);border-radius:2px"></div></div>'
      ].join("");
      card.addEventListener("click", () => this._zonePopup(z));
      grid.appendChild(card);
    });
  },

  filterZones(type, btn) {
    document.querySelectorAll(".filter-btn").forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    const filtered = type === "all" ? this._zones : this._zones.filter((z) => z.type === type);
    this._drawZones(filtered);
  },

  _zonePopup(z) {
    document.querySelectorAll(".zone-popup").forEach((p) => p.remove());
    const color = z.color || aqiColor(z.aqi);
    const popup = document.createElement("div");
    popup.className = "zone-popup";
    popup.style.cssText = "position:fixed;bottom:20px;right:20px;background:#fff;border-radius:12px;padding:16px;max-width:270px;box-shadow:0 8px 30px rgba(0,0,0,.18);z-index:999;border:1px solid " + color;
    const advice = z.aqi > 200 ? "❌ Avoid if possible today."
      : z.aqi > 100 ? "⚠️ Mask recommended here."
      : "✅ Safe to spend time here.";
    popup.innerHTML = [
      '<div style="display:flex;justify-content:space-between;margin-bottom:10px">',
      '<strong>' + z.name + "</strong>",
      '<button id="zpopClose" style="background:none;border:none;cursor:pointer;color:#999;font-size:1.1rem">✕</button></div>",',
      '<div style="font-family:var(--font-display);font-size:2.5rem;font-weight:900;color:' + color + ';line-height:1">' + z.aqi + "</div>",
      '<div style="font-size:.8rem;color:' + color + ';font-weight:600;margin-bottom:8px">' + z.category + "</div>",
      '<div style="font-size:.78rem;color:var(--text-muted)">' + zoneIcon(z.type) + " " + z.type + "</div>",
      '<div style="margin-top:10px;font-size:.8rem;padding:8px;background:var(--bg);border-radius:6px">' + advice + "</div>"
    ].join("");
    document.body.appendChild(popup);
    popup.querySelector("#zpopClose").addEventListener("click", () => popup.remove());
    setTimeout(() => popup.remove(), 4000);
  },

  // ── FORECAST ────────────────────────────────────────────────────────────────
  async loadForecast() {
    el("fc-best").innerHTML = skel(90);
    el("fc-bar").innerHTML  = skel(90);
    const data = await api("/api/city/" + this.cityId + "/forecast");
    if (!data) return;
    const best  = data.best_time || {};
    const bColor = aqiColor(best.best_aqi || 0);

    el("fc-best").innerHTML = [
      '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">',
      '<div style="background:' + aqiBg(best.best_aqi || 0) + ';border-radius:10px;padding:14px 20px;flex:0 0 auto">',
      '<div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em">Best Time Outside</div>",',
      '<div style="font-family:var(--font-display);font-size:2rem;font-weight:900;color:' + bColor + '">' + (best.best_hour || "—") + "</div>",
      '<div style="font-size:.8rem;color:' + bColor + ';font-weight:600">AQI ' + (best.best_aqi || "—") + " · " + aqiCat(best.best_aqi || 0) + "</div></div>",
      '<div style="flex:1;min-width:180px;font-size:.88rem;font-weight:500">' + (best.recommendation || "") + "</div></div>"
    ].join("");

    const bar = el("fc-bar");
    bar.innerHTML = "";
    (data.forecast || []).forEach((h) => {
      bar.appendChild(makeForecastHour(h, h.aqi === best.best_aqi));
    });

    const canvas = el("fc-canvas");
    if (canvas && data.forecast && data.forecast.length) {
      if (this._chart) { this._chart.destroy(); this._chart = null; }
      this._chart = new Chart(canvas, {
        type: "bar",
        data: {
          labels: data.forecast.map((h) => h.label || h.hour),
          datasets: [{
            label: "AQI",
            data:  data.forecast.map((h) => h.aqi),
            backgroundColor: data.forecast.map((h) => aqiColor(h.aqi) + "cc"),
            borderColor:     data.forecast.map((h) => aqiColor(h.aqi)),
            borderWidth: 1,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: true,
          plugins: {
            legend: { display: false },
            tooltip: { callbacks: { label: (c) => "AQI " + c.raw + " — " + aqiCat(c.raw) } }
          },
          scales: {
            y: { beginAtZero: true, grid: { color: "#f0ede8" }, ticks: { font: { size: 11 } } },
            x: { grid: { display: false }, ticks: { font: { size: 11 } } }
          }
        }
      });
    }
  },

  // ── DAILY BRIEF ─────────────────────────────────────────────────────────────
  async loadBrief() {
    el("brief-body").innerHTML = skel(200);
    const prefs = this._prefs();
    const q     = new URLSearchParams({ kids: !!prefs.kids, pets: !!prefs.pets, runner: !!prefs.runner, cyclist: !!prefs.cyclist });
    const d     = await api("/api/city/" + this.cityId + "/brief?" + q);
    if (!d) { el("brief-body").innerHTML = "<p>Failed to load brief.</p>"; return; }

    const color = d.color || aqiColor(d.aqi);
    const bg    = aqiBg(d.aqi);
    const body  = el("brief-body");
    body.innerHTML = "";

    // Headline card
    const headCard = document.createElement("div");
    headCard.className = "card";
    headCard.style.cssText = "background:linear-gradient(135deg," + bg + ",#fff 70%);border-color:" + color + "40;margin-bottom:16px";
    headCard.innerHTML = [
      '<div style="display:flex;align-items:center;gap:12px">',
      '<div style="font-size:2.8rem">' + (d.emoji || aqiEmoji(d.aqi)) + " " + (d.weather_emoji || "🌤️") + "</div>",
      "<div>",
      '<div style="font-size:.78rem;color:var(--text-muted)">' + (d.greeting || "Hello") + ", " + (d.city || this.cityName) + "</div>",
      '<div style="font-family:var(--font-display);font-size:1.25rem;font-weight:700;line-height:1.3;margin-top:3px">' + (d.headline || "") + "</div>",
      '<div style="margin-top:6px;display:flex;gap:8px;align-items:center;flex-wrap:wrap">',
      '<span class="aqi-pill" style="background:' + color + '">AQI ' + d.aqi + " · " + d.category + "</span>",
      '<span style="font-size:.8rem;color:var(--text-muted)">' + (d.temp_c != null ? d.temp_c + "°C " : "") + (d.condition ? "· " + d.condition : "") + "</span>",
      "</div></div></div>"
    ].join("");
    body.appendChild(headCard);

    // Checklist + tips grid
    const grid1 = document.createElement("div");
    grid1.className = "g2";
    grid1.style.marginBottom = "16px";

    const chkCard = document.createElement("div");
    chkCard.className = "card";
    chkCard.innerHTML = '<div class="card-title">☀️ Morning Checklist</div>';
    (d.checklist || []).forEach((item, i) => {
      const row = document.createElement("div");
      row.className = "chk-item";
      row.innerHTML = [
        '<div class="chk-box"></div>',
        '<span style="font-size:1.1rem;margin-right:2px">' + (item.icon || "") + "</span>",
        '<span class="chk-label">' + item.item + (item.critical ? ' <span style="font-size:.68rem;color:var(--poor);font-weight:600">Required</span>' : "") + "</span>"
      ].join("");
      row.addEventListener("click", function () {
        this.classList.toggle("done");
        this.querySelector(".chk-box").textContent = this.classList.contains("done") ? "✓" : "";
      });
      chkCard.appendChild(row);
    });

    const tipsCard = document.createElement("div");
    tipsCard.className = "card";
    tipsCard.innerHTML = '<div class="card-title">💡 Tips for Today</div>';
    if ((d.tips || []).length) {
      d.tips.forEach((t) => {
        const tipEl = document.createElement("div");
        tipEl.style.cssText = "font-size:.85rem;padding:8px 0;border-bottom:1px solid var(--border);line-height:1.4";
        tipEl.textContent = t;
        tipsCard.appendChild(tipEl);
      });
    } else {
      tipsCard.innerHTML += '<div style="font-size:.85rem;color:var(--good)">No special precautions today! 🌿</div>';
    }

    grid1.appendChild(chkCard);
    grid1.appendChild(tipsCard);
    body.appendChild(grid1);

    // Key advice + city life
    const grid2 = document.createElement("div");
    grid2.className = "g2";
    grid2.style.marginBottom = "16px";

    const advCard = document.createElement("div");
    advCard.className = "card";
    advCard.innerHTML = '<div class="card-title">🎯 Key Advice</div>';
    [["Mask", d.mask && d.mask.message], ["Best Time", d.outdoor_timing], ["Indoor Air", d.indoor_air], ["Clothing", d.clothing]].forEach(([label, val]) => {
      if (val) {
        const tile = document.createElement("div");
        tile.style.cssText = "padding:9px;border-radius:8px;background:var(--bg);margin-bottom:8px";
        tile.innerHTML = '<div style="font-size:.65rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:.04em">' + label + '</div><div style="font-size:.875rem;margin-top:2px;font-weight:500">' + val + "</div>";
        advCard.appendChild(tile);
      }
    });

    const cityCard = document.createElement("div");
    cityCard.className = "card";
    cityCard.innerHTML = '<div class="card-title">🏙️ City Life</div>';
    if (d.commute) {
      const tile = document.createElement("div");
      tile.style.cssText = "padding:11px;border-radius:8px;background:var(--bg);margin-bottom:10px" + (d.commute.critical ? ";border-left:3px solid var(--poor)" : "");
      tile.innerHTML = '<div style="font-size:1.2rem">' + (d.commute.icon || "") + '</div><div style="font-size:.875rem;font-weight:500;margin-top:4px">' + (d.commute.advice || "") + "</div>" + (d.commute.detail ? '<div style="font-size:.75rem;color:var(--text-muted);margin-top:3px">' + d.commute.detail + "</div>" : "");
      cityCard.appendChild(tile);
    }
    if (d.food_suggestion) {
      const tile = document.createElement("div");
      tile.style.cssText = "padding:11px;border-radius:8px;background:var(--bg)";
      tile.innerHTML = '<div style="font-size:1.2rem">' + (d.food_suggestion.icon || "") + '</div><div style="font-size:.875rem;font-weight:500;margin-top:4px">' + (d.food_suggestion.suggestion || "") + "</div>" + (d.food_suggestion.detail ? '<div style="font-size:.75rem;color:var(--text-muted);margin-top:3px">' + d.food_suggestion.detail + "</div>" : "");
      cityCard.appendChild(tile);
    }

    grid2.appendChild(advCard);
    grid2.appendChild(cityCard);
    body.appendChild(grid2);

    // Personalise
    const prefCard = document.createElement("div");
    prefCard.className = "card";
    prefCard.style.border = "1px dashed var(--border-dark)";
    prefCard.innerHTML = '<div class="card-title">⚙️ Personalise</div><div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:10px" id="brief-pref-btns"></div><div style="font-size:.75rem;color:var(--text-muted)">Preferences saved locally.</div>';
    body.appendChild(prefCard);

    const btnContainer = el("brief-pref-btns");
    [["kids", "👧 I have kids"], ["pets", "🐕 I have pets"], ["runner", "🏃 I run"], ["cyclist", "🚴 I cycle"]].forEach(([key, label]) => {
      const prefs = this._prefs();
      const btn   = document.createElement("button");
      btn.style.cssText = "padding:6px 13px;border-radius:20px;border:1px solid var(--border);background:" + (prefs[key] ? "var(--accent)" : "var(--bg-card)") + ";color:" + (prefs[key] ? "#fff" : "var(--text)") + ";cursor:pointer;font-size:.8rem;transition:all .15s";
      btn.textContent = label;
      btn.addEventListener("click", () => {
        const p = this._prefs();
        p[key] = !p[key];
        localStorage.setItem("aqi_prefs", JSON.stringify(p));
        btn.style.background = p[key] ? "var(--accent)" : "var(--bg-card)";
        btn.style.color      = p[key] ? "#fff" : "var(--text)";
        this.loadBrief();
      });
      btnContainer.appendChild(btn);
    });
  },

  _prefs() {
    try { return JSON.parse(localStorage.getItem("aqi_prefs") || "{}"); } catch { return {}; }
  },

  // ── ACTIVITIES ──────────────────────────────────────────────────────────────
  async loadActivities() {
    el("act-body").innerHTML = skel(200);
    const [act, venues] = await Promise.all([
      api("/api/city/" + this.cityId + "/activities"),
      api("/api/city/" + this.cityId + "/places")
    ]);
    if (!act) { el("act-body").innerHTML = "<p>Failed to load activities.</p>"; return; }

    const ov    = act.overall || {};
    const color = ov.color || aqiColor(act.aqi);
    const body  = el("act-body");
    body.innerHTML = "";

    const ovCard = document.createElement("div");
    ovCard.className = "card";
    ovCard.style.cssText = "background:linear-gradient(135deg," + aqiBg(act.aqi) + ",#fff 70%);border-color:" + color + "40;margin-bottom:16px";
    ovCard.innerHTML = '<div style="display:flex;align-items:center;gap:12px"><div style="font-size:2.5rem">' + aqiEmoji(act.aqi) + '</div><div><div style="font-family:var(--font-display);font-size:1.25rem;font-weight:700">' + (ov.label || "") + '</div><div style="font-size:.85rem;color:var(--text-muted);margin-top:4px">AQI: <strong style="color:' + color + '">' + act.aqi + "</strong> · " + aqiCat(act.aqi) + "</div></div></div>";
    body.appendChild(ovCard);

    const actCard = document.createElement("div");
    actCard.className = "card";
    actCard.style.marginBottom = "16px";
    actCard.innerHTML = '<div class="card-title">Activity Safety Today</div><div class="g3" id="act-grid"></div>';
    body.appendChild(actCard);

    const grid = el("act-grid");
    Object.values(act.activities || {}).forEach((a) => {
      const sc  = a.safe ? "var(--good)" : a.caution ? "var(--moderate)" : "var(--very-poor)";
      const sbg = a.safe ? "#f5fdf8" : a.caution ? "#fffdf0" : "#fff8f8";
      const card = document.createElement("div");
      card.className = "act-card";
      card.style.cssText = "background:" + sbg + ";border-color:" + sc + "40";
      card.innerHTML = [
        '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">',
        '<span style="font-size:1.8rem">' + a.icon + '</span>',
        '<span style="font-weight:700;font-size:.88rem;flex:1">' + a.label + '</span>',
        '<span style="font-size:1.1rem">' + (a.safe ? "✅" : a.caution ? "⚠️" : "❌") + "</span></div>",
        '<div style="font-size:.8rem;font-weight:500;color:' + sc + ';line-height:1.4">' + a.message + "</div>",
        '<div style="font-size:.7rem;color:var(--text-muted);margin-top:4px">Safe ≤' + a.max_safe + "</div>",
        '<div style="height:3px;background:var(--border);border-radius:2px;margin-top:8px;overflow:hidden">',
        '<div style="height:100%;width:' + Math.min(100, (act.aqi / a.max_caution) * 100) + '%;background:' + sc + ';border-radius:2px;transition:width .6s"></div></div>'
      ].join("");
      grid.appendChild(card);
    });

    // Venues
    const venCard = document.createElement("div");
    venCard.className = "card";
    venCard.innerHTML = '<div class="card-title" style="margin-bottom:14px">🏋️ Indoor Venues</div><div class="g2" id="venue-grid"></div>';
    body.appendChild(venCard);
    const vgrid = el("venue-grid");
    if (venues && (venues.venues || []).length) {
      venues.venues.slice(0, 6).forEach((v) => {
        const a = document.createElement("a");
        a.className = "venue-card";
        a.href      = v.maps_url || "#";
        a.target    = "_blank";
        a.innerHTML = [
          '<div style="font-size:1.5rem;width:38px;height:38px;display:flex;align-items:center;justify-content:center;background:var(--bg-card);border:1px solid var(--border);border-radius:8px;flex-shrink:0">' + v.icon + "</div>",
          '<div style="flex:1;min-width:0">',
          '<div style="font-weight:700;font-size:.85rem;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">' + v.name + "</div>",
          '<div style="font-size:.72rem;color:var(--text-muted)">' + v.area + " · " + (v.type_label || v.type || "").replace(/_/g, " ") + "</div>",
          v.ac ? '<span style="font-size:.62rem;background:#e3f2fd;color:#1565c0;padding:1px 5px;border-radius:3px;font-weight:600">AC</span>' : "",
          "</div>",
          '<div style="font-size:.8rem;color:#f4a61d;font-weight:600;white-space:nowrap">★ ' + (v.rating || "—") + "</div>"
        ].join("");
        vgrid.appendChild(a);
      });
    } else {
      vgrid.innerHTML = '<div style="color:var(--text-muted);font-size:.85rem">No venue data for this city.</div>';
    }
  },

  // ── CALENDAR ────────────────────────────────────────────────────────────────
  async loadCalendar() {
    el("cal-body").innerHTML = skel(300);
    const [cal, analysis] = await Promise.all([
      api("/api/city/" + this.cityId + "/calendar"),
      api("/api/city/" + this.cityId + "/calendar/analysis")
    ]);
    if (!cal) { el("cal-body").innerHTML = "<p>Failed to load calendar.</p>"; return; }

    const s    = cal.summary || {};
    const days = cal.days    || [];
    const body = el("cal-body");
    body.innerHTML = "";

    const statsGrid = document.createElement("div");
    statsGrid.className = "g4";
    statsGrid.style.marginBottom = "16px";
    [
      [s.good_days,            "Good Days",    "var(--good)"],
      [s.bad_days,             "Bad Days",     "var(--very-poor)"],
      [(s.good_percent || 0) + "%", "Clean Air", "var(--accent)"],
      [(s.current_streak && s.current_streak.count) || 0, "Streak 🔥", "var(--accent)"]
    ].forEach(([val, label, color]) => {
      const tile = document.createElement("div");
      tile.className = "card";
      tile.style.textAlign = "center";
      tile.innerHTML = '<div style="font-family:var(--font-display);font-size:2rem;font-weight:900;color:' + color + '">' + val + '</div><div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;margin-top:3px">' + label + "</div>";
      statsGrid.appendChild(tile);
    });
    body.appendChild(statsGrid);

    const mainGrid = document.createElement("div");
    mainGrid.className = "g2";
    body.appendChild(mainGrid);

    // Calendar grid card
    const calCard = document.createElement("div");
    calCard.className = "card";
    calCard.innerHTML = '<div class="card-title">📅 This Month</div><div class="cal-grid" id="cal-grid" style="margin-bottom:10px"></div>';
    mainGrid.appendChild(calCard);

    const calGrid = el("cal-grid");
    ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].forEach((d) => {
      const hdr = document.createElement("div");
      hdr.style.cssText = "text-align:center;font-size:.65rem;font-weight:700;color:var(--text-muted);padding:3px 0;text-transform:uppercase";
      hdr.textContent = d;
      calGrid.appendChild(hdr);
    });

    const firstDate = new Date(days[0] && days[0].date);
    const firstDow  = firstDate.getDay();
    const padCount  = firstDow === 0 ? 6 : firstDow - 1;
    for (let i = 0; i < padCount; i++) {
      calGrid.appendChild(document.createElement("div"));
    }

    const today = new Date().toISOString().slice(0, 10);
    days.forEach((d) => {
      const color = d.color || aqiColor(d.aqi);
      const bg    = aqiBg(d.aqi);
      const cell  = document.createElement("div");
      cell.className = "cal-cell";
      cell.style.cssText = "background:" + bg + ";border:" + (d.date === today ? "2px solid " + color : "1.5px solid transparent");
      cell.title     = d.date + ": AQI " + d.aqi + " (" + d.category + ")";
      cell.innerHTML = '<div style="font-size:.75rem;font-weight:700;color:' + color + '">' + d.day + '</div><div style="font-size:.6rem;color:' + color + '">' + d.aqi + "</div>";
      cell.addEventListener("click", () => this._dayPopup(d));
      calGrid.appendChild(cell);
    });

    // Side column
    const sideCol = document.createElement("div");
    sideCol.style.cssText = "display:flex;flex-direction:column;gap:14px";
    mainGrid.appendChild(sideCol);

    if (s.best_day) {
      const hlCard = document.createElement("div");
      hlCard.className = "card";
      hlCard.innerHTML = [
        '<div class="card-title">🏅 Highlights</div>',
        '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#e8f8ee;border-radius:8px;margin-bottom:8px">',
        "<span>🌿</span><div><div>Cleanest Day</div><div><strong>" + s.best_day.date + " · AQI " + s.best_day.aqi + "</strong></div></div></div>",
        '<div style="display:flex;align-items:center;gap:10px;padding:10px;background:#ffe6e6;border-radius:8px">',
        "<span>😷</span><div><div>Most Polluted</div><div><strong>" + s.worst_day.date + " · AQI " + s.worst_day.aqi + "</strong></div></div></div>"
      ].join("");
      sideCol.appendChild(hlCard);
    }

    if (analysis && analysis.weekday_averages) {
      const dowCard = document.createElement("div");
      dowCard.className = "card";
      dowCard.innerHTML = '<div class="card-title">📊 Day-of-Week</div>';
      const maxVal = Math.max(...Object.values(analysis.weekday_averages));
      Object.entries(analysis.weekday_averages).forEach(([day, val]) => {
        const isBest = day === analysis.best_day_of_week;
        const color  = aqiColor(val);
        const row    = document.createElement("div");
        row.style.cssText = "display:flex;align-items:center;gap:8px;padding:4px 0";
        row.innerHTML = [
          '<div style="width:26px;font-size:.72rem;color:var(--text-muted);font-weight:' + (isBest ? "700" : "400") + '">' + day + "</div>",
          '<div style="flex:1;height:5px;background:var(--border);border-radius:2px;overflow:hidden">',
          '<div style="height:100%;width:' + Math.round((val / maxVal) * 100) + '%;background:' + color + ';border-radius:2px"></div></div>",',
          '<div style="font-size:.75rem;font-family:var(--font-mono);color:' + color + ';min-width:26px;text-align:right">' + val + "</div>",
          isBest ? '<span style="font-size:.65rem;color:var(--good)">✓</span>' : ""
        ].join("");
        dowCard.appendChild(row);
      });
      if (analysis.insight) {
        const ins = document.createElement("div");
        ins.style.cssText = "margin-top:10px;font-size:.78rem;padding:8px;background:var(--bg);border-radius:6px;color:var(--text-muted)";
        ins.textContent = analysis.insight;
        dowCard.appendChild(ins);
      }
      sideCol.appendChild(dowCard);
    }
  },

  _dayPopup(d) {
    const color = d.color || aqiColor(d.aqi);
    document.querySelectorAll(".day-popup").forEach((p) => p.remove());
    const advice = d.aqi <= 100 ? "✅ Good air day." : d.aqi <= 200 ? "⚠️ Moderate — some caution needed." : "❌ Poor air — outdoor activity not recommended.";
    const bar = makeAlertBar(d.aqi, d.date + " — " + d.category + " · AQI " + d.aqi, advice, null);
    bar.className += " day-popup";
    bar.style.marginTop = "12px";
    const close = document.createElement("button");
    close.style.cssText = "background:none;border:none;cursor:pointer;color:#999;font-size:1rem;flex-shrink:0";
    close.textContent = "✕";
    close.addEventListener("click", () => bar.remove());
    bar.appendChild(close);
    el("cal-body").appendChild(bar);
  },

  // ── SCHOOL ──────────────────────────────────────────────────────────────────
  async loadSchool() {
    el("school-body").innerHTML = skel(200);
    const d = await api("/api/city/" + this.cityId + "/school");
    if (!d) { el("school-body").innerHTML = "<p>Failed.</p>"; return; }

    const al  = d.school_alert_level || {};
    const rec = d.recess  || {};
    const com = d.commute || {};
    const body = el("school-body");
    body.innerHTML = "";

    const hdr = document.createElement("div");
    hdr.className = "school-hdr";
    hdr.style.background = al.color || "var(--good)";
    hdr.innerHTML = [
      "<div>",
      '<div style="font-size:.72rem;letter-spacing:.06em;text-transform:uppercase;opacity:.85">School Alert Level</div>',
      '<div style="font-family:var(--font-display);font-size:1.8rem;font-weight:900;line-height:1">' + (al.label || "") + "</div>",
      '<div style="font-size:.9rem;margin-top:4px;opacity:.9">' + (al.action || "") + "</div></div>",
      '<div style="margin-left:auto;text-align:right">',
      '<div style="font-family:var(--font-display);font-size:3rem;font-weight:900;line-height:1">' + d.aqi + "</div>",
      '<div style="font-size:.72rem;opacity:.85">Current AQI</div></div>'
    ].join("");
    body.appendChild(hdr);

    const row1 = document.createElement("div");
    row1.className = "g2";
    row1.style.marginBottom = "16px";
    row1.innerHTML = [
      '<div class="card" style="border-left:4px solid ' + (rec.color || "var(--good)") + '">',
      '<div class="card-title">⛹️ Recess Decision</div>',
      '<div style="font-size:1.8rem;margin-bottom:8px">' + (rec.icon || "") + "</div>",
      '<div style="font-size:1rem;font-weight:700;color:' + (rec.color || "var(--good)") + '">' + rec.message + "</div>",
      '<div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:6px;font-size:.82rem;color:var(--text-muted)">Duration: <strong>' + rec.duration + "</strong></div></div>",
      '<div class="card">',
      '<div class="card-title">🚶 Commute</div>',
      '<div style="font-size:1.8rem;margin-bottom:8px">' + (com.icon || "") + "</div>",
      '<div style="font-size:.9rem;font-weight:600">' + com.message + "</div>",
      com.mask ? '<div style="margin-top:8px;font-size:.82rem;display:inline-flex;align-items:center;gap:6px;background:' + aqiBg(d.aqi) + ';padding:6px 12px;border-radius:8px">😷 Mask: <strong>' + (com.mask_type || "Surgical") + "</strong></div>"
               : '<div style="margin-top:8px;font-size:.82rem;color:var(--good)">✅ No mask needed</div>',
      "</div>"
    ].join("");
    body.appendChild(row1);

    const ageCard = document.createElement("div");
    ageCard.className = "card";
    ageCard.style.marginBottom = "16px";
    ageCard.innerHTML = '<div class="card-title">👶 Age Group Safety</div><div class="g4" id="age-grid"></div>';
    body.appendChild(ageCard);
    const ageGrid = el("age-grid");
    Object.values(d.age_groups || {}).forEach((ag) => {
      const tile = document.createElement("div");
      tile.style.cssText = "border-radius:10px;padding:13px;background:" + aqiBg(d.aqi) + ";border:1px solid " + ag.color + "40";
      tile.innerHTML = [
        '<div style="display:flex;justify-content:space-between;margin-bottom:5px">',
        '<div style="font-size:.78rem;font-weight:600">' + ag.label + "</div>",
        '<span>' + (ag.status === "safe" ? "✅" : ag.status === "caution" ? "⚠️" : "❌") + "</span></div>",
        '<div style="font-size:.72rem;color:var(--text-muted);margin-bottom:5px">Safe ≤ AQI ' + ag.max_safe_aqi + "</div>",
        '<div style="font-size:.75rem;color:' + ag.color + ';font-weight:500">' + ag.advice + "</div>"
      ].join("");
      ageGrid.appendChild(tile);
    });

    const row2 = document.createElement("div");
    row2.className = "g2";
    const advCard = document.createElement("div");
    advCard.className = "card";
    advCard.innerHTML = '<div class="card-title">📋 Advisory</div>';
    (d.general_advisory || []).forEach((a) => {
      const item = document.createElement("div");
      item.style.cssText = "font-size:.85rem;padding:8px 0;border-bottom:1px solid var(--border);line-height:1.5";
      item.textContent = a;
      advCard.appendChild(item);
    });
    const msgCard = document.createElement("div");
    msgCard.className = "card";
    msgCard.style.border = "1px dashed var(--border-dark)";
    msgCard.innerHTML = [
      '<div class="card-title">📱 Parent Message</div>',
      '<div style="background:var(--bg);border-radius:8px;padding:12px;font-size:.85rem;line-height:1.6;border-left:3px solid #25d366;font-style:italic">"' + d.parent_message + '"</div>',
      '<button id="wa-copy-btn" style="margin-top:10px;width:100%;padding:9px;border-radius:8px;background:#25d366;color:#fff;border:none;cursor:pointer;font-size:.85rem;font-weight:600">📋 Copy for WhatsApp</button>'
    ].join("");
    row2.appendChild(advCard);
    row2.appendChild(msgCard);
    body.appendChild(row2);

    el("wa-copy-btn").addEventListener("click", function () {
      navigator.clipboard.writeText(d.parent_message).then(() => {
        this.textContent = "✅ Copied!";
        setTimeout(() => { this.textContent = "📋 Copy for WhatsApp"; }, 2000);
      });
    });
  },

  // ── ALERTS ──────────────────────────────────────────────────────────────────
  async loadAlerts() {
    el("alert-body").innerHTML = skel(200);
    const [status, aqiData] = await Promise.all([
      api("/api/alert/" + this.session + "/" + this.cityId),
      api("/api/city/" + this.cityId)
    ]);
    const aqi   = aqiData ? aqiData.aqi : 100;
    const saved = parseInt(localStorage.getItem("aqi_threshold") || "150");
    const body  = el("alert-body");
    body.innerHTML = "";

    if (status && status.triggered) {
      body.appendChild(makeAlertBar(aqi, status.message, status.action ? status.action.text : null, null));
    }

    const grid = document.createElement("div");
    grid.className = "g2";
    body.appendChild(grid);

    // Setup card
    const setCard = document.createElement("div");
    setCard.className = "card";
    setCard.innerHTML = [
      '<div class="card-title">🔔 Set Your Alert</div>',
      '<div style="font-size:.85rem;color:var(--text-muted);margin-bottom:14px">Alert when AQI in <strong>' + this.cityName + "</strong> crosses:</div>",
      '<div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px">',
      '<span style="font-size:.85rem;font-weight:500">Threshold</span>',
      '<span id="thresh-val" style="font-family:var(--font-display);font-size:2.2rem;font-weight:900;color:' + aqiColor(saved) + '">' + saved + "</span></div>",
      '<input type="range" id="thresh-slider" min="50" max="400" step="10" value="' + saved + '" style="margin-bottom:8px">',
      '<div id="thresh-hint" style="font-size:.75rem;color:var(--text-muted);margin-bottom:14px">' + this._threshHint(saved) + "</div>",
      '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px" id="thresh-presets"></div>',
      '<button id="save-alert-btn" style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">💾 Save Alert</button>'
    ].join("");
    grid.appendChild(setCard);

    el("thresh-slider").addEventListener("input", (e) => {
      const v = parseInt(e.target.value);
      el("thresh-val").textContent    = v;
      el("thresh-val").style.color    = aqiColor(v);
      el("thresh-hint").textContent   = this._threshHint(v);
      localStorage.setItem("aqi_threshold", v);
    });

    const presets = el("thresh-presets");
    [[50, "Good"], [100, "Satisfactory"], [150, "Moderate"], [200, "Poor"], [300, "Very Poor"]].forEach(([v, label]) => {
      const btn = document.createElement("button");
      btn.style.cssText = "padding:4px 10px;border-radius:16px;border:1px solid " + aqiColor(v) + ";background:" + aqiBg(v) + ";color:" + aqiColor(v) + ";font-size:.72rem;cursor:pointer;font-weight:500";
      btn.textContent = label + " (" + v + ")";
      btn.addEventListener("click", () => {
        el("thresh-slider").value        = v;
        el("thresh-val").textContent     = v;
        el("thresh-val").style.color     = aqiColor(v);
        el("thresh-hint").textContent    = this._threshHint(v);
        localStorage.setItem("aqi_threshold", v);
      });
      presets.appendChild(btn);
    });

    el("save-alert-btn").addEventListener("click", async () => {
      const threshold = parseInt(localStorage.getItem("aqi_threshold") || "150");
      const btn = el("save-alert-btn");
      await fetch("/api/alert/set", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ session_id: this.session, city_id: this.cityId, threshold })
      });
      btn.textContent       = "✅ Saved!";
      btn.style.background  = "var(--good)";
      setTimeout(() => { btn.textContent = "💾 Save Alert"; btn.style.background = "var(--accent)"; this.loadAlerts(); }, 2000);
    });

    // Status card
    const stCard = document.createElement("div");
    stCard.className = "card";
    stCard.innerHTML = [
      '<div class="card-title">📊 Right Now</div>',
      '<div style="text-align:center;padding:16px 0">',
      '<div style="font-family:var(--font-display);font-size:4rem;font-weight:900;color:' + aqiColor(aqi) + ';line-height:1">' + aqi + "</div>",
      '<span class="aqi-pill" style="background:' + aqiColor(aqi) + '">' + aqiCat(aqi) + "</span></div>",
      '<div style="padding:12px;background:var(--bg);border-radius:8px;text-align:center;font-size:.85rem">',
      status && status.active
        ? "Threshold: <strong>" + saved + "</strong><br><span style='color:" + (status.triggered ? aqiColor(aqi) : "var(--good)") + ";font-weight:600;display:block;margin-top:4px'>" + (status.triggered ? "🚨 " + (aqi - saved) + " above threshold" : "✅ " + (saved - aqi) + " below threshold") + "</span>"
        : "No alert set yet.",
      "</div>",
      status && status.suggestion
        ? '<div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:8px;border-left:3px solid var(--accent)"><div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px">Suggestion</div><div style="font-size:.82rem">' + status.suggestion.reason + "</div></div>"
        : ""
    ].join("");
    grid.appendChild(stCard);
  },

  _threshHint(v) {
    if (v <= 50)  return "Very sensitive — alert on any pollution.";
    if (v <= 100) return "Alert when air dips below satisfactory.";
    if (v <= 150) return "⚠️ Recommended for sensitive groups.";
    if (v <= 200) return "Alert at Poor level — minimum recommended.";
    if (v <= 300) return "Late warning — only very poor air.";
    return "Extreme only — consider lowering this.";
  },

  // ── COMMUNITY ───────────────────────────────────────────────────────────────
  async loadCommunity() {
    el("comm-body").innerHTML = skel(200);
    const [profile, score] = await Promise.all([
      api("/api/user/" + this.session + "/" + this.cityId),
      api("/api/city/" + this.cityId + "/community")
    ]);
    if (!profile) { el("comm-body").innerHTML = "<p>Failed.</p>"; return; }

    const rank  = profile.rank  || {};
    const sc    = score ? score.score : 60;
    const gr    = score ? score.grade : {};
    const body  = el("comm-body");
    body.innerHTML = "";

    const topGrid = document.createElement("div");
    topGrid.className = "g2";
    topGrid.style.marginBottom = "16px";
    body.appendChild(topGrid);

    // Streak card
    const strCard = document.createElement("div");
    strCard.className = "card";
    strCard.style.cssText = "background:linear-gradient(135deg,#1a1a1a,#2d2d2d);color:#fff";
    const streak = profile.streak || 0;
    strCard.innerHTML = [
      '<div style="display:flex;align-items:flex-start;justify-content:space-between">',
      "<div>",
      '<div style="font-size:.72rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em">Daily Streak</div>',
      '<div style="font-family:var(--font-display);font-size:4rem;font-weight:900;color:var(--accent);line-height:1;margin-top:4px">' + streak + "</div>",
      '<div style="font-size:.85rem;color:rgba(255,255,255,.6);margin-top:4px">' + (streak === 0 ? "Check in to start! 🌱" : streak === 1 ? "Day 1! Keep going." : streak + " days strong 🔥") + "</div>",
      "</div>",
      '<div style="text-align:center;background:rgba(255,255,255,.08);border-radius:10px;padding:12px">',
      '<div style="font-size:1.8rem">' + (rank.icon || "👋") + "</div>",
      '<div style="font-size:.7rem;color:' + (rank.color || "#ffd700") + ';font-weight:700;margin-top:3px">' + (rank.title || "Newcomer") + "</div></div></div>",
      '<div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap">',
      '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;color:rgba(255,255,255,.7);cursor:pointer"><input type="checkbox" id="ci-mask"> Wore a mask</label>',
      '<label style="display:flex;align-items:center;gap:6px;font-size:.8rem;color:rgba(255,255,255,.7);cursor:pointer"><input type="checkbox" id="ci-in"> Stayed indoors</label>',
      "</div>",
      '<button id="ci-btn" style="margin-top:10px;width:100%;padding:10px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer">✅ Check In Today</button>',
      '<div id="ci-result" style="margin-top:7px;font-size:.8rem;color:rgba(255,255,255,.6)"></div>'
    ].join("");
    topGrid.appendChild(strCard);

    el("ci-btn").addEventListener("click", () => this._checkIn());

    // City score card
    const scoreCard = document.createElement("div");
    scoreCard.className = "card";
    scoreCard.innerHTML = [
      '<div class="card-title">🏙️ ' + this.cityName + " Score</div>",
      '<div style="text-align:center;padding:10px 0">',
      '<svg width="130" height="75" viewBox="0 0 130 75" style="overflow:visible">',
      '<path d="M 15 65 A 50 50 0 0 1 115 65" fill="none" stroke="#e8e5e0" stroke-width="10" stroke-linecap="round"/>',
      '<path d="M 15 65 A 50 50 0 0 1 115 65" fill="none" stroke="' + (gr.color || "#00b050") + '" stroke-width="10" stroke-linecap="round" stroke-dasharray="' + Math.round(sc * 1.57) + ' 157"/>',
      '<text x="65" y="68" text-anchor="middle" font-size="24" font-weight="900" font-family="Playfair Display,serif" fill="' + (gr.color || "#00b050") + '">' + sc + "</text></svg>",
      '<span class="aqi-pill" style="background:' + (gr.color || "var(--good)") + '">' + (gr.letter || "B") + " — " + (gr.label || "Good") + "</span></div>",
      '<div style="font-size:.8rem;color:var(--text-muted);text-align:center;margin:8px 0">' + (score ? score.message : "") + "</div>",
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">',
      '<div style="padding:9px;background:var(--bg);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:1.3rem;font-weight:900;color:var(--accent)">' + ((score ? score.reporters_today : 0) || 0).toLocaleString() + '</div><div style="font-size:.68rem;color:var(--text-muted)">Reports Today</div></div>',
      '<div style="padding:9px;background:var(--bg);border-radius:8px;text-align:center"><div style="font-family:var(--font-display);font-size:1.3rem;font-weight:900;color:var(--accent)">' + ((score ? score.masked_today : 0) || 0).toLocaleString() + '</div><div style="font-size:.68rem;color:var(--text-muted)">Masked Today</div></div>',
      "</div>"
    ].join("");
    topGrid.appendChild(scoreCard);

    // Badges
    const badgeCard = document.createElement("div");
    badgeCard.className = "card";
    const earned    = new Set((profile.badges || []).map((b) => b.id));
    const allBadges = profile.all_badge_defs || [];
    badgeCard.innerHTML = '<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px"><div class="card-title" style="margin:0">🏅 Badges</div><span style="font-size:.8rem;color:var(--text-muted)">' + earned.size + "/" + allBadges.length + " earned</span></div>";

    const badgeGrid = document.createElement("div");
    badgeGrid.style.cssText = "display:grid;grid-template-columns:repeat(auto-fill,minmax(125px,1fr));gap:10px";
    const tierColors = { bronze: "#cd7f32", silver: "#9e9e9e", gold: "#ffc107", platinum: "#7b68ee" };
    allBadges.forEach((b) => {
      const isEarned = earned.has(b.id);
      const prog     = profile.progress ? profile.progress.find((p) => p.id === b.id) : null;
      const tc       = tierColors[b.tier] || "#9e9e9e";
      const card     = document.createElement("div");
      card.className = "badge-card" + (isEarned ? " earned" : "");
      card.style.borderTop = "3px solid " + tc;
      card.innerHTML = [
        isEarned ? '<div style="position:absolute;top:7px;right:7px;font-size:.55rem;font-weight:700;color:#ffc107">EARNED</div>' : "",
        '<div style="font-size:2rem;filter:' + (isEarned ? "none" : "grayscale(1) opacity(.35)") + '">' + b.icon + "</div>",
        '<div style="font-size:.78rem;font-weight:700;margin-top:5px">' + b.name + "</div>",
        '<div style="font-size:.68rem;color:var(--text-muted);margin-top:2px;line-height:1.3">' + b.desc + "</div>",
        !isEarned && prog ? '<div class="prog"><div class="prog-fill" style="width:' + prog.percent + '%"></div></div><div style="font-size:.6rem;color:var(--text-muted);margin-top:2px;text-align:right">' + prog.current + "/" + prog.required + "</div>" : ""
      ].join("");
      badgeGrid.appendChild(card);
    });
    badgeCard.appendChild(badgeGrid);
    body.appendChild(badgeCard);

    const badgePop = document.createElement("div");
    badgePop.id = "badge-pop";
    body.appendChild(badgePop);
  },

  async _checkIn() {
    const mask   = el("ci-mask") && el("ci-mask").checked;
    const indoor = el("ci-in")   && el("ci-in").checked;
    const res = await fetch("/api/checkin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ session_id: this.session, city_id: this.cityId, wore_mask: mask, stayed_indoors: indoor })
    });
    const data = await res.json();
    const r = el("ci-result");
    if (!r) return;
    if (data.status === "already_checked_in") { r.textContent = "✓ Already checked in today!"; return; }
    r.textContent = "🔥 Streak: " + data.streak + " days";
    if (data.new_badges && data.new_badges.length) {
      const b = data.new_badges[0];
      const pop = el("badge-pop");
      pop.innerHTML = [
        '<div style="position:fixed;bottom:28px;right:28px;background:#fff;border:2px solid #ffc107;border-radius:14px;padding:20px;max-width:260px;box-shadow:0 10px 40px rgba(0,0,0,.2);z-index:1000;text-align:center">',
        '<div style="font-size:3rem">' + b.icon + "</div>",
        '<div style="font-weight:800;margin-top:8px">🎉 Badge Unlocked!</div>',
        '<div style="font-size:.9rem;color:#ffc107;font-weight:700;margin-top:4px">' + b.name + "</div>",
        '<div style="font-size:.75rem;color:var(--text-muted);margin-top:4px">' + b.desc + "</div>",
        '<button id="badge-pop-close" style="margin-top:10px;padding:7px 20px;background:#ffc107;border:none;border-radius:8px;cursor:pointer;font-weight:700">Awesome!</button>',
        "</div>"
      ].join("");
      el("badge-pop-close").addEventListener("click", () => { pop.innerHTML = ""; });
      setTimeout(() => { pop.innerHTML = ""; }, 5000);
    }
    setTimeout(() => this.loadCommunity(), 1500);
  },

  // ── CUSTOM CITY (any searched city) ─────────────────────────────────────────
  async loadCustomCity(cityName) {
    // Switch to dashboard page visually
    document.querySelectorAll(".page").forEach((p)     => p.classList.remove("active"));
    document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
    const pg = el("page-dashboard");
    if (pg) pg.classList.add("active");
    const ni = document.querySelector('[data-page="dashboard"]');
    if (ni) ni.classList.add("active");
    this.page = "dashboard";

    // Reset to loading state
    el("db-num").textContent       = "—";
    el("db-num").style.color       = "var(--text-muted)";
    el("db-pill").textContent      = "Loading…";
    el("db-pill").style.background = "var(--text-muted)";
    el("db-station").textContent   = "Fetching " + cityName + "…";
    el("db-poll").innerHTML        = skel(70) + skel(70) + skel(70) + skel(70);
    el("db-fcbar").innerHTML       = skel(80);
    el("db-best").textContent      = "—";
    el("db-alert").innerHTML       = "";

    const [aqi, cities] = await Promise.all([
      api("/api/search/city?q=" + encodeURIComponent(cityName)),
      api("/api/cities")
    ]);

    if (aqi && !aqi.error) {
      this._renderAqi(aqi);
      if (aqi.pollutants) this._renderPollutants(aqi.pollutants);

      // Show estimated notice if no live station
      if (aqi.source === "estimated") {
        const bar = makeAlertBar(0,
          "Estimated AQI for " + cityName,
          "No monitoring station found. AQI estimated from regional data and state pollution profile. Add a WAQI API key to get live readings for more cities.",
          "db-alert"
        );
        bar.style.cssText = "background:#fffde7;border-left-color:#f9a825;margin-bottom:14px";
        bar.querySelector("span").textContent = "⚠️";
        bar.querySelector("strong").style.color = "#e65100";
        el("db-alert").innerHTML = "";
        el("db-alert").appendChild(bar);
      }

      // Forecast not available for custom cities
      el("db-fcbar").innerHTML = [
        '<div style="padding:12px;color:var(--text-muted);font-size:.85rem;width:100%;line-height:1.6">',
        "📍 Hourly forecast is available for major cities only. ",
        "<span onclick=\"Search.selectCity('Bengaluru','Karnataka')\" style='color:var(--accent);cursor:pointer;text-decoration:underline'>Switch to Bengaluru</span> for full features.",
        "</div>"
      ].join("");
      el("db-best").textContent = "Available for major cities only";
    } else {
      el("db-station").textContent = "City not found — try a different spelling.";
      el("db-pill").textContent    = "Error";
    }

    if (cities) this._renderCities(cities);

    // Weather (best effort from a nearby preset)
    const brief = await api("/api/city/bengaluru/brief");
    if (brief) this._renderWeather(brief);
  }
};

window.addEventListener("DOMContentLoaded", () => App.init());

// ═══════════════════════════════════════════════════════════
// UNIQUE FEATURES — pages and render functions
// ═══════════════════════════════════════════════════════════

// ── Lung Score ───────────────────────────────────────────────────────────────
async function loadLungScore(cityId) {
  const target = el("lung-body");
  if (!target) return;
  target.innerHTML = '<div class="skel" style="height:300px"></div>';

  const data = await api("/api/city/" + cityId + "/lung-score");
  if (!data) { target.innerHTML = "<p>Failed to load lung score.</p>"; return; }

  const scoreColor = data.color || "#00b050";
  const circumference = 2 * Math.PI * 52;
  const dashOffset = circumference * (1 - data.score / 100);

  target.innerHTML = "";

  // Score ring card
  const ringCard = document.createElement("div");
  ringCard.className = "card";
  ringCard.style.marginBottom = "16px";
  ringCard.innerHTML = [
    '<div style="display:flex;align-items:center;gap:24px;flex-wrap:wrap">',
    // SVG ring
    '<div style="flex-shrink:0;text-align:center">',
    '<svg width="140" height="140" viewBox="0 0 140 140">',
    '<circle cx="70" cy="70" r="52" fill="none" stroke="#e8e5e0" stroke-width="12"/>',
    '<circle cx="70" cy="70" r="52" fill="none" stroke="' + scoreColor + '" stroke-width="12" stroke-linecap="round"',
    ' stroke-dasharray="' + circumference.toFixed(1) + '" stroke-dashoffset="' + dashOffset.toFixed(1) + '"',
    ' transform="rotate(-90 70 70)" style="transition:stroke-dashoffset 1.2s ease"/>',
    '<text x="70" y="62" text-anchor="middle" font-size="32" font-weight="900" font-family="Playfair Display,serif" fill="' + scoreColor + '">' + data.score + '</text>',
    '<text x="70" y="80" text-anchor="middle" font-size="11" font-weight="600" fill="#9e9e9e" style="text-transform:uppercase;letter-spacing:.05em">Lung Score</text>',
    '<text x="70" y="96" text-anchor="middle" font-size="13" font-weight="700" fill="' + scoreColor + '">' + data.label + '</text>',
    '</svg>',
    '<div style="font-size:.72rem;color:var(--text-muted)">out of 100</div>',
    '</div>',
    // Info
    '<div style="flex:1;min-width:220px">',
    '<div style="font-family:var(--font-display);font-size:1.4rem;font-weight:700;margin-bottom:8px">Today\'s Lung Score</div>',
    '<div style="font-size:.9rem;margin-bottom:14px;color:var(--text-muted)">' + data.advice + '</div>',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">',
    '<div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">',
    '<div style="font-family:var(--font-display);font-size:1.6rem;font-weight:900;color:var(--good)">' + data.good_hours + '</div>',
    '<div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase">Clean Air Hours</div></div>',
    '<div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center">',
    '<div style="font-family:var(--font-display);font-size:1.6rem;font-weight:900;color:' + aqiColor(data.worst_aqi) + '">' + data.worst_aqi + '</div>',
    '<div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase">Peak AQI (' + (data.worst_hour || "—") + ')</div></div>',
    '</div></div></div>'
  ].join("");
  target.appendChild(ringCard);

  // Weekly trend
  if (data.weekly_trend && data.weekly_trend.length) {
    const trendCard = document.createElement("div");
    trendCard.className = "card";
    trendCard.style.marginBottom = "16px";
    trendCard.innerHTML = '<div class="card-title">📅 7-Day Lung Score Trend</div><div id="lung-trend-bars" style="display:flex;align-items:flex-end;gap:8px;height:80px;padding:0 4px"></div>';
    target.appendChild(trendCard);

    const barsDiv = el("lung-trend-bars");
    const maxScore = Math.max(...data.weekly_trend.map(d => d.score));
    data.weekly_trend.forEach((d) => {
      const bar = document.createElement("div");
      bar.style.cssText = "flex:1;display:flex;flex-direction:column;align-items:center;gap:4px";
      const height = Math.round((d.score / maxScore) * 60);
      bar.innerHTML = [
        '<div style="width:100%;height:' + height + 'px;background:' + d.color + ';border-radius:4px 4px 0 0;transition:height .5s ease" title="' + d.date + ': ' + d.score + '"></div>',
        '<div style="font-size:.65rem;color:var(--text-muted);font-weight:600">' + d.date + '</div>',
        '<div style="font-size:.62rem;color:' + d.color + ';font-weight:700">' + d.score + '</div>'
      ].join("");
      barsDiv.appendChild(bar);
    });
  }

  // Hourly breakdown
  if (data.history && data.history.length) {
    const histCard = document.createElement("div");
    histCard.className = "card";
    histCard.innerHTML = '<div class="card-title">⏰ Hourly Exposure Today</div><div class="fc-bar" id="lung-hourly"></div>';
    target.appendChild(histCard);

    const hourBar = el("lung-hourly");
    data.history.forEach((h) => {
      const col = h.color || aqiColor(h.aqi);
      const div = document.createElement("div");
      div.className = "fc-hr";
      div.innerHTML = [
        '<div class="fc-label">' + h.hour_label + '</div>',
        '<div class="fc-aqi" style="color:' + col + '">' + h.aqi + '</div>',
        '<div class="fc-strip" style="background:' + col + '"></div>',
        '<div style="font-size:.6rem;color:var(--text-light)">' + (h.category || "").slice(0, 3) + '</div>'
      ].join("");
      hourBar.appendChild(div);
    });
  }
}

// ── AQI Time Machine ──────────────────────────────────────────────────────────
async function loadTimeMachine(cityId) {
  const target = el("tm-body");
  if (!target) return;
  target.innerHTML = '<div class="skel" style="height:200px"></div>';

  const data = await api("/api/city/" + cityId + "/time-machine");
  if (!data) { target.innerHTML = "<p>Failed to load.</p>"; return; }

  target.innerHTML = "";

  // Comparison card
  const compCard = document.createElement("div");
  compCard.className = "card";
  compCard.style.marginBottom = "16px";
  const changeColor = data.change_vs_lastyear > 10 ? "var(--poor)" : data.change_vs_lastyear < -10 ? "var(--good)" : "var(--moderate)";
  compCard.innerHTML = [
    '<div class="card-title">🕰️ AQI Time Machine — ' + data.date + '</div>',
    '<div style="display:grid;grid-template-columns:1fr auto 1fr;gap:16px;align-items:center;margin-bottom:16px">',
    // Today
    '<div style="text-align:center;padding:16px;background:' + aqiBg(data.today_aqi) + ';border-radius:10px">',
    '<div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Today</div>',
    '<div style="font-family:var(--font-display);font-size:3rem;font-weight:900;color:' + aqiColor(data.today_aqi) + ';line-height:1">' + data.today_aqi + '</div>',
    '<div style="font-size:.78rem;color:' + aqiColor(data.today_aqi) + ';font-weight:600;margin-top:4px">' + data.today_category + '</div></div>',
    // Arrow
    '<div style="text-align:center">',
    '<div style="font-size:1.5rem">' + data.trend_emoji + '</div>',
    '<div style="font-size:.72rem;color:' + changeColor + ';font-weight:700;margin-top:4px">' + (data.change_vs_lastyear > 0 ? "+" : "") + data.change_vs_lastyear + '</div>',
    '<div style="font-size:.65rem;color:var(--text-muted)">vs last year</div></div>',
    // Last year
    '<div style="text-align:center;padding:16px;background:' + aqiBg(data.lastyear_aqi) + ';border-radius:10px">',
    '<div style="font-size:.7rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:6px">Last Year</div>',
    '<div style="font-family:var(--font-display);font-size:3rem;font-weight:900;color:' + aqiColor(data.lastyear_aqi) + ';line-height:1">' + data.lastyear_aqi + '</div>',
    '<div style="font-size:.78rem;color:' + aqiColor(data.lastyear_aqi) + ';font-weight:600;margin-top:4px">' + data.lastyear_category + '</div></div>',
    '</div>',
    // Verdict
    '<div style="padding:12px;background:var(--bg);border-radius:8px;font-size:.88rem;font-weight:600;color:' + changeColor + '">' + data.comparison_label + '</div>',
    data.context ? '<div style="margin-top:10px;padding:10px;background:#fffde7;border-left:3px solid #f9a825;border-radius:6px;font-size:.83rem">' + data.context + '</div>' : ''
  ].join("");
  target.appendChild(compCard);

  // Year heatmap
  if (data.historical_months) {
    const hmCard = document.createElement("div");
    hmCard.className = "card";
    hmCard.innerHTML = '<div class="card-title">📆 Typical AQI by Month</div><div style="display:grid;grid-template-columns:repeat(6,1fr);gap:6px" id="month-heatmap"></div>';
    target.appendChild(hmCard);

    const mhGrid = el("month-heatmap");
    data.historical_months.forEach((m) => {
      const cell = document.createElement("div");
      cell.style.cssText = "background:" + aqiBg(m.aqi) + ";border-radius:8px;padding:10px;text-align:center;border:1px solid " + aqiColor(m.aqi) + "40";
      cell.innerHTML = '<div style="font-size:.72rem;font-weight:700;color:var(--text-muted)">' + m.month + '</div><div style="font-family:var(--font-display);font-size:1.2rem;font-weight:900;color:' + aqiColor(m.aqi) + '">' + m.aqi + '</div>';
      mhGrid.appendChild(cell);
    });
  }
}

// ── Pollution Fingerprint ─────────────────────────────────────────────────────
async function loadFingerprint(cityId, cityName) {
  const target = el("fp-body");
  if (!target) return;
  target.innerHTML = '<div class="skel" style="height:300px"></div>';

  const data = await api("/api/city/" + cityId + "/fingerprint");
  if (!data) { target.innerHTML = "<p>Failed to load.</p>"; return; }

  target.innerHTML = "";

  const mainCard = document.createElement("div");
  mainCard.className = "card";
  mainCard.style.marginBottom = "16px";

  const totalAngle = 360;
  let currentAngle = -90;
  const cx = 80, cy = 80, r = 65, ri = 35;

  const slices = (data.sources || []).map((s) => {
    const angle = (s.pct / 100) * totalAngle;
    const start = currentAngle;
    const end   = currentAngle + angle;
    currentAngle = end;

    const startRad = (start * Math.PI) / 180;
    const endRad   = (end * Math.PI) / 180;
    const x1 = cx + r * Math.cos(startRad);
    const y1 = cy + r * Math.sin(startRad);
    const x2 = cx + r * Math.cos(endRad);
    const y2 = cy + r * Math.sin(endRad);
    const xi1 = cx + ri * Math.cos(startRad);
    const yi1 = cy + ri * Math.sin(startRad);
    const xi2 = cx + ri * Math.cos(endRad);
    const yi2 = cy + ri * Math.sin(endRad);
    const large = angle > 180 ? 1 : 0;

    return { ...s, path: "M " + xi1 + " " + yi1 + " L " + x1 + " " + y1 + " A " + r + " " + r + " 0 " + large + " 1 " + x2 + " " + y2 + " L " + xi2 + " " + yi2 + " A " + ri + " " + ri + " 0 " + large + " 0 " + xi1 + " " + yi1 + " Z" };
  });

  mainCard.innerHTML = [
    '<div class="card-title">🔬 Pollution Fingerprint — ' + cityName + '</div>',
    '<div style="font-size:.85rem;color:var(--text-muted);margin-bottom:16px">' + data.signature + '</div>',
    '<div style="display:flex;gap:20px;flex-wrap:wrap;margin-bottom:16px">',
    // Donut chart
    '<svg width="160" height="160" viewBox="0 0 160 160" style="flex-shrink:0">',
    slices.map(s => '<path d="' + s.path + '" fill="' + s.color + '" opacity=".9"><title>' + s.name + ' ' + s.pct + '%</title></path>').join(""),
    '<text x="80" y="76" text-anchor="middle" font-size="13" font-weight="700" fill="var(--text)">' + data.dominant + '</text>',
    '<text x="80" y="92" text-anchor="middle" font-size="11" fill="var(--text-muted)">dominant</text>',
    '</svg>',
    // Legend
    '<div style="flex:1;min-width:180px;display:flex;flex-direction:column;gap:8px;justify-content:center">',
    (data.sources || []).map(s => [
      '<div style="display:flex;align-items:center;gap:8px">',
      '<div style="width:12px;height:12px;border-radius:3px;background:' + s.color + ';flex-shrink:0"></div>',
      '<div style="flex:1">',
      '<div style="font-size:.82rem;font-weight:600">' + s.icon + ' ' + s.name + '</div>',
      '<div style="height:5px;background:var(--border);border-radius:2px;margin-top:3px;overflow:hidden">',
      '<div style="height:100%;width:' + s.pct + '%;background:' + s.color + ';border-radius:2px"></div></div>',
      '</div>',
      '<div style="font-size:.8rem;font-weight:700;color:' + s.color + '">' + s.pct + '%</div>',
      '</div>'
    ].join("")).join(""),
    '</div></div>',
    '<div style="padding:12px;background:#fff8e1;border-left:3px solid #f9a825;border-radius:6px;font-size:.83rem;margin-bottom:10px">' + data.insight + '</div>',
    '<div style="padding:10px;background:#ffebee;border-left:3px solid var(--very-poor);border-radius:6px;font-size:.8rem">⚠️ <strong>Unique Risk:</strong> ' + data.unique_risk + '</div>',
    '<div style="display:flex;gap:12px;flex-wrap:wrap;margin-top:12px">',
    '<div style="padding:8px 14px;background:var(--bg);border-radius:8px;font-size:.78rem"><span style="color:var(--text-muted)">Peak months: </span><strong>' + (data.peak_months || []).join(", ") + '</strong></div>',
    '<div style="padding:8px 14px;background:var(--bg);border-radius:8px;font-size:.78rem"><span style="color:var(--text-muted)">Worst hours: </span><strong>' + (data.peak_hours || []).join(", ") + '</strong></div>',
    '</div>'
  ].join("");
  target.appendChild(mainCard);
}

// ── Body Battery ──────────────────────────────────────────────────────────────
async function loadBodyBattery(cityId) {
  const target = el("bb-body");
  if (!target) return;
  target.innerHTML = '<div class="skel" style="height:200px"></div>';

  const data = await api("/api/city/" + cityId + "/body-battery");
  if (!data) { target.innerHTML = "<p>Failed to load.</p>"; return; }

  target.innerHTML = "";

  const card = document.createElement("div");
  card.className = "card";
  card.style.marginBottom = "16px";

  const scoreColor = data.color || "#00b050";
  const bgFill = aqiBg(data.score > 70 ? 50 : data.score > 40 ? 150 : 300);

  card.innerHTML = [
    '<div class="card-title">⚡ Body Battery Index</div>',
    '<div style="display:flex;align-items:center;gap:20px;flex-wrap:wrap;margin-bottom:16px">',
    '<div style="text-align:center;padding:20px;background:' + bgFill + ';border-radius:12px;flex-shrink:0">',
    '<div style="font-size:2.5rem">' + data.emoji + '</div>',
    '<div style="font-family:var(--font-display);font-size:3.5rem;font-weight:900;color:' + scoreColor + ';line-height:1">' + data.score + '</div>',
    '<div style="font-size:.8rem;font-weight:700;color:' + scoreColor + '">' + data.label + '</div>',
    '<div style="font-size:.7rem;color:var(--text-muted);margin-top:4px">/ 100</div>',
    '</div>',
    '<div style="flex:1;min-width:200px">',
    '<div style="font-size:.9rem;margin-bottom:14px">' + data.advice + '</div>',
    '<div style="font-size:.8rem;color:var(--text-muted);margin-bottom:6px">What\'s contributing:</div>',
    '<div style="display:flex;flex-direction:column;gap:6px">',
    _penaltyBar("🌫️ AQI load", data.aqi_penalty, 50, "#cc0000"),
    _penaltyBar("🌡️ Heat index (" + data.heat_index + "°C)", data.heat_penalty, 30, "#e05a00"),
    _penaltyBar("💧 Humidity", data.hum_penalty, 20, "#1565c0"),
    '</div></div></div>',
    // Activity costs
    '<div class="card-title" style="margin-bottom:10px">Activity Effort Cost Today</div>',
    '<div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">',
    Object.entries(data.activity_costs || {}).map(([act, cost]) =>
      '<div style="padding:10px;background:var(--bg);border-radius:8px"><div style="font-size:.78rem;font-weight:600">' + act + '</div><div style="font-size:.75rem;color:' + scoreColor + ';margin-top:3px">' + cost + '</div></div>'
    ).join(""),
    '</div>',
    data.multiplier > 1 ?
      '<div style="margin-top:12px;padding:10px;background:#fff8e1;border-radius:8px;font-size:.82rem">⚡ Outdoor exercise today is <strong>' + data.multiplier + '×</strong> more demanding on your body than on a perfect day.</div>'
      : '<div style="margin-top:12px;padding:10px;background:#e8f8ee;border-radius:8px;font-size:.82rem">✅ Great conditions! Today\'s outdoor effort cost is at baseline — go for it.</div>'
  ].join("");
  target.appendChild(card);
}

function _penaltyBar(label, penalty, maxPenalty, color) {
  const pct = Math.round((penalty / maxPenalty) * 100);
  return [
    '<div style="display:flex;align-items:center;gap:8px">',
    '<div style="font-size:.75rem;width:170px;color:var(--text-muted)">' + label + '</div>',
    '<div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden">',
    '<div style="height:100%;width:' + pct + '%;background:' + color + ';border-radius:3px;transition:width .6s"></div></div>',
    '<div style="font-size:.72rem;font-weight:600;color:' + color + ';min-width:22px;text-align:right">-' + penalty + '</div>',
    '</div>'
  ].join("");
}

// ═══════════════════════════════════════════════════════════
// HEALTH PROFILE — personalised AQI intelligence
// ═══════════════════════════════════════════════════════════

const HealthProfile = {
  _meta: null,          // all conditions, categories, age groups
  _selectedConditions: new Set(),
  _selectedAgeGroup: "adult",
  _searchTimer: null,

  // ── Load the full health profile page ──────────────────────────────────────
  async load(cityId) {
    const target = el("health-body");
    if (!target) return;
    target.innerHTML = '<div class="skel" style="height:300px"></div>';

    // Load meta + profile + personal report in parallel
    const [meta, profile, report] = await Promise.all([
      api("/api/health/conditions/meta"),
      api("/api/health/profile/" + App.session),
      api("/api/health/report/" + App.session + "/" + cityId),
    ]);

    this._meta = meta;

    // Restore saved selections
    if (profile && profile.conditions) {
      this._selectedConditions = new Set(profile.conditions);
      this._selectedAgeGroup   = profile.age_group || "adult";
    }

    target.innerHTML = "";
    this._renderPage(target, report, cityId);
  },

  // ── Main page renderer ──────────────────────────────────────────────────────
  _renderPage(container, report, cityId) {
    // ─ Top: personal verdict card ─
    const verdictCard = document.createElement("div");
    verdictCard.className = "card";
    verdictCard.style.marginBottom = "16px";
    verdictCard.id = "health-verdict-card";

    if (!report || !report.has_profile) {
      verdictCard.innerHTML = [
        '<div style="text-align:center;padding:20px 0">',
        '<div style="font-size:3rem;margin-bottom:12px">🏥</div>',
        '<div style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;margin-bottom:8px">Set Up Your Health Profile</div>',
        '<div style="font-size:.9rem;color:var(--text-muted);max-width:400px;margin:0 auto">',
        'Tell us about your health conditions and age group. We\'ll give you personalised AQI advice — not generic numbers.</div>',
        '</div>'
      ].join("");
    } else {
      this._renderVerdictCard(verdictCard, report);
    }
    container.appendChild(verdictCard);

    // ─ Two columns: setup on left, report on right ─
    const grid = document.createElement("div");
    grid.className = "g2";
    grid.style.gap = "16px";
    container.appendChild(grid);

    // LEFT: Profile setup
    const setupCard = document.createElement("div");
    setupCard.className = "card";
    setupCard.style.alignSelf = "start";
    grid.appendChild(setupCard);
    this._renderSetupCard(setupCard, cityId);

    // RIGHT: Condition reports
    const reportCard = document.createElement("div");
    reportCard.id = "health-report-col";
    grid.appendChild(reportCard);
    if (report && report.has_profile) {
      this._renderConditionReports(reportCard, report);
    } else {
      reportCard.innerHTML = '<div class="card" style="text-align:center;padding:30px;color:var(--text-muted)"><div style="font-size:2rem;margin-bottom:10px">👈</div><div>Select your conditions and age group, then tap Save Profile.</div></div>';
    }
  },

  // ── Verdict card (top) ──────────────────────────────────────────────────────
  _renderVerdictCard(card, report) {
    const rcolor = report.overall_risk_color || "#00b050";
    const rbg    = report.overall_risk === "good" ? "#e8f8ee"
                 : report.overall_risk === "moderate" ? "#fff9e0"
                 : report.overall_risk === "poor" ? "#fff0e6" : "#ffe6e6";

    card.style.background = "linear-gradient(135deg," + rbg + ",#fff 65%)";
    card.style.borderColor = rcolor + "40";

    const condNames = (report.conditions || [])
      .map(id => {
        const c = (this._meta && this._meta.conditions || []).find(x => x.id === id);
        return c ? c.icon + " " + c.name : id;
      }).join("  ·  ");

    card.innerHTML = [
      '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">',
      '<div style="flex:1;min-width:200px">',
      '<div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Personal AQI Assessment</div>',
      '<div style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;line-height:1.35;margin-bottom:8px">' + (report.verdict || "") + '</div>',
      '<div style="font-size:.82rem;color:var(--text-muted);margin-bottom:10px">' + condNames + '</div>',
      '<div style="display:flex;gap:8px;flex-wrap:wrap">',
      '<span style="background:' + rcolor + ';color:#fff;padding:3px 10px;border-radius:4px;font-size:.75rem;font-weight:700">' + (report.overall_risk_label || "") + '</span>',
      '<span style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);padding:3px 10px;border-radius:4px;font-size:.75rem">Your safe limit: AQI ' + (report.personal_threshold || "—") + '</span>',
      '</div></div>',
      '<div style="text-align:center;flex-shrink:0">',
      '<div style="font-family:var(--font-display);font-size:4rem;font-weight:900;color:' + rcolor + ';line-height:1">' + report.aqi + '</div>',
      '<div style="font-size:.72rem;color:var(--text-muted)">Current AQI</div>',
      report.threshold_exceeded
        ? '<div style="font-size:.72rem;color:' + rcolor + ';font-weight:700;margin-top:4px">⚠️ Above your safe limit</div>'
        : '<div style="font-size:.72rem;color:var(--good);font-weight:700;margin-top:4px">✅ Within your safe limit</div>',
      '</div></div>',
      // Age modifier note
      report.age_modifier
        ? '<div style="margin-top:12px;padding:8px 12px;background:rgba(0,0,0,.04);border-radius:8px;font-size:.78rem;color:var(--text-muted)">' +
          '<strong>' + (report.age_group ? report.age_group.charAt(0).toUpperCase() + report.age_group.slice(1) : "") + ' group:</strong> ' + (report.age_modifier.note || "") + '</div>'
        : ""
    ].join("");
  },

  // ── Setup card (left column) ────────────────────────────────────────────────
  _renderSetupCard(card, cityId) {
    card.innerHTML = "";

    // Title
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = "🏥 Your Health Profile";
    card.appendChild(title);

    // Age group selector
    const ageLabel = document.createElement("div");
    ageLabel.style.cssText = "font-size:.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px";
    ageLabel.textContent = "Age Group";
    card.appendChild(ageLabel);

    const ageGrid = document.createElement("div");
    ageGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px";
    (this._meta && this._meta.age_groups || [
      {id:"infant",label:"Infant (0-2)",icon:"👶"},
      {id:"child",label:"Child (3-12)",icon:"🧒"},
      {id:"teen",label:"Teen (13-17)",icon:"🧑"},
      {id:"adult",label:"Adult (18-59)",icon:"🧑‍💼"},
      {id:"senior",label:"Senior (60+)",icon:"👴"},
    ]).forEach(ag => {
      const btn = document.createElement("button");
      const active = ag.id === this._selectedAgeGroup;
      btn.style.cssText = "padding:5px 11px;border-radius:16px;border:1px solid " +
        (active ? "var(--accent)" : "var(--border)") + ";background:" +
        (active ? "var(--accent)" : "var(--bg-card)") + ";color:" +
        (active ? "#fff" : "var(--text-muted)") + ";cursor:pointer;font-size:.78rem;transition:all .15s";
      btn.textContent = ag.icon + " " + ag.label;
      btn.addEventListener("click", () => {
        this._selectedAgeGroup = ag.id;
        this._renderSetupCard(card, cityId); // re-render setup card
      });
      ageGrid.appendChild(btn);
    });
    card.appendChild(ageGrid);

    // Condition search
    const searchLabel = document.createElement("div");
    searchLabel.style.cssText = "font-size:.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px";
    searchLabel.textContent = "Health Conditions";
    card.appendChild(searchLabel);

    const searchWrap = document.createElement("div");
    searchWrap.style.cssText = "position:relative;margin-bottom:10px";
    const searchInput = document.createElement("input");
    searchInput.id = "health-search-input";
    searchInput.type = "text";
    searchInput.placeholder = "Search: asthma, diabetes, elderly, runner…";
    searchInput.autocomplete = "off";
    searchInput.style.cssText = "width:100%;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-family:var(--font-body);font-size:.875rem;outline:none;transition:border-color .15s";
    searchInput.addEventListener("focus", function(){ this.style.borderColor = "var(--accent)"; });
    searchInput.addEventListener("blur",  function(){ setTimeout(() => this.style.borderColor = "var(--border)", 150); });
    searchInput.addEventListener("input", (e) => this._onSearchInput(e.target.value, card, cityId));
    searchWrap.appendChild(searchInput);

    // Search results dropdown
    const dropdown = document.createElement("div");
    dropdown.id = "health-search-results";
    dropdown.style.cssText = "display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-md);z-index:200;overflow:hidden;max-height:240px;overflow-y:auto";
    searchWrap.appendChild(dropdown);
    card.appendChild(searchWrap);

    // Selected conditions chips
    const chipsWrap = document.createElement("div");
    chipsWrap.id = "health-chips";
    chipsWrap.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;min-height:28px";
    card.appendChild(chipsWrap);
    this._renderChips(chipsWrap);

    // Browse by category
    const browseLabel = document.createElement("div");
    browseLabel.style.cssText = "font-size:.72rem;color:var(--text-muted);margin-bottom:8px";
    browseLabel.textContent = "Or browse by category:";
    card.appendChild(browseLabel);

    const catGrid = document.createElement("div");
    catGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:16px";
    const cats = (this._meta && this._meta.categories) || [];
    cats.forEach(cat => {
      const btn = document.createElement("button");
      btn.style.cssText = "padding:4px 10px;border-radius:14px;border:1px solid var(--border);background:var(--bg);font-size:.72rem;cursor:pointer;transition:all .15s;color:var(--text-muted)";
      btn.textContent = cat.icon + " " + cat.label;
      btn.addEventListener("click", () => this._browseCategory(cat.label, dropdown));
      catGrid.appendChild(btn);
    });
    card.appendChild(catGrid);

    // Save button
    const saveBtn = document.createElement("button");
    saveBtn.id = "health-save-btn";
    saveBtn.style.cssText = "width:100%;padding:11px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:700;cursor:pointer;transition:background .15s";
    saveBtn.textContent = "💾 Save Profile & Get My Report";
    saveBtn.addEventListener("click", () => this._saveAndReload(cityId));
    card.appendChild(saveBtn);

    // Note
    const note = document.createElement("div");
    note.style.cssText = "margin-top:10px;font-size:.72rem;color:var(--text-muted);text-align:center";
    note.textContent = "Saved in your browser. No account needed.";
    card.appendChild(note);
  },

  // ── Condition search input ──────────────────────────────────────────────────
  _onSearchInput(val, card, cityId) {
    clearTimeout(this._searchTimer);
    const dropdown = el("health-search-results");
    if (!dropdown) return;
    if (val.length < 2) { dropdown.style.display = "none"; return; }
    this._searchTimer = setTimeout(async () => {
      const results = await api("/api/health/conditions/search?q=" + encodeURIComponent(val));
      this._renderSearchDropdown(dropdown, results || [], card, cityId);
    }, 200);
  },

  _renderSearchDropdown(dropdown, results, card, cityId) {
    dropdown.innerHTML = "";
    if (!results.length) {
      dropdown.innerHTML = '<div style="padding:12px;font-size:.85rem;color:var(--text-muted);text-align:center">No conditions found. Try: asthma, diabetes, elderly…</div>';
      dropdown.style.display = "block";
      return;
    }
    results.forEach(r => {
      const item = document.createElement("div");
      item.style.cssText = "padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;transition:background .1s";
      item.innerHTML = '<span style="font-size:1.2rem">' + r.icon + '</span><div><div style="font-size:.875rem;font-weight:600">' + r.name + '</div><div style="font-size:.72rem;color:var(--text-muted)">' + r.category + '</div></div>' +
        (this._selectedConditions.has(r.id) ? '<span style="margin-left:auto;color:var(--good);font-size:.8rem">✓ Added</span>' : "");
      item.addEventListener("mouseover", function(){ this.style.background = "var(--accent-light)"; });
      item.addEventListener("mouseout",  function(){ this.style.background = ""; });
      item.addEventListener("click", () => {
        this._toggleCondition(r.id);
        dropdown.style.display = "none";
        const inp = el("health-search-input");
        if (inp) inp.value = "";
        this._renderChips(el("health-chips"));
      });
      dropdown.appendChild(item);
    });
    dropdown.style.display = "block";
  },

  _browseCategory(categoryLabel, dropdown) {
    const all = (this._meta && this._meta.conditions) || [];
    const filtered = all.filter(c => c.category === categoryLabel);
    this._renderSearchDropdown(dropdown, filtered, null, null);
  },

  _toggleCondition(condId) {
    if (this._selectedConditions.has(condId)) {
      this._selectedConditions.delete(condId);
    } else {
      this._selectedConditions.add(condId);
    }
  },

  _renderChips(container) {
    if (!container) return;
    container.innerHTML = "";
    if (this._selectedConditions.size === 0) {
      container.innerHTML = '<span style="font-size:.78rem;color:var(--text-muted)">No conditions selected yet.</span>';
      return;
    }
    const allConds = (this._meta && this._meta.conditions) || [];
    this._selectedConditions.forEach(id => {
      const cond = allConds.find(c => c.id === id) || { name: id, icon: "🏥", color: "#9e9e9e" };
      const chip = document.createElement("div");
      chip.style.cssText = "display:inline-flex;align-items:center;gap:5px;padding:4px 10px;border-radius:16px;border:1px solid " + cond.color + "60;background:" + cond.color + "18;font-size:.78rem;font-weight:600;color:var(--text)";
      chip.innerHTML = '<span>' + cond.icon + " " + cond.name + '</span><button onclick="" style="background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:.9rem;padding:0 0 0 3px;line-height:1">✕</button>';
      chip.querySelector("button").addEventListener("click", () => {
        this._toggleCondition(id);
        this._renderChips(el("health-chips"));
      });
      container.appendChild(chip);
    });
  },

  // ── Save profile ──────────────────────────────────────────────────────────────
  async _saveAndReload(cityId) {
    const btn = el("health-save-btn");
    if (btn) { btn.textContent = "Saving…"; btn.disabled = true; }

    await fetch("/api/health/profile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        session_id: App.session,
        age_group:  this._selectedAgeGroup,
        conditions: Array.from(this._selectedConditions),
      })
    });

    if (btn) { btn.textContent = "✅ Saved!"; btn.style.background = "var(--good)"; }
    setTimeout(() => this.load(cityId), 800);
  },

  // ── Condition reports (right column) ─────────────────────────────────────────
  _renderConditionReports(container, report) {
    container.innerHTML = "";

    if (!report.condition_reports || !report.condition_reports.length) {
      container.innerHTML = '<div class="card" style="text-align:center;padding:30px;color:var(--text-muted)">Add health conditions in the panel on the left.</div>';
      return;
    }

    report.condition_reports.forEach(cr => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.cssText = "margin-bottom:14px;border-left:4px solid " + cr.risk_color;

      // Header
      const header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:12px";
      header.innerHTML = [
        '<span style="font-size:1.6rem">' + cr.icon + '</span>',
        '<div style="flex:1">',
        '<div style="font-weight:700;font-size:.95rem">' + cr.name + '</div>',
        '<div style="font-size:.72rem;color:var(--text-muted)">' + cr.category + '</div>',
        '</div>',
        '<span style="padding:4px 10px;border-radius:6px;background:' + cr.risk_color + ';color:#fff;font-size:.72rem;font-weight:700">' + cr.risk_label + '</span>',
      ].join("");
      card.appendChild(header);

      // How AQI affects this condition
      const howBox = document.createElement("div");
      howBox.style.cssText = "padding:9px 12px;background:var(--bg);border-radius:8px;font-size:.82rem;color:var(--text-muted);margin-bottom:12px;line-height:1.5";
      howBox.innerHTML = '<strong>How today\'s air affects you:</strong> ' + cr.how_aqi_affects;
      card.appendChild(howBox);

      // Threshold bar
      const thrWrap = document.createElement("div");
      thrWrap.style.marginBottom = "12px";
      const pct = Math.min(100, Math.round((this._getAqi(report) / 500) * 100));
      const safePct = Math.round((cr.safe_aqi / 500) * 100);
      thrWrap.innerHTML = [
        '<div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-bottom:4px">',
        '<span>AQI 0</span>',
        '<span style="color:' + cr.risk_color + '">Your safe limit: ' + cr.safe_aqi + '</span>',
        '<span>500</span></div>',
        '<div style="position:relative;height:8px;background:linear-gradient(to right,#00b050 0%,#7ab648 10%,#e8a000 40%,#e05a00 60%,#cc0000 80%,#660000 100%);border-radius:4px">',
        '<div style="position:absolute;top:-3px;left:' + pct + '%;transform:translateX(-50%);width:14px;height:14px;background:#fff;border:2px solid var(--text-dark);border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.2)" title="Current AQI: ' + this._getAqi(report) + '"></div>',
        '<div style="position:absolute;top:10px;left:' + safePct + '%;transform:translateX(-50%);font-size:.6rem;color:' + cr.risk_color + ';white-space:nowrap;font-weight:700">Safe limit</div>',
        '</div>',
      ].join("");
      card.appendChild(thrWrap);

      // Precautions
      if (cr.precautions && cr.precautions.length) {
        const precDiv = document.createElement("div");
        precDiv.style.marginBottom = "10px";
        precDiv.innerHTML = '<div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:.04em;margin-bottom:6px">Today\'s Precautions</div>';
        cr.precautions.forEach(p => {
          const row = document.createElement("div");
          row.style.cssText = "font-size:.83rem;padding:6px 0;border-bottom:1px solid var(--border);line-height:1.4";
          row.textContent = p;
          precDiv.appendChild(row);
        });
        card.appendChild(precDiv);
      }

      // Medication reminders
      if (cr.medications && cr.medications.length) {
        const medDiv = document.createElement("div");
        medDiv.style.cssText = "padding:10px;background:#e8f5e9;border-radius:8px;margin-bottom:10px";
        medDiv.innerHTML = '<div style="font-size:.72rem;font-weight:700;color:#2e7d32;margin-bottom:5px">💊 Medication Reminders</div>';
        cr.medications.forEach(m => {
          const row = document.createElement("div");
          row.style.cssText = "font-size:.8rem;color:#1b5e20;padding:2px 0";
          row.textContent = "• " + m;
          medDiv.appendChild(row);
        });
        card.appendChild(medDiv);
      }

      // Things to avoid
      if (cr.avoid && cr.avoid.length) {
        const avoidDiv = document.createElement("div");
        avoidDiv.style.cssText = "padding:10px;background:#fff3e0;border-radius:8px;margin-bottom:10px";
        avoidDiv.innerHTML = '<div style="font-size:.72rem;font-weight:700;color:#e65100;margin-bottom:5px">🚫 Avoid Today</div>';
        cr.avoid.forEach(a => {
          const row = document.createElement("div");
          row.style.cssText = "font-size:.8rem;color:#bf360c;padding:2px 0";
          row.textContent = "• " + a;
          avoidDiv.appendChild(row);
        });
        card.appendChild(avoidDiv);
      }

      // Indoor tips
      if (cr.indoor_tips && cr.indoor_tips.length) {
        const tipDiv = document.createElement("div");
        tipDiv.style.cssText = "padding:10px;background:#e3f2fd;border-radius:8px;margin-bottom:10px";
        tipDiv.innerHTML = '<div style="font-size:.72rem;font-weight:700;color:#1565c0;margin-bottom:5px">🏠 Indoor Tips</div>';
        cr.indoor_tips.forEach(t => {
          const row = document.createElement("div");
          row.style.cssText = "font-size:.8rem;color:#0d47a1;padding:2px 0";
          row.textContent = "• " + t;
          tipDiv.appendChild(row);
        });
        card.appendChild(tipDiv);
      }

      // Emergency signs
      if (cr.emergency_signs && cr.emergency_signs.length) {
        const emDiv = document.createElement("div");
        emDiv.style.cssText = "padding:10px;background:#ffebee;border-radius:8px;border-left:3px solid #c62828";
        emDiv.innerHTML = '<div style="font-size:.72rem;font-weight:700;color:#c62828;margin-bottom:5px">🚨 Seek Medical Help If</div>';
        cr.emergency_signs.forEach(s => {
          const row = document.createElement("div");
          row.style.cssText = "font-size:.8rem;color:#b71c1c;padding:2px 0";
          row.textContent = "• " + s;
          emDiv.appendChild(row);
        });
        card.appendChild(emDiv);
      }

      container.appendChild(card);
    });

    // Disclaimer
    const disc = document.createElement("div");
    disc.style.cssText = "font-size:.72rem;color:var(--text-muted);text-align:center;padding:10px;border-top:1px solid var(--border);margin-top:6px";
    disc.textContent = "ℹ️ This is general health information, not medical advice. Always follow your doctor's guidance.";
    container.appendChild(disc);
  },

  _getAqi(report) {
    return report && report.aqi ? report.aqi : 100;
  },
};

// Close health search dropdown on outside click
document.addEventListener("click", (e) => {
  const d = el("health-search-results");
  const inp = el("health-search-input");
  if (d && inp && !inp.contains(e.target) && !d.contains(e.target)) {
    d.style.display = "none";
  }
});