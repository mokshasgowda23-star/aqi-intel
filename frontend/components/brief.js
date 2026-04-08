// frontend/pages/brief.js
// Daily Brief — "Here's how to live today well given today's air"

App.registerLoader('brief', loadBrief);

async function loadBrief(cityId) {
  const el = document.getElementById('briefContent');
  el.innerHTML = `<div class="grid-2">${[1,2,3,4].map(() => skeleton(120)).join('')}</div>`;

  // Pass user prefs if stored
  const prefs = _loadUserPrefs();
  const query = new URLSearchParams({
    kids: prefs.has_kids, pets: prefs.has_pets,
    runner: prefs.is_runner, cyclist: prefs.is_cyclist,
  });

  const data = await apiFetch(`/api/city/${cityId}/brief?${query}`);
  if (!data) { el.innerHTML = '<p>Failed to load daily brief.</p>'; return; }

  el.innerHTML = renderBriefHTML(data);
  // Attach checklist interactivity
  document.querySelectorAll('.checklist-item').forEach(item => {
    item.addEventListener('click', () => {
      item.classList.toggle('done');
      const box = item.querySelector('.check-box');
      box.textContent = item.classList.contains('done') ? '✓' : '';
    });
  });
}

function renderBriefHTML(d) {
  const color = d.color || aqiColor(d.aqi);
  const bg = aqiBg(d.aqi);

  return `
    <!-- Headline Card -->
    <div class="card" style="background:linear-gradient(135deg,${bg},#fff 70%);border-color:${color}40;margin-bottom:16px;">
      <div style="display:flex;align-items:center;gap:12px;">
        <div style="font-size:3rem;">${d.emoji} ${d.weather_emoji}</div>
        <div>
          <div style="font-size:0.8rem;color:var(--text-muted);font-weight:500;">${d.greeting}, ${d.city}</div>
          <div style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;line-height:1.3;margin-top:4px;">
            ${d.headline}
          </div>
          <div style="margin-top:6px;display:flex;gap:8px;align-items:center;">
            <span style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:0.75rem;font-weight:600;">
              AQI ${d.aqi} · ${d.category}
            </span>
            <span style="font-size:0.8rem;color:var(--text-muted);">${d.temp_c}°C · ${d.condition}</span>
          </div>
        </div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px;">
      <!-- Morning Checklist -->
      <div class="card">
        <div class="card-title">☀️ Morning Checklist</div>
        <div id="checklistItems">
          ${(d.checklist || []).map(item => `
            <div class="checklist-item ${item.critical ? 'check-critical' : ''}">
              <div class="check-box"></div>
              <span class="check-icon" style="font-size:1.1rem;">${item.icon}</span>
              <span class="check-label">${item.item}${item.critical ? ' <span style="color:var(--poor);font-size:.75rem;">Required</span>' : ''}</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- Quick Tips -->
      <div class="card">
        <div class="card-title">💡 Tips for Today</div>
        ${(d.tips || []).map(tip => `
          <div style="font-size:0.85rem;padding:8px 0;border-bottom:1px solid var(--border);line-height:1.4;">${tip}</div>
        `).join('')}
        ${d.tips?.length === 0 ? '<div style="font-size:.85rem;color:var(--good);">No special precautions needed today! 🌿</div>' : ''}
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px;">
      <!-- Mask & Outdoor Advice -->
      <div class="card">
        <div class="card-title">🎯 Key Advice</div>
        <div style="display:flex;flex-direction:column;gap:10px;">
          <div style="padding:10px;border-radius:8px;background:var(--bg);">
            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:.04em;">Mask</div>
            <div style="font-size:0.9rem;margin-top:3px;font-weight:500;">${d.mask?.message || '—'}</div>
          </div>
          <div style="padding:10px;border-radius:8px;background:var(--bg);">
            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:.04em;">Best Time Outside</div>
            <div style="font-size:0.9rem;margin-top:3px;font-weight:500;">${d.outdoor_timing || '—'}</div>
          </div>
          <div style="padding:10px;border-radius:8px;background:var(--bg);">
            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:.04em;">Indoor Air</div>
            <div style="font-size:0.9rem;margin-top:3px;font-weight:500;">${d.indoor_air || '—'}</div>
          </div>
          <div style="padding:10px;border-radius:8px;background:var(--bg);">
            <div style="font-size:0.7rem;text-transform:uppercase;color:var(--text-muted);letter-spacing:.04em;">Clothing</div>
            <div style="font-size:0.9rem;margin-top:3px;">${d.clothing || '—'}</div>
          </div>
        </div>
      </div>

      <!-- Commute + Food -->
      <div class="card">
        <div class="card-title">🏙️ City Life</div>
        ${d.commute ? `
          <div style="padding:12px;border-radius:8px;background:var(--bg);margin-bottom:10px;
              ${d.commute.critical ? 'border-left:3px solid var(--poor);' : ''}">
            <div style="font-size:1.2rem;">${d.commute.icon}</div>
            <div style="font-size:0.88rem;font-weight:500;margin-top:4px;">${d.commute.advice}</div>
            ${d.commute.detail ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">${d.commute.detail}</div>` : ''}
          </div>` : ''}
        ${d.food_suggestion ? `
          <div style="padding:12px;border-radius:8px;background:var(--bg);">
            <div style="font-size:1.2rem;">${d.food_suggestion.icon}</div>
            <div style="font-size:0.88rem;font-weight:500;margin-top:4px;">${d.food_suggestion.suggestion}</div>
            ${d.food_suggestion.detail ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-top:4px;">${d.food_suggestion.detail}</div>` : ''}
          </div>` : ''}
      </div>
    </div>

    ${d.personalized_notes?.length ? `
      <div class="card" style="margin-bottom:16px;border-left:4px solid var(--accent);">
        <div class="card-title">👤 Personalized for You</div>
        ${d.personalized_notes.map(note => `
          <div style="font-size:0.875rem;padding:8px 0;border-bottom:1px solid var(--border);">${note}</div>
        `).join('')}
      </div>` : ''}

    <!-- Personalization Settings -->
    <div class="card" style="border:1px dashed var(--border-dark);">
      <div class="card-title">⚙️ Personalize Your Brief</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;margin-bottom:12px;">
        ${[
          {key:'has_kids', label:'👧 I have kids'},
          {key:'has_pets', label:'🐕 I have pets'},
          {key:'is_runner', label:'🏃 I run outdoors'},
          {key:'is_cyclist', label:'🚴 I cycle'},
        ].map(p => {
          const prefs = _loadUserPrefs();
          const active = prefs[p.key];
          return `<button onclick="togglePref('${p.key}', this)"
            style="padding:6px 14px;border-radius:20px;border:1px solid var(--border);
            background:${active ? 'var(--accent)' : 'var(--bg-card)'};
            color:${active ? '#fff' : 'var(--text)'};
            cursor:pointer;font-size:0.82rem;transition:all .15s;">
            ${p.label}
          </button>`;
        }).join('')}
      </div>
      <div style="font-size:0.78rem;color:var(--text-muted);">Your preferences are saved locally and used to personalize health tips.</div>
    </div>`;
}

function togglePref(key, btn) {
  const prefs = _loadUserPrefs();
  prefs[key] = !prefs[key];
  localStorage.setItem('aqi_prefs', JSON.stringify(prefs));
  btn.style.background = prefs[key] ? 'var(--accent)' : 'var(--bg-card)';
  btn.style.color = prefs[key] ? '#fff' : 'var(--text)';
  // Reload brief with new prefs
  loadBrief(App.currentCity);
}

function _loadUserPrefs() {
  try {
    return JSON.parse(localStorage.getItem('aqi_prefs') || '{}');
  } catch { return {}; }
}