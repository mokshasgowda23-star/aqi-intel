// frontend/pages/community.js
// Streaks, badges, city cleanliness score, daily check-in

App.registerLoader('community', loadCommunity);

async function loadCommunity(cityId) {
  const el = document.getElementById('communityContent');
  el.innerHTML = skeleton(300);

  const [profileData, cityScore] = await Promise.all([
    apiFetch(`/api/user/${App.sessionId}/${cityId}`),
    apiFetch(`/api/city/${cityId}/community`),
  ]);

  el.innerHTML = renderCommunityHTML(profileData, cityScore, cityId);
}

function renderCommunityHTML(profile, cityScore, cityId) {
  if (!profile) return '<p>Failed to load community data.</p>';

  const rank = profile.rank || {};
  const streak = profile.streak || 0;
  const badges = profile.badges || [];
  const allBadges = profile.all_badge_defs || [];
  const progress = profile.progress || [];
  const score = cityScore?.score || 60;
  const grade = cityScore?.grade || {};

  // Badge grid — earned + locked
  const earnedIds = new Set(badges.map(b => b.id));
  const badgeHTML = allBadges.map(b => {
    const earned = earnedIds.has(b.id);
    const prog = progress.find(p => p.id === b.id);

    return `
      <div class="badge-card ${earned ? 'earned' : ''}">
        ${earned ? '<div style="position:absolute;top:6px;right:6px;font-size:.6rem;color:#ffd700;font-weight:700;">EARNED</div>' : ''}
        <div class="badge-icon" style="filter:${earned ? 'none' : 'grayscale(1) opacity(.4)'};">${b.icon}</div>
        <div class="badge-name">${b.name}</div>
        <div class="badge-desc">${b.desc}</div>
        ${!earned && prog ? `
          <div class="progress-bar">
            <div class="progress-fill" style="width:${prog.percent}%;"></div>
          </div>
          <div style="font-size:.62rem;color:var(--text-muted);margin-top:3px;">${prog.current}/${prog.required}</div>` : ''}
        ${earned ? `<div style="font-size:.62rem;color:#ffd700;margin-top:3px;">✓ Unlocked</div>` : ''}
      </div>`;
  }).join('');

  return `
    <div class="grid-2" style="margin-bottom:16px;">
      <!-- Streak + Rank -->
      <div class="card" style="background:linear-gradient(135deg,#1a1a1a,#2d2d2d);color:#fff;">
        <div style="display:flex;align-items:flex-start;justify-content:space-between;">
          <div>
            <div style="font-size:.75rem;color:rgba(255,255,255,.5);text-transform:uppercase;letter-spacing:.06em;">Daily Streak</div>
            <div class="streak-display" style="margin-top:4px;">
              <div class="streak-number" style="color:var(--accent);">${streak}</div>
              <div class="streak-label" style="color:rgba(255,255,255,.6);">days</div>
            </div>
            <div style="font-size:.85rem;color:rgba(255,255,255,.7);margin-top:6px;">
              ${streak === 0 ? 'Check in today to start your streak! 🌱' :
                streak === 1 ? 'Day 1! Keep it going tomorrow.' :
                `${streak} days strong. Keep going! 🔥`}
            </div>
          </div>
          <div style="text-align:center;background:rgba(255,255,255,.08);border-radius:10px;padding:12px;">
            <div style="font-size:1.8rem;">${rank.icon}</div>
            <div style="font-size:.72rem;color:${rank.color || '#ffd700'};font-weight:700;margin-top:4px;">${rank.title}</div>
          </div>
        </div>

        <!-- Check-in button -->
        <div style="margin-top:16px;display:flex;gap:10px;flex-wrap:wrap;" id="checkinSection">
          <label style="display:flex;align-items:center;gap:6px;font-size:.8rem;color:rgba(255,255,255,.7);cursor:pointer;">
            <input type="checkbox" id="woreMask" style="accent-color:var(--accent);"> Wore a mask today
          </label>
          <label style="display:flex;align-items:center;gap:6px;font-size:.8rem;color:rgba(255,255,255,.7);cursor:pointer;">
            <input type="checkbox" id="stayedIndoors" style="accent-color:var(--accent);"> Stayed indoors on bad air day
          </label>
        </div>
        <button onclick="doCheckin()" style="
          margin-top:10px;width:100%;padding:10px;
          background:var(--accent);color:#fff;border:none;
          border-radius:8px;font-size:.9rem;font-weight:600;cursor:pointer;">
          ✅ Check In Today
        </button>
        <div id="checkinResult" style="margin-top:8px;font-size:.8rem;color:rgba(255,255,255,.6);"></div>
      </div>

      <!-- City Cleanliness Score -->
      <div class="card">
        <div class="card-title">🏙️ ${cityLabel(cityId)} Community Score</div>
        <div style="text-align:center;padding:10px 0;">
          <!-- Score gauge -->
          <div style="position:relative;display:inline-block;">
            <svg width="120" height="70" viewBox="0 0 120 70">
              <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none" stroke="#e8e5e0" stroke-width="8" stroke-linecap="round"/>
              <path d="M 10 60 A 50 50 0 0 1 110 60" fill="none"
                stroke="${grade.color || '#00b050'}" stroke-width="8" stroke-linecap="round"
                stroke-dasharray="${Math.round(score * 1.57)} 157"
                style="transition:stroke-dasharray 1s ease;"/>
              <text x="60" y="62" text-anchor="middle" style="font-size:20px;font-weight:900;font-family:Georgia,serif;fill:${grade.color || '#00b050'}">${score}</text>
            </svg>
          </div>
          <div style="margin-top:4px;">
            <span style="background:${grade.color || '#00b050'};color:#fff;padding:3px 12px;border-radius:4px;font-size:.8rem;font-weight:700;">${grade.letter} — ${grade.label}</span>
          </div>
        </div>
        <div style="font-size:.82rem;color:var(--text-muted);text-align:center;margin-top:8px;">${cityScore?.message || ''}</div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-top:12px;">
          <div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center;">
            <div style="font-family:var(--font-display);font-size:1.4rem;font-weight:900;color:var(--accent);">${(cityScore?.reporters_today || 0).toLocaleString()}</div>
            <div style="font-size:.7rem;color:var(--text-muted);">Reports Today</div>
          </div>
          <div style="padding:10px;background:var(--bg);border-radius:8px;text-align:center;">
            <div style="font-family:var(--font-display);font-size:1.4rem;font-weight:900;color:var(--accent);">${(cityScore?.masked_today || 0).toLocaleString()}</div>
            <div style="font-size:.7rem;color:var(--text-muted);">Masked Up Today</div>
          </div>
        </div>
        <div style="margin-top:10px;font-size:.72rem;color:var(--text-muted);text-align:center;">
          Trend: ${cityScore?.trend === 'improving' ? '📈 Improving' : cityScore?.trend === 'declining' ? '📉 Declining' : '→ Stable'}
        </div>
      </div>
    </div>

    <!-- Badges -->
    <div class="card">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
        <div class="card-title" style="margin:0;">🏅 Badges</div>
        <span style="font-size:.8rem;color:var(--text-muted);">${badges.length}/${allBadges.length} earned</span>
      </div>
      <div class="badge-grid">${badgeHTML}</div>
    </div>

    <!-- New badge popup -->
    <div id="newBadgePopup"></div>`;
}

async function doCheckin() {
  const woreMask = document.getElementById('woreMask')?.checked || false;
  const stayedIndoors = document.getElementById('stayedIndoors')?.checked || false;

  const res = await fetch('/api/checkin', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      session_id: App.sessionId,
      city_id: App.currentCity,
      wore_mask: woreMask,
      stayed_indoors: stayedIndoors,
    })
  });
  const data = await res.json();

  const resultEl = document.getElementById('checkinResult');

  if (data.status === 'already_checked_in') {
    resultEl.textContent = '✓ Already checked in today!';
    return;
  }

  resultEl.textContent = `🔥 Streak: ${data.streak} days! Check-ins: ${data.check_count}`;

  // Show new badge popup
  if (data.new_badges?.length) {
    showNewBadgePopup(data.new_badges[0]);
  }

  // Reload after a moment
  setTimeout(() => loadCommunity(App.currentCity), 1500);
}

function showNewBadgePopup(badge) {
  const popup = document.getElementById('newBadgePopup');
  popup.innerHTML = `
    <div style="
      position:fixed;bottom:30px;right:30px;
      background:#fff;border:2px solid #ffd700;
      border-radius:14px;padding:20px;max-width:260px;
      box-shadow:0 8px 30px rgba(0,0,0,.2);
      z-index:999;animation:slideIn .3s ease;
      text-align:center;">
      <div style="font-size:3rem;">${badge.icon}</div>
      <div style="font-weight:700;margin-top:8px;">🎉 Badge Unlocked!</div>
      <div style="font-size:.9rem;font-weight:600;color:#ffd700;margin-top:4px;">${badge.name}</div>
      <div style="font-size:.78rem;color:var(--text-muted);margin-top:4px;">${badge.desc}</div>
      <button onclick="document.getElementById('newBadgePopup').innerHTML=''"
        style="margin-top:10px;padding:6px 16px;background:#ffd700;border:none;border-radius:8px;cursor:pointer;font-weight:600;">
        Awesome!
      </button>
    </div>`;
  setTimeout(() => { if (popup) popup.innerHTML = ''; }, 5000);
}