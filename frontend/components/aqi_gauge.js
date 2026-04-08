// frontend/components/aqi_gauge.js
// ─────────────────────────────────────────────────────────────────────────────
// AQI Gauge Component
//
// Renders an animated SVG semicircle gauge showing AQI value, category, emoji.
// Supports multiple sizes, dark mode, and standalone or embedded use.
//
// Usage:
//   AqiGauge.render('my-container', { aqi: 175, animate: true, size: 'lg' })
//   AqiGauge.update('my-container', 220)
//
// Or via HTML data attribute:
//   <div class="aqi-gauge-mount" data-aqi="175" data-size="md"></div>
//   AqiGauge.mountAll()
// ─────────────────────────────────────────────────────────────────────────────

const AqiGauge = (() => {

  // ── Constants ────────────────────────────────────────────────────────────

  const CATEGORIES = [
    { min: 0,   max: 50,  label: 'Good',         color: '#00b050', bg: '#e8f8ee', emoji: '😊' },
    { min: 51,  max: 100, label: 'Satisfactory',  color: '#7ab648', bg: '#f2fae8', emoji: '🙂' },
    { min: 101, max: 200, label: 'Moderate',       color: '#e8a000', bg: '#fff9e0', emoji: '😐' },
    { min: 201, max: 300, label: 'Poor',           color: '#e05a00', bg: '#fff0e6', emoji: '😷' },
    { min: 301, max: 400, label: 'Very Poor',      color: '#cc0000', bg: '#ffe6e6', emoji: '🚨' },
    { min: 401, max: 500, label: 'Severe',         color: '#660000', bg: '#ffd6d6', emoji: '☠️' },
  ];

  // Gauge arc geometry: starts at 210° (left), sweeps 240°
  const START_ANGLE    = 210;   // degrees (left side, slightly below horizontal)
  const TOTAL_SWEEP    = 240;   // degrees (going clockwise to right side)
  const MAX_AQI        = 500;

  const SIZES = {
    sm:  { r: 42, cx: 55, cy: 55, viewBox: '0 0 110 70', fontSize: 16, labelSize: 7,  emojiSize: 14, strokeW: 7  },
    md:  { r: 60, cx: 78, cy: 78, viewBox: '0 0 156 100', fontSize: 22, labelSize: 9, emojiSize: 18, strokeW: 9  },
    lg:  { r: 80, cx: 103, cy: 103, viewBox: '0 0 206 130', fontSize: 28, labelSize: 10, emojiSize: 22, strokeW: 11 },
    xl:  { r: 105, cx: 133, cy: 133, viewBox: '0 0 266 166', fontSize: 36, labelSize: 12, emojiSize: 28, strokeW: 13 },
  };

  // ── Helpers ──────────────────────────────────────────────────────────────

  function getCategory(aqi) {
    return CATEGORIES.find(c => aqi >= c.min && aqi <= c.max) || CATEGORIES[CATEGORIES.length - 1];
  }

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  /**
   * Convert an angle (measured from top / 12 o'clock, clockwise) to SVG x,y.
   * We offset by 90 because SVG 0° is at 3 o'clock.
   */
  function polarToCartesian(cx, cy, r, angleDeg) {
    const rad = degToRad(angleDeg - 90);
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  }

  /**
   * Build an SVG arc path descriptor.
   * angleDeg is measured clockwise from 12 o'clock.
   */
  function arcPath(cx, cy, r, startAngleDeg, endAngleDeg) {
    const start  = polarToCartesian(cx, cy, r, endAngleDeg);
    const end    = polarToCartesian(cx, cy, r, startAngleDeg);
    const sweep  = endAngleDeg - startAngleDeg;
    const largeArc = sweep > 180 ? 1 : 0;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
  }

  /**
   * Calculate arc length for a fraction of the full gauge arc.
   * Used to animate stroke-dasharray.
   */
  function arcLen(r, fractionOfFull) {
    const circumference = 2 * Math.PI * r;
    return (TOTAL_SWEEP / 360) * circumference * fractionOfFull;
  }

  function totalArcLen(r) {
    return (TOTAL_SWEEP / 360) * 2 * Math.PI * r;
  }

  // ── Tick mark positions for AQI 0, 100, 200, 300, 400, 500 ─────────────

  function tickPositions(cx, cy, r, innerR) {
    const ticks = [0, 100, 200, 300, 400, 500];
    return ticks.map(val => {
      const fraction = val / MAX_AQI;
      const angle = START_ANGLE + fraction * TOTAL_SWEEP;
      const outer = polarToCartesian(cx, cy, r + 4, angle);
      const inner = polarToCartesian(cx, cy, innerR - 2, angle);
      const label = polarToCartesian(cx, cy, r + 14, angle);
      return { val, outer, inner, label };
    });
  }

  // ── SVG builder ──────────────────────────────────────────────────────────

  function buildSVG(aqi, opts = {}) {
    const clampedAqi = Math.max(0, Math.min(MAX_AQI, aqi));
    const cat        = getCategory(clampedAqi);
    const size       = SIZES[opts.size || 'md'];
    const { r, cx, cy, viewBox, fontSize, labelSize, emojiSize, strokeW } = size;

    const fraction   = clampedAqi / MAX_AQI;
    const fillLen    = arcLen(r, fraction);
    const total      = totalArcLen(r);

    // Full track path
    const trackPath = arcPath(cx, cy, r, START_ANGLE, START_ANGLE + TOTAL_SWEEP);

    // Ticks
    const ticks = tickPositions(cx, cy, r, r - strokeW);
    const tickSVG = ticks.map(t => `
      <line
        x1="${t.inner.x}" y1="${t.inner.y}"
        x2="${t.outer.x}" y2="${t.outer.y}"
        stroke="${t.val === 0 || t.val === 500 ? 'transparent' : '#c8c4bc'}"
        stroke-width="1.5"
        stroke-linecap="round"
      />
      <text
        x="${t.label.x}" y="${t.label.y}"
        text-anchor="middle"
        dominant-baseline="central"
        font-size="${labelSize - 1}"
        font-family="DM Mono, monospace"
        fill="#b0aca6"
      >${t.val === 0 || t.val === 500 ? '' : t.val}</text>
    `).join('');

    // Centre text Y positions: stack emoji → AQI number → category label
    const emojiY   = cy - fontSize * 0.35;
    const aqiY     = cy + fontSize * 0.45;
    const labelY   = cy + fontSize * 1.1;

    return `
      <svg
        viewBox="${viewBox}"
        xmlns="http://www.w3.org/2000/svg"
        class="aqi-gauge-svg"
        role="img"
        aria-label="AQI ${clampedAqi} — ${cat.label}"
        style="overflow:visible;"
      >
        <!-- Track -->
        <path
          d="${trackPath}"
          fill="none"
          stroke="#e8e5e0"
          stroke-width="${strokeW}"
          stroke-linecap="round"
        />

        <!-- Coloured fill -->
        <path
          d="${trackPath}"
          fill="none"
          stroke="${cat.color}"
          stroke-width="${strokeW}"
          stroke-linecap="round"
          stroke-dasharray="${fillLen} ${total}"
          style="transition: stroke-dasharray 1.2s cubic-bezier(.4,0,.2,1), stroke 0.5s ease;"
        />

        <!-- Tick marks -->
        ${tickSVG}

        <!-- Centre: emoji -->
        <text
          x="${cx}" y="${emojiY}"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="${emojiSize}"
        >${cat.emoji}</text>

        <!-- Centre: AQI number -->
        <text
          x="${cx}" y="${aqiY}"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="${fontSize}"
          font-family="Playfair Display, Georgia, serif"
          font-weight="900"
          fill="${cat.color}"
          style="letter-spacing:-0.04em;"
        >${clampedAqi}</text>

        <!-- Centre: category label -->
        <text
          x="${cx}" y="${labelY}"
          text-anchor="middle"
          dominant-baseline="central"
          font-size="${labelSize}"
          font-family="DM Sans, system-ui, sans-serif"
          font-weight="600"
          fill="#9e9e9e"
          style="text-transform:uppercase;letter-spacing:0.05em;"
        >${cat.label}</text>
      </svg>`;
  }

  // ── Public API ───────────────────────────────────────────────────────────

  /**
   * Render a gauge into a container element.
   *
   * @param {string|HTMLElement} target  - CSS selector or DOM element
   * @param {object} opts
   *   .aqi       {number}   - AQI value (0–500)
   *   .size      {string}   - 'sm' | 'md' | 'lg' | 'xl'  (default: 'md')
   *   .showLabel {boolean}  - show city/station label below (default: false)
   *   .label     {string}   - text for showLabel
   *   .animate   {boolean}  - animate on first render (default: true)
   */
  function render(target, opts = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) { console.warn('[AqiGauge] target not found:', target); return; }

    const aqi  = opts.aqi  ?? 0;
    const size = opts.size ?? 'md';

    // Temporarily render at 0 then animate to real value
    const startAqi = opts.animate !== false ? 0 : aqi;

    el.innerHTML = `
      <div class="aqi-gauge-wrapper">
        ${buildSVG(startAqi, { size })}
        ${opts.showLabel && opts.label
          ? `<div style="font-size:.78rem;font-weight:600;color:var(--text-muted);margin-top:2px;text-align:center;">${opts.label}</div>`
          : ''}
      </div>`;

    // Animate to real value on next frame
    if (opts.animate !== false && startAqi !== aqi) {
      requestAnimationFrame(() => {
        setTimeout(() => update(target, aqi, { size }), 60);
      });
    }
  }

  /**
   * Update gauge value (animated).
   *
   * @param {string|HTMLElement} target
   * @param {number} newAqi
   * @param {object} opts - { size }
   */
  function update(target, newAqi, opts = {}) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;

    const wrapper = el.querySelector('.aqi-gauge-wrapper');
    if (!wrapper) { render(target, { aqi: newAqi, ...opts }); return; }

    const size = opts.size ?? 'md';
    const svg  = wrapper.querySelector('svg');
    if (svg) {
      // Replace entire SVG for simplicity (CSS transition handles animation)
      wrapper.querySelector('svg').outerHTML; // noop to keep reference
      const tmp = document.createElement('div');
      tmp.innerHTML = buildSVG(newAqi, { size });
      const newSvg = tmp.querySelector('svg');
      svg.replaceWith(newSvg);
    }
  }

  /**
   * Auto-mount all elements with class .aqi-gauge-mount and data-aqi attribute.
   * Call once after page load.
   *
   * <div class="aqi-gauge-mount" data-aqi="175" data-size="lg"></div>
   */
  function mountAll() {
    document.querySelectorAll('.aqi-gauge-mount').forEach(el => {
      const aqi  = parseInt(el.dataset.aqi  || '0',  10);
      const size = el.dataset.size || 'md';
      const label = el.dataset.label || '';
      render(el, { aqi, size, label, showLabel: !!label });
    });
  }

  /**
   * Build a standalone gauge HTML string (for injection into templates).
   *
   * @param {number} aqi
   * @param {string} size - 'sm' | 'md' | 'lg' | 'xl'
   * @returns {string} HTML string
   */
  function html(aqi, size = 'md') {
    return `<div class="aqi-gauge-wrapper">${buildSVG(aqi, { size })}</div>`;
  }

  /**
   * Mini inline gauge — just the coloured number, no SVG.
   * Useful for tables, list items, forecast hours.
   *
   * @param {number} aqi
   * @returns {string} HTML string
   */
  function miniHtml(aqi) {
    const cat = getCategory(aqi);
    return `
      <span style="
        font-family: var(--font-mono);
        font-weight: 700;
        font-size: 1rem;
        color: ${cat.color};
      ">${aqi}</span>
      <span style="
        font-size: 0.65rem;
        color: ${cat.color};
        font-weight: 600;
        opacity: .85;
        margin-left: 3px;
      ">${cat.label}</span>`;
  }

  /**
   * Render a horizontal mini gauge bar (used in zone cards and tables).
   *
   * @param {number} aqi
   * @param {number} maxAqi - scale max (default 300)
   * @returns {string} HTML string
   */
  function barHtml(aqi, maxAqi = 300) {
    const cat = getCategory(aqi);
    const pct = Math.min(100, Math.round((aqi / maxAqi) * 100));
    return `
      <div style="display:flex;align-items:center;gap:8px;">
        <div style="flex:1;height:6px;background:var(--border);border-radius:3px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:${cat.color};border-radius:3px;transition:width .6s ease;"></div>
        </div>
        <span style="font-family:var(--font-mono);font-size:.82rem;font-weight:600;color:${cat.color};min-width:30px;text-align:right;">${aqi}</span>
      </div>`;
  }

  /**
   * Return category info for any AQI value — useful for other components.
   */
  function categoryFor(aqi) {
    return getCategory(aqi);
  }

  // Auto-mount on DOMContentLoaded
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', mountAll);
  } else {
    // DOM already ready
    setTimeout(mountAll, 0);
  }

  return { render, update, mountAll, html, miniHtml, barHtml, categoryFor };

})();

// ── Example usage (remove in production) ─────────────────────────────────────
//
// Render a large gauge into #main-gauge:
//   AqiGauge.render('#main-gauge', { aqi: 175, size: 'lg', animate: true })
//
// Inline HTML (no DOM target needed):
//   el.innerHTML = AqiGauge.html(220, 'md')
//
// Mini coloured value for tables:
//   td.innerHTML = AqiGauge.miniHtml(175)
//
// Horizontal bar for zone cards:
//   el.innerHTML = AqiGauge.barHtml(175, 300)
//
// Auto-mount via HTML attributes:
//   <div class="aqi-gauge-mount" data-aqi="175" data-size="lg" data-label="Koramangala"></div>
//   AqiGauge.mountAll()   ← called automatically on DOMContentLoaded