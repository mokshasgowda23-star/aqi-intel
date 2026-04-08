// frontend/pages/school.js
// School/Kids mode — recess safety, commute, age-group advice, parent message

App.registerLoader('school', loadSchool);

async function loadSchool(cityId) {
  const el = document.getElementById('schoolContent');
  el.innerHTML = skeleton(300);

  const data = await apiFetch(`/api/city/${cityId}/school`);
  if (!data) { el.innerHTML = '<p>Failed to load school data.</p>'; return; }

  el.innerHTML = renderSchoolHTML(data);
}

function renderSchoolHTML(d) {
  const alertLevel = d.school_alert_level || {};
  const recess = d.recess || {};
  const commute = d.commute || {};

  const alertBg = aqiBg(d.aqi);

  // Age group cards
  const ageCards = Object.entries(d.age_groups || {}).map(([, ag]) => {
    const isUnsafe = ag.status === 'unsafe';
    const isCaution = ag.status === 'caution';
    const color = ag.color || (isUnsafe ? 'var(--very-poor)' : isCaution ? 'var(--moderate)' : 'var(--good)');
    const icon = isUnsafe ? '❌' : isCaution ? '⚠️' : '✅';
    return `
      <div style="border-radius:10px;padding:14px;background:${aqiBg(d.aqi)};border:1px solid ${ag.color}40;">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
          <div style="font-size:0.8rem;font-weight:600;">${ag.label}</div>
          <span style="font-size:1.2rem;">${icon}</span>
        </div>
        <div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:6px;">
          Safe up to AQI <strong>${ag.max_safe_aqi}</strong>
        </div>
        <div style="font-size:0.78rem;color:${color};font-weight:500;">${ag.advice}</div>
      </div>`;
  }).join('');

  const advisoryItems = (d.general_advisory || []).map(a =>
    `<div style="font-size:0.85rem;padding:8px 0;border-bottom:1px solid var(--border);line-height:1.5;">${a}</div>`
  ).join('');

  return `
    <!-- Alert Level Banner -->
    <div style="background:${alertLevel.color || '#00b050'};border-radius:12px;padding:16px 20px;
         color:#fff;margin-bottom:16px;display:flex;align-items:center;gap:14px;">
      <div>
        <div style="font-size:0.75rem;letter-spacing:.06em;text-transform:uppercase;opacity:.85;">School Alert Level</div>
        <div style="font-family:var(--font-display);font-size:1.8rem;font-weight:900;line-height:1;">${alertLevel.label}</div>
        <div style="font-size:0.9rem;margin-top:4px;opacity:.9;">${alertLevel.action}</div>
      </div>
      <div style="margin-left:auto;text-align:right;">
        <div style="font-size:3rem;font-weight:900;font-family:var(--font-display);">${d.aqi}</div>
        <div style="font-size:0.75rem;opacity:.85;">Current AQI</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px;">
      <!-- Recess Decision -->
      <div class="card" style="border-left:4px solid ${recess.color || 'var(--good)'};">
        <div class="card-title">⛹️ Recess Decision</div>
        <div style="font-size:1.8rem;margin-bottom:8px;">${recess.icon}</div>
        <div style="font-size:1rem;font-weight:700;color:${recess.color};">${recess.message}</div>
        <div style="margin-top:8px;padding:8px;background:var(--bg);border-radius:6px;font-size:.82rem;color:var(--text-muted);">
          Duration: <strong>${recess.duration}</strong>
        </div>
      </div>

      <!-- Commute Advice -->
      <div class="card">
        <div class="card-title">🏫 School Commute</div>
        <div style="font-size:1.8rem;margin-bottom:8px;">${commute.icon}</div>
        <div style="font-size:0.9rem;font-weight:600;">${commute.message}</div>
        ${commute.mask ? `
          <div style="margin-top:8px;display:inline-flex;align-items:center;gap:6px;
               background:${aqiBg(d.aqi)};padding:6px 12px;border-radius:8px;font-size:.82rem;">
            😷 Mask type: <strong>${commute.mask_type || 'Surgical'}</strong>
          </div>` : '<div style="margin-top:8px;font-size:.82rem;color:var(--good);">✅ No mask needed for commute today</div>'}
      </div>
    </div>

    <!-- Age Group Breakdown -->
    <div class="card" style="margin-bottom:16px;">
      <div class="card-title">👶 Age Group Safety</div>
      <div class="grid-4">${ageCards}</div>
    </div>

    <!-- General Advisory -->
    <div class="grid-2" style="margin-bottom:16px;">
      <div class="card">
        <div class="card-title">📋 School Advisory</div>
        ${advisoryItems}
      </div>

      <!-- Parent WhatsApp Message -->
      <div class="card" style="border:1px dashed var(--border-dark);">
        <div class="card-title">📱 Parent Message</div>
        <div style="background:var(--bg);border-radius:8px;padding:12px;font-size:0.85rem;line-height:1.6;
             border-left:3px solid #25d366;font-style:italic;">
          "${d.parent_message}"
        </div>
        <button onclick="copyParentMessage()" style="
          margin-top:10px;width:100%;padding:8px;border-radius:8px;
          background:#25d366;color:#fff;border:none;cursor:pointer;
          font-size:0.85rem;font-weight:600;">
          📋 Copy for WhatsApp
        </button>
      </div>
    </div>`;

  // Store for copy function
  window._parentMsg = d.parent_message;
}

function copyParentMessage() {
  navigator.clipboard.writeText(window._parentMsg || '').then(() => {
    const btn = event.target;
    btn.textContent = '✅ Copied!';
    setTimeout(() => btn.textContent = '📋 Copy for WhatsApp', 2000);
  });
}