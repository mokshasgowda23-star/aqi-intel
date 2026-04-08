// frontend/pages/calendar.js
// Monthly air quality calendar + weekly summary + day-of-week analysis

App.registerLoader('calendar', loadCalendar);

async function loadCalendar(cityId) {
  const el = document.getElementById('calendarContent');
  el.innerHTML = skeleton(300);

  const [calData, analysisData] = await Promise.all([
    apiFetch(`/api/city/${cityId}/calendar`),
    apiFetch(`/api/city/${cityId}/calendar/analysis`),
  ]);

  if (!calData) { el.innerHTML = '<p>Failed to load calendar data.</p>'; return; }
  el.innerHTML = renderCalendarHTML(calData, analysisData);
}

function renderCalendarHTML(cal, analysis) {
  const s = cal.summary || {};
  const days = cal.days || [];

  // Calendar grid header
  const weekdays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const headerHTML = weekdays.map(d =>
    `<div style="text-align:center;font-size:.7rem;font-weight:600;color:var(--text-muted);padding:4px;">${d}</div>`
  ).join('');

  // Pad the first week
  const firstDay = new Date(days[0]?.date);
  const dayOfWeek = firstDay.getDay(); // 0=Sun, 1=Mon...
  const pad = (dayOfWeek === 0 ? 6 : dayOfWeek - 1); // Mon=0
  const paddingCells = Array(pad).fill('<div></div>').join('');

  const dayCards = days.map(d => {
    const color = d.color || aqiColor(d.aqi);
    const bg = aqiBg(d.aqi);
    const isToday = d.date === new Date().toISOString().slice(0, 10);

    return `
      <div class="cal-day" style="background:${bg};border:${isToday ? `2px solid ${color}` : '1px solid transparent'};"
           title="${d.date}: AQI ${d.aqi} (${d.category})"
           onclick="showDayDetail('${d.date}', ${d.aqi}, '${d.category}', '${color}')">
        <div class="day-num" style="color:${color};">${d.day}</div>
        <div class="day-aqi" style="color:${color};">${d.aqi}</div>
        ${isToday ? '<div style="width:5px;height:5px;background:var(--accent);border-radius:50%;margin-top:1px;"></div>' : ''}
      </div>`;
  }).join('');

  // Day-of-week insights
  let dowHTML = '';
  if (analysis?.weekday_averages) {
    const order = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
    const maxVal = Math.max(...Object.values(analysis.weekday_averages));
    dowHTML = order.filter(d => analysis.weekday_averages[d]).map(d => {
      const val = analysis.weekday_averages[d];
      const color = aqiColor(val);
      const pct = Math.round((val / maxVal) * 100);
      const isBest = d === analysis.best_day_of_week;
      return `
        <div style="display:flex;align-items:center;gap:8px;padding:5px 0;">
          <div style="width:28px;font-size:0.75rem;color:var(--text-muted);font-weight:${isBest?'700':'400'}">${d}</div>
          <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
            <div style="height:100%;width:${pct}%;background:${color};border-radius:3px;transition:width .5s;"></div>
          </div>
          <div style="font-family:var(--font-mono);font-size:0.78rem;color:${color};min-width:28px;text-align:right;">${val}</div>
          ${isBest ? '<span style="font-size:.7rem;color:var(--good);">✓ Best</span>' : ''}
        </div>`;
    }).join('');
  }

  return `
    <!-- Summary stats -->
    <div class="grid-4" style="margin-bottom:16px;">
      <div class="card" style="text-align:center;">
        <div style="font-family:var(--font-display);font-size:2.2rem;font-weight:900;color:var(--good);">${s.good_days}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;">Good Days</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-family:var(--font-display);font-size:2.2rem;font-weight:900;color:var(--poor);">${s.bad_days}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;">Bad Days</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-family:var(--font-display);font-size:2.2rem;font-weight:900;color:var(--accent);">${s.good_percent}%</div>
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;">Clean Air Rate</div>
      </div>
      <div class="card" style="text-align:center;">
        <div style="font-size:1.5rem;">${s.current_streak?.emoji || '😐'}</div>
        <div style="font-family:var(--font-display);font-size:1.5rem;font-weight:900;color:var(--accent);">${s.current_streak?.count || 0}</div>
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;">Day Streak</div>
      </div>
    </div>

    <div class="grid-2" style="margin-bottom:16px;">
      <!-- Calendar -->
      <div class="card">
        <div class="card-title">📅 This Month</div>
        <div style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;">Click any day for details</div>
        <div class="cal-grid">${headerHTML}${paddingCells}${dayCards}</div>
        <!-- Legend -->
        <div style="display:flex;gap:12px;margin-top:12px;flex-wrap:wrap;">
          ${[
            {label:'Good', color:'#00b050', bg:'#e8f8ee'},
            {label:'Satisfactory', color:'#7ab648', bg:'#f2fae8'},
            {label:'Moderate', color:'#e8a000', bg:'#fff9e0'},
            {label:'Poor', color:'#e05a00', bg:'#fff0e6'},
            {label:'Very Poor/Severe', color:'#cc0000', bg:'#ffe6e6'},
          ].map(l => `
            <div style="display:flex;align-items:center;gap:4px;font-size:.68rem;">
              <div style="width:10px;height:10px;border-radius:2px;background:${l.bg};border:1px solid ${l.color}40;"></div>
              <span style="color:var(--text-muted);">${l.label}</span>
            </div>`).join('')}
        </div>
      </div>

      <!-- Right column -->
      <div style="display:flex;flex-direction:column;gap:16px;">
        <!-- Best/Worst days -->
        <div class="card">
          <div class="card-title">🏅 Month Highlights</div>
          ${s.best_day ? `
            <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#e8f8ee;border-radius:8px;margin-bottom:8px;">
              <span style="font-size:1.3rem;">🌿</span>
              <div>
                <div style="font-size:0.72rem;color:var(--text-muted);">Cleanest Day</div>
                <div style="font-weight:600;font-size:0.9rem;">${s.best_day.date} · AQI ${s.best_day.aqi}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;padding:10px;background:#ffe6e6;border-radius:8px;">
              <span style="font-size:1.3rem;">😷</span>
              <div>
                <div style="font-size:0.72rem;color:var(--text-muted);">Most Polluted Day</div>
                <div style="font-weight:600;font-size:0.9rem;">${s.worst_day.date} · AQI ${s.worst_day.aqi}</div>
              </div>
            </div>` : ''}
        </div>

        <!-- Day-of-week patterns -->
        <div class="card">
          <div class="card-title">📊 Day-of-Week Pattern</div>
          ${dowHTML}
          ${analysis?.insight ? `<div style="margin-top:10px;font-size:.8rem;padding:8px;background:var(--bg);border-radius:6px;color:var(--text-muted);">${analysis.insight}</div>` : ''}
        </div>
      </div>
    </div>

    <!-- Day detail popup placeholder -->
    <div id="dayDetailPopup"></div>`;
}

function showDayDetail(date, aqi, category, color) {
  const bg = aqiBg(aqi);
  const popup = document.getElementById('dayDetailPopup');
  popup.innerHTML = `
    <div class="alert-banner" style="background:${bg};border-left-color:${color};margin-top:0;">
      <span style="font-size:1.5rem;">${aqiEmoji(aqi)}</span>
      <div>
        <strong>${date}</strong>
        <div style="font-size:.85rem;color:${color};font-weight:600;">${category} · AQI ${aqi}</div>
        <div style="font-size:.8rem;color:var(--text-muted);margin-top:2px;">
          ${aqi <= 100 ? '✅ This was a good air day — great for outdoor activities.' :
            aqi <= 200 ? '⚠️ Moderate air — outdoor activities needed some caution.' :
            '❌ Poor air quality — outdoor activities were not recommended.'}
        </div>
      </div>
      <button onclick="document.getElementById('dayDetailPopup').innerHTML=''" style="background:none;border:none;cursor:pointer;color:#999;">✕</button>
    </div>`;
}