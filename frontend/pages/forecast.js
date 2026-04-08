// frontend/pages/forecast.js
// 12-hour AQI forecast with chart, best time, and window analysis

App.registerLoader('forecast', loadForecast);

let _forecastChart = null;

async function loadForecast(cityId) {
  document.getElementById('bestTimeCard').innerHTML = skeleton(100);
  document.getElementById('fullForecastBar').innerHTML = skeleton(80);

  const data = await apiFetch(`/api/city/${cityId}/forecast`);
  if (!data) return;

  renderBestTimeCard(data.best_time);
  renderFullForecastBar(data.forecast);
  renderForecastChart(data.forecast, cityId);
}

function renderBestTimeCard(best) {
  if (!best) return;
  const el = document.getElementById('bestTimeCard');
  const aqi = best.best_aqi;
  const color = aqiColor(aqi);
  const bg = aqiBg(aqi);

  const windows = (best.good_windows || []).slice(0, 3);

  el.innerHTML = `
    <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;">
      <div style="background:${bg};border-radius:10px;padding:16px 20px;flex:0 0 auto;">
        <div style="font-size:0.75rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;">Best Time Outside</div>
        <div style="font-family:var(--font-display);font-size:2rem;font-weight:900;color:${color};">${best.best_hour}</div>
        <div style="font-size:0.8rem;color:${color};font-weight:600;">AQI ${aqi} · ${aqiCategory(aqi)}</div>
      </div>
      <div style="flex:1;min-width:200px;">
        <div style="font-size:0.9rem;font-weight:600;margin-bottom:8px;">${best.recommendation}</div>
        ${windows.length ? `
          <div style="font-size:0.8rem;color:var(--text-muted);margin-bottom:6px;">Clean windows today:</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;">
            ${windows.map(w => `
              <span style="background:${aqiBg(w.aqi)};color:${aqiColor(w.aqi)};border:1px solid ${aqiColor(w.aqi)}40;
                    border-radius:6px;padding:3px 10px;font-size:0.78rem;font-weight:500;">
                ${w.hour} · ${w.aqi}
              </span>`).join('')}
          </div>` : `<div style="font-size:0.82rem;color:var(--text-muted);">No great windows today — minimize outdoor time.</div>`}
      </div>
    </div>`;
}

function renderFullForecastBar(forecast) {
  const bar = document.getElementById('fullForecastBar');
  if (!forecast) return;

  const minAqi = Math.min(...forecast.map(h => h.aqi));

  bar.innerHTML = forecast.map(h => {
    const color = aqiColor(h.aqi);
    const isBest = h.aqi === minAqi;
    return `
      <div class="forecast-hour ${isBest ? 'best' : ''}"
           style="${isBest ? `box-shadow:0 0 0 2px ${color};` : ''}"
           title="${h.hour}: AQI ${h.aqi}">
        <div class="hour-label">${h.label}</div>
        <div style="font-size:0.9rem;">${h.emoji || aqiEmoji(h.aqi)}</div>
        <div class="hour-aqi" style="color:${color}">${h.aqi}</div>
        <div class="hour-bar" style="background:${color}"></div>
        <div style="font-size:0.65rem;color:var(--text-muted);">${(h.category||'').slice(0,3)}</div>
        ${isBest ? '<div style="font-size:0.6rem;color:var(--good);font-weight:700;">BEST</div>' : ''}
      </div>`;
  }).join('');
}

function renderForecastChart(forecast, cityId) {
  const canvas = document.getElementById('forecastCanvas');
  if (!canvas || !forecast?.length) return;

  if (_forecastChart) {
    _forecastChart.destroy();
    _forecastChart = null;
  }

  const labels = forecast.map(h => h.label);
  const values = forecast.map(h => h.aqi);
  const colors = forecast.map(h => aqiColor(h.aqi));

  _forecastChart = new Chart(canvas, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'AQI',
        data: values,
        backgroundColor: colors.map(c => c + 'cc'),
        borderColor: colors,
        borderWidth: 1,
        borderRadius: 4,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: ctx => `AQI ${ctx.raw} — ${aqiCategory(ctx.raw)}`
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          max: Math.max(300, Math.max(...values) + 50),
          grid: { color: '#f0ede8' },
          ticks: { font: { family: 'DM Mono', size: 11 } }
        },
        x: {
          grid: { display: false },
          ticks: { font: { family: 'DM Sans', size: 11 } }
        }
      }
    }
  });
}