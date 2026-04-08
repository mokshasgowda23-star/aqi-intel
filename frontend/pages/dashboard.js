// frontend/pages/dashboard.js
// Main dashboard: AQI, weather, pollutants, mini forecast, cities overview

App.registerLoader('dashboard', loadDashboard);

async function loadDashboard(cityId) {
  // Parallel fetch
  const [aqiData, forecastData, weatherData, citiesData] = await Promise.all([
    apiFetch(`/api/city/${cityId}`),
    apiFetch(`/api/city/${cityId}/forecast`),
    apiFetch(`/api/city/${cityId}/brief`),
    apiFetch('/api/cities'),
  ]);

  if (aqiData) renderMainAqi(aqiData);
  if (weatherData) renderWeather(weatherData);
  if (aqiData) renderPollutants(aqiData.pollutants);
  if (forecastData) renderMiniForecast(forecastData);
  if (citiesData) renderCitiesGrid(citiesData, cityId);
  renderAlertBanner(aqiData);
}

function renderMainAqi(data) {
  const aqi = data.aqi;
  const color = data.color || aqiColor(aqi);
  const bg = aqiBg(aqi);

  document.getElementById('dashAqi').textContent = aqi;
  document.getElementById('dashAqi').style.color = color;
  document.getElementById('dashEmoji').textContent = data.emoji || aqiEmoji(aqi);

  const catEl = document.getElementById('dashCategory');
  catEl.textContent = data.category;
  catEl.style.background = color;

  document.getElementById('dashStation').textContent = '📍 ' + (data.station || data.city_name);
  document.getElementById('dashSource').textContent = data.source === 'live' ? '🟢 live' : '🔵 demo';

  const card = document.getElementById('mainAqiCard');
  card.style.background = `linear-gradient(135deg, ${bg} 0%, #fff 60%)`;
  card.style.borderColor = color + '40';
}

function renderWeather(brief) {
  document.getElementById('weatherEmoji').textContent = brief.weather_emoji || '🌤️';
  document.getElementById('weatherTemp').textContent = `${brief.temp_c}°C`;
  document.getElementById('weatherCondition').textContent = brief.condition || '—';
  document.getElementById('weatherHumidity').textContent = '—';
  document.getElementById('weatherWind').textContent = '—';
  document.getElementById('weatherFeels').textContent = '—';
  document.getElementById('weatherUV').textContent = '—';

  // Brief also carries weather through daily brief endpoint
}

function renderPollutants(pollutants) {
  if (!pollutants) return;

  const labels = {
    pm25: 'PM2.5', pm10: 'PM10', no2: 'NO₂', so2: 'SO₂', o3: 'O₃', co: 'CO'
  };
  const units = {
    pm25: 'µg/m³', pm10: 'µg/m³', no2: 'µg/m³', so2: 'µg/m³', o3: 'µg/m³', co: 'mg/m³'
  };
  const safe = { pm25: 30, pm10: 50, no2: 40, so2: 40, o3: 50, co: 1 };

  const grid = document.getElementById('pollutantGrid');
  grid.innerHTML = Object.entries(pollutants)
    .filter(([, v]) => v !== null && v !== undefined)
    .map(([key, val]) => {
      const pct = Math.min(100, Math.round((val / (safe[key] * 5)) * 100));
      const over = val > safe[key];
      const color = over ? aqiColor(201) : aqiColor(50);
      return `
        <div style="background:var(--bg);border-radius:8px;padding:12px;border:1px solid var(--border);">
          <div style="font-size:0.7rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">${labels[key] || key}</div>
          <div style="font-family:var(--font-mono);font-size:1.1rem;font-weight:500;color:${color};margin:4px 0;">
            ${val} <span style="font-size:0.65rem;opacity:.7">${units[key] || ''}</span>
          </div>
          <div style="height:3px;background:var(--border);border-radius:2px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:2px;transition:width .5s;"></div>
          </div>
          ${over ? `<div style="font-size:0.65rem;color:${color};margin-top:3px;">Above safe limit</div>` : ''}
        </div>`;
    }).join('');
}

function renderMiniForecast(data) {
  const bar = document.getElementById('dashForecast');
  const forecast = data.forecast || [];
  const best = data.best_time || {};

  bar.innerHTML = forecast.map((h, i) => {
    const color = aqiColor(h.aqi);
    const isBest = h.hour === best.best_hour;
    return `
      <div class="forecast-hour ${isBest ? 'best' : ''}" title="${h.hour}: AQI ${h.aqi} (${aqiCategory(h.aqi)})">
        <div class="hour-label">${h.label || h.hour}</div>
        <div class="hour-aqi" style="color:${color}">${h.aqi}</div>
        <div class="hour-bar" style="background:${color}"></div>
        <div style="font-size:.8rem;">${h.emoji || aqiEmoji(h.aqi)}</div>
      </div>`;
  }).join('');

  const bestEl = document.getElementById('bestTime');
  if (best.best_hour) {
    bestEl.textContent = `${best.best_hour} (AQI ${best.best_aqi}) — ${best.recommendation}`;
  }
}

function renderCitiesGrid(cities, currentCity) {
  const grid = document.getElementById('citiesGrid');
  grid.innerHTML = cities.map(c => {
    const color = c.color || aqiColor(c.aqi);
    const bg = aqiBg(c.aqi);
    const isActive = c.city_id === currentCity;
    return `
      <div onclick="switchCity('${c.city_id}')" style="
        background: ${bg};
        border: 2px solid ${isActive ? color : 'transparent'};
        border-radius: 10px;
        padding: 12px;
        cursor: pointer;
        transition: transform .15s, box-shadow .15s;
      " onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 12px rgba(0,0,0,.1)'"
         onmouseout="this.style.transform='';this.style.boxShadow=''">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <div style="font-size:0.8rem;font-weight:600;color:var(--text)">${c.city_name}</div>
          <div style="font-size:1.1rem;">${c.emoji}</div>
        </div>
        <div style="font-family:var(--font-display);font-size:1.6rem;font-weight:900;color:${color};line-height:1;margin-top:4px;">${c.aqi}</div>
        <div style="font-size:0.7rem;color:${color};font-weight:600;margin-top:2px;">${c.category}</div>
      </div>`;
  }).join('');
}

function renderAlertBanner(data) {
  if (!data) return;
  const aqi = data.aqi;
  if (aqi <= 100) return;

  const color = aqiColor(aqi);
  const bg = aqiBg(aqi);
  const banner = document.getElementById('alertBanner');
  banner.innerHTML = `
    <div class="alert-banner" style="background:${bg};border-left-color:${color};margin-bottom:16px;">
      <span style="font-size:1.4rem;">${aqiEmoji(aqi)}</span>
      <div style="flex:1;">
        <strong style="color:${color};">${aqiCategory(aqi)} Air Quality — AQI ${aqi}</strong>
        <div style="font-size:0.82rem;color:var(--text-muted);margin-top:2px;">
          ${aqi > 200 ? 'Limit outdoor exposure. Wear an N95 mask.' :
            aqi > 150 ? 'Sensitive groups should reduce outdoor activity.' :
            'Air quality is moderate — keep an eye on it.'}
        </div>
      </div>
      <button onclick="this.parentElement.remove()" style="background:none;border:none;cursor:pointer;color:var(--text-muted);">✕</button>
    </div>`;
}

function switchCity(cityId) {
  document.getElementById('citySelect').value = cityId;
  App.currentCity = cityId;
  App.reloadCurrentPage();
}