// frontend/pages/alerts.js
// AQI threshold alert setup and status check

App.registerLoader('alerts', loadAlerts);

async function loadAlerts(cityId) {
  const el = document.getElementById('alertsContent');
  el.innerHTML = skeleton(200);

  const [alertStatus, suggestion] = await Promise.all([
    apiFetch(`/api/alert/${App.sessionId}/${cityId}`),
    apiFetch(`/api/city/${cityId}`), // for current AQI context
  ]);

  el.innerHTML = renderAlertsHTML(alertStatus, suggestion, cityId);
  _initSlider();
}

function renderAlertsHTML(status, aqiData, cityId) {
  const aqi = aqiData?.aqi || 100;
  const color = aqiColor(aqi);
  const bg = aqiBg(aqi);

  const hasAlert = status?.active;
  const triggered = status?.triggered;

  // Threshold slider with NAQI category markers
  const categories = [
    { aqi: 50,  label: 'Good',          color: '#00b050' },
    { aqi: 100, label: 'Satisfactory',  color: '#7ab648' },
    { aqi: 150, label: 'Moderate',      color: '#e8a000' },
    { aqi: 200, label: 'Poor',          color: '#e05a00' },
    { aqi: 300, label: 'Very Poor',     color: '#cc0000' },
  ];

  const savedThreshold = parseInt(localStorage.getItem('aqi_threshold') || '150');

  return `
    <!-- Current status -->
    ${triggered ? `
      <div class="alert-banner" style="background:${aqiBg(aqi)};border-left-color:${color};">
        <span style="font-size:1.5rem;">🚨</span>
        <div>
          <strong style="color:${color};">${status.message}</strong>
          ${status.action ? `<div style="font-size:.82rem;color:var(--text-muted);margin-top:3px;">${status.action.text}</div>` : ''}
        </div>
      </div>` : ''}

    <div class="grid-2" style="margin-bottom:16px;">
      <!-- Alert Setup Card -->
      <div class="card">
        <div class="card-title">🔔 Set Your Alert</div>
        <div style="font-size:0.85rem;color:var(--text-muted);margin-bottom:16px;">
          Get notified when AQI in <strong>${cityLabel(cityId)}</strong> crosses this value:
        </div>

        <!-- Threshold Slider -->
        <div style="margin-bottom:16px;">
          <div style="display:flex;justify-content:space-between;align-items:baseline;margin-bottom:8px;">
            <span style="font-size:0.85rem;font-weight:500;">Alert Threshold</span>
            <span style="font-family:var(--font-display);font-size:2rem;font-weight:900;" id="thresholdDisplay">${savedThreshold}</span>
          </div>
          <input type="range" id="thresholdSlider" min="50" max="400" step="10" value="${savedThreshold}"
            oninput="updateSlider(this.value)"
            style="width:100%;accent-color:var(--accent);cursor:pointer;">
          <!-- Category markers -->
          <div style="display:flex;justify-content:space-between;margin-top:6px;">
            ${categories.map(c => `
              <div style="text-align:center;cursor:pointer;" onclick="setThreshold(${c.aqi})">
                <div style="width:3px;height:8px;background:${c.color};margin:0 auto;border-radius:1px;"></div>
                <div style="font-size:.6rem;color:${c.color};font-weight:600;margin-top:2px;">${c.aqi}</div>
              </div>`).join('')}
          </div>
        </div>

        <!-- Category markers clickable -->
        <div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;">
          ${categories.map(c => `
            <button onclick="setThreshold(${c.aqi})"
              style="padding:4px 10px;border-radius:16px;border:1px solid ${c.color};
              background:${aqiBg(c.aqi)};color:${c.color};font-size:.72rem;cursor:pointer;font-weight:500;">
              ${c.label} (${c.aqi})
            </button>`).join('')}
        </div>

        <div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:12px;" id="sliderHint">
          ${_sliderHint(savedThreshold)}
        </div>

        <button onclick="saveAlert()"
          style="width:100%;padding:10px;background:var(--accent);color:#fff;border:none;
          border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer;">
          💾 Save Alert for ${cityLabel(cityId)}
        </button>
      </div>

      <!-- Current Status -->
      <div class="card">
        <div class="card-title">📊 Right Now</div>
        <div style="text-align:center;padding:20px 0;">
          <div style="font-family:var(--font-display);font-size:4rem;font-weight:900;color:${color};line-height:1;">${aqi}</div>
          <div style="font-size:.8rem;background:${color};color:#fff;display:inline-block;padding:3px 10px;border-radius:4px;margin-top:4px;">${aqiCategory(aqi)}</div>
        </div>

        <div style="padding:12px;background:${hasAlert && triggered ? aqiBg(aqi) : 'var(--bg)'};border-radius:8px;text-align:center;">
          ${hasAlert ? `
            <div style="font-size:.8rem;color:var(--text-muted);">Your threshold: <strong>${savedThreshold}</strong></div>
            <div style="margin-top:4px;font-size:.9rem;font-weight:600;color:${triggered ? color : 'var(--good)'};">
              ${triggered ? `🚨 AQI is ${aqi - savedThreshold} above your threshold` : `✅ AQI is ${savedThreshold - aqi} below your threshold`}
            </div>` :
            `<div style="font-size:.85rem;color:var(--text-muted);">No alert configured yet.<br>Set a threshold on the left.</div>`}
        </div>

        <!-- Smart suggestion -->
        ${status?.suggestion ? `
          <div style="margin-top:12px;padding:10px;background:var(--bg);border-radius:8px;border-left:3px solid var(--accent);">
            <div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:4px;">Smart Suggestion</div>
            <div style="font-size:.82rem;">${status.suggestion.reason}</div>
            <button onclick="setThreshold(${status.suggestion.suggested})"
              style="margin-top:6px;padding:4px 10px;border-radius:6px;border:1px solid var(--accent);
              background:transparent;color:var(--accent);font-size:.78rem;cursor:pointer;">
              Use ${status.suggestion.suggested}
            </button>
          </div>` : ''}
      </div>
    </div>

    <!-- Alert History placeholder -->
    <div class="card">
      <div class="card-title">📋 How Alerts Work</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;">
        ${[
          {icon:'🔔', title:'Set Threshold', desc:'Choose the AQI level that matters to you'},
          {icon:'📊', title:'Real-time Check', desc:'App checks AQI every time you open it'},
          {icon:'🚨', title:'In-app Alert', desc:'Banner appears when AQI crosses your threshold'},
          {icon:'💡', title:'Suggested Action', desc:'Specific advice based on how bad the air is'},
        ].map(s => `
          <div style="padding:12px;background:var(--bg);border-radius:8px;">
            <div style="font-size:1.3rem;">${s.icon}</div>
            <div style="font-weight:600;font-size:.85rem;margin-top:4px;">${s.title}</div>
            <div style="font-size:.75rem;color:var(--text-muted);margin-top:3px;">${s.desc}</div>
          </div>`).join('')}
      </div>
      <div style="margin-top:10px;font-size:.78rem;color:var(--text-muted);">
        💡 Push notifications require a native mobile app. This web version uses in-app banners.
      </div>
    </div>`;
}

function _initSlider() {
  const saved = parseInt(localStorage.getItem('aqi_threshold') || '150');
  const display = document.getElementById('thresholdDisplay');
  if (display) display.textContent = saved;
}

function updateSlider(val) {
  document.getElementById('thresholdDisplay').textContent = val;
  const hint = document.getElementById('sliderHint');
  if (hint) hint.textContent = _sliderHint(parseInt(val));
  localStorage.setItem('aqi_threshold', val);
}

function setThreshold(val) {
  const slider = document.getElementById('thresholdSlider');
  if (slider) slider.value = val;
  updateSlider(val);
}

function _sliderHint(threshold) {
  if (threshold <= 50) return '✅ Alert at "Good" level — very sensitive setting';
  if (threshold <= 100) return '😊 Alert when air goes from satisfactory to worse';
  if (threshold <= 150) return '⚠️ Recommended for sensitive groups (children, elderly)';
  if (threshold <= 200) return '😷 Alert at "Poor" level — minimum recommended threshold';
  if (threshold <= 300) return '🚨 Alert only at very poor air — late warning, use with care';
  return '☠️ Alert only at severe levels — consider lowering this';
}

async function saveAlert() {
  const threshold = parseInt(document.getElementById('thresholdSlider').value || 150);
  const res = await fetch('/api/alert/set', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: App.sessionId,
      city_id: App.currentCity,
      threshold,
    })
  });
  const data = await res.json();

  const btn = document.querySelector('[onclick="saveAlert()"]');
  btn.textContent = '✅ Alert Saved!';
  btn.style.background = 'var(--good)';
  setTimeout(() => {
    btn.textContent = `💾 Save Alert for ${cityLabel(App.currentCity)}`;
    btn.style.background = 'var(--accent)';
    loadAlerts(App.currentCity);
  }, 2000);

  document.getElementById('alertIndicator').style.display = 'flex';
}