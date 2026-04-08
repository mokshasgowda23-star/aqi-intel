// frontend/pages/activities.js
// Outdoor activity intelligence: run / cycle / walk / dog walk

App.registerLoader('activities', loadActivities);

async function loadActivities(cityId) {
  const el = document.getElementById('activitiesContent');
  el.innerHTML = skeleton(200);

  const data = await apiFetch(`/api/city/${cityId}/activities`);
  if (!data) { el.innerHTML = '<p>Failed to load activity data.</p>'; return; }

  el.innerHTML = renderActivitiesHTML(data);
}

function renderActivitiesHTML(d) {
  const overall = d.overall || {};
  const color = overall.color || aqiColor(d.aqi);
  const bg = aqiBg(d.aqi);

  const activityCards = Object.values(d.activities || {}).map(act => {
    const statusColor = act.safe ? 'var(--good)' :
                        act.caution ? 'var(--moderate)' : 'var(--very-poor)';
    const statusBg = act.safe ? '#e8f8ee' :
                     act.caution ? '#fff9e0' : '#ffe6e6';
    const statusIcon = act.safe ? '✅' : act.caution ? '⚠️' : '❌';

    return `
      <div class="activity-card" style="border-color:${statusColor}40;background:${statusBg};">
        <div style="display:flex;align-items:center;gap:8px;">
          <span class="activity-icon">${act.icon}</span>
          <span class="activity-label">${act.label}</span>
          <span style="margin-left:auto;font-size:1.1rem;">${statusIcon}</span>
        </div>
        <div class="activity-status" style="color:${statusColor};font-weight:500;">${act.message}</div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-top:4px;">
          Safe up to AQI ${act.max_safe} · Caution up to ${act.max_caution}
        </div>
        <div style="height:3px;background:var(--border);border-radius:2px;margin-top:8px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(100,(d.aqi/act.max_caution)*100)}%;background:${statusColor};border-radius:2px;transition:width .6s;"></div>
        </div>
      </div>`;
  }).join('');

  const indoorCards = (d.indoor_alternatives || []).map(alt => `
    <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border-radius:8px;">
      <span style="font-size:1.4rem;">${alt.icon}</span>
      <div>
        <div style="font-size:0.875rem;font-weight:600;">${alt.activity}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);">${alt.why}</div>
      </div>
    </div>`).join('');

  const weatherNotes = (d.weather_notes || []).map(n => `
    <div style="font-size:0.82rem;padding:7px 0;border-bottom:1px solid var(--border);">${n}</div>
  `).join('');

  return `
    <!-- Overall verdict -->
    <div class="card" style="background:linear-gradient(135deg,${bg},#fff 70%);border-color:${color}40;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:2.5rem;">${aqiEmoji(d.aqi)}</div>
        <div>
          <div style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;">${overall.label}</div>
          <div style="font-size:0.85rem;color:var(--text-muted);margin-top:4px;">
            Current AQI: <strong style="color:${color}">${d.aqi}</strong> · ${aqiCategory(d.aqi)}
          </div>
        </div>
      </div>
    </div>

    <!-- Activity Grid -->
    <div class="card" style="margin-bottom:16px;">
      <div class="card-title">Activity Safety Today</div>
      <div class="grid-3">${activityCards}</div>
    </div>

    <div class="grid-2" style="margin-bottom:16px;">
      <!-- Indoor alternatives -->
      ${indoorCards ? `
        <div class="card">
          <div class="card-title">🏠 Indoor Alternatives</div>
          <div style="display:flex;flex-direction:column;gap:8px;">${indoorCards}</div>
        </div>` : '<div></div>'}

      <!-- Weather notes -->
      <div class="card">
        <div class="card-title">🌤️ Weather Factors</div>
        ${weatherNotes || '<div style="font-size:.85rem;color:var(--good);">No weather concerns today.</div>'}
      </div>
    </div>

    <!-- Indoor venues -->
    <div class="card">
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px;">
        <div class="card-title" style="margin:0;">🏋️ Nearby Indoor Venues</div>
        <span style="font-size:0.75rem;color:var(--text-muted);">${cityLabel(App.currentCity)}</span>
      </div>
      <div id="venuesList">Loading venues...</div>
    </div>`;
}

// Load venues after rendering main content
App.registerLoader('activities', async (cityId) => {
  const el = document.getElementById('activitiesContent');
  el.innerHTML = skeleton(200);

  const [actData, venueData] = await Promise.all([
    apiFetch(`/api/city/${cityId}/activities`),
    apiFetch(`/api/city/${cityId}/indoor`),
  ]);

  if (!actData) { el.innerHTML = '<p>Failed to load activity data.</p>'; return; }
  el.innerHTML = renderActivitiesHTML(actData);

  // Inject venues
  const venuesEl = document.getElementById('venuesList');
  if (venuesEl && venueData?.venues?.length) {
    venuesEl.innerHTML = `
      <div class="grid-2">
        ${venueData.venues.map(v => `
          <div style="display:flex;align-items:center;gap:10px;padding:10px;background:var(--bg);border-radius:8px;">
            <span style="font-size:1.5rem;">${v.icon}</span>
            <div style="flex:1;">
              <div style="font-size:0.85rem;font-weight:600;">${v.name}</div>
              <div style="font-size:0.72rem;color:var(--text-muted);">${v.area} · ${v.type.replace('_',' ')}</div>
            </div>
            <div style="font-size:0.78rem;color:#f4a61d;">★ ${v.rating}</div>
          </div>`).join('')}
      </div>`;
  } else if (venuesEl) {
    venuesEl.innerHTML = '<div style="font-size:.85rem;color:var(--text-muted)">No venues data for this city yet.</div>';
  }
});