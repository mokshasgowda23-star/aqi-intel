// frontend/pages/heatmap.js
// Zone-level AQI heatmap with filters and insights

App.registerLoader('heatmap', loadHeatmap);

let _allZones = [];

async function loadHeatmap(cityId) {
  const grid = document.getElementById('zoneGrid');
  const insights = document.getElementById('zoneInsights');
  grid.innerHTML = [1,2,3,4,5,6].map(() => skeleton(120)).join('');

  const data = await apiFetch(`/api/city/${cityId}/heatmap`);
  if (!data) {
    grid.innerHTML = '<p style="color:var(--text-muted)">Failed to load zone data.</p>';
    return;
  }

  _allZones = data.zones;
  renderZones(_allZones);
  renderZoneInsights(data);
}

function renderZones(zones) {
  const grid = document.getElementById('zoneGrid');
  if (!zones.length) {
    grid.innerHTML = '<p style="color:var(--text-muted)">No zones match this filter.</p>';
    return;
  }

  grid.innerHTML = zones.map(z => {
    const color = z.color || aqiColor(z.aqi);
    const typeIcon = zoneTypeIcon(z.type);

    // Darken color for text readability
    return `
      <div class="zone-card" style="background:${color};"
           onclick="showZoneDetail('${z.id}', '${z.name}', ${z.aqi}, '${z.category}', '${z.type}')">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;">
          <div>
            <div class="zone-name">${z.name}</div>
            <div class="zone-type">${typeIcon} ${z.type}</div>
          </div>
          <div style="font-size:1.4rem;">${z.emoji || aqiEmoji(z.aqi)}</div>
        </div>
        <div class="zone-aqi-big">${z.aqi}</div>
        <div class="zone-category">${z.category}</div>
        <div style="margin-top:8px;height:3px;background:rgba(255,255,255,.3);border-radius:2px;overflow:hidden;">
          <div style="height:100%;width:${Math.min(100,(z.aqi/500)*100)}%;background:rgba(255,255,255,.6);border-radius:2px;"></div>
        </div>
      </div>`;
  }).join('');
}

function renderZoneInsights(data) {
  const el = document.getElementById('zoneInsights');
  const zones = data.zones || [];
  const avg = Math.round(zones.reduce((a,z) => a + z.aqi, 0) / zones.length);

  el.innerHTML = `
    <div class="card-title">Zone Insights — ${data.city_name}</div>
    <div class="grid-3">
      <div style="text-align:center;padding:12px;background:var(--bg);border-radius:8px;">
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Cleanest Zone</div>
        <div style="font-size:1rem;font-weight:700;color:var(--good);">🌿 ${data.cleanest_zone || '—'}</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--bg);border-radius:8px;">
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">City Average</div>
        <div style="font-size:1.5rem;font-weight:900;font-family:var(--font-display);color:${aqiColor(avg)};">${avg}</div>
        <div style="font-size:0.75rem;color:${aqiColor(avg)};">${aqiCategory(avg)}</div>
      </div>
      <div style="text-align:center;padding:12px;background:var(--bg);border-radius:8px;">
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;margin-bottom:4px;">Most Polluted</div>
        <div style="font-size:1rem;font-weight:700;color:var(--very-poor);">🏭 ${data.worst_zone || '—'}</div>
      </div>
    </div>
    <div style="margin-top:12px;font-size:0.85rem;color:var(--text-muted);line-height:1.6;">
      💡 Industrial and transport zones typically run 30–40% higher AQI than residential areas.
      Green zones and parks tend to have the cleanest readings.
    </div>`;
}

function filterZones(type) {
  document.querySelectorAll('.zone-filter').forEach(b => b.classList.remove('active'));
  document.querySelector(`[data-type="${type}"]`).classList.add('active');

  const filtered = type === 'all' ? _allZones : _allZones.filter(z => z.type === type);
  renderZones(filtered);
}

function showZoneDetail(id, name, aqi, category, type) {
  const color = aqiColor(aqi);
  const existing = document.getElementById('zoneModal');
  if (existing) existing.remove();

  const modal = document.createElement('div');
  modal.id = 'zoneModal';
  modal.style.cssText = `
    position:fixed;bottom:20px;right:20px;
    background:#fff;border:1px solid ${color};border-radius:12px;
    padding:16px;max-width:280px;box-shadow:0 8px 30px rgba(0,0,0,.15);
    z-index:999;animation:slideIn .25s ease;
  `;
  modal.innerHTML = `
    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
      <strong style="font-size:1rem;">${name}</strong>
      <button onclick="document.getElementById('zoneModal').remove()" style="background:none;border:none;cursor:pointer;color:#999;">✕</button>
    </div>
    <div style="font-family:var(--font-display);font-size:2.5rem;font-weight:900;color:${color};line-height:1;">${aqi}</div>
    <div style="font-size:0.8rem;color:${color};font-weight:600;margin-bottom:8px;">${category}</div>
    <div style="font-size:0.8rem;color:var(--text-muted);">Zone type: ${zoneTypeIcon(type)} ${type}</div>
    <div style="margin-top:10px;font-size:0.8rem;padding:8px;background:var(--bg);border-radius:6px;color:var(--text);">
      ${aqi > 200 ? '❌ Avoid this zone if possible today.' :
        aqi > 100 ? '⚠️ Mask recommended in this area.' :
        '✅ Safe to spend time in this zone.'}
    </div>`;
  document.body.appendChild(modal);

  // Auto-dismiss after 4s
  setTimeout(() => modal.remove(), 4000);
}

function zoneTypeIcon(type) {
  const map = {
    industrial: '🏭', residential: '🏠', commercial: '🏬',
    green: '🌿', tech: '💻', transport: '🚌'
  };
  return map[type] || '📍';
}