// ═══════════════════════════════════════════════════════════
// HEALTH PROFILE — personalised AQI intelligence
// Replace the entire HealthProfile const block in your app.js
// (from "const HealthProfile = {" to the closing "};")
// ═══════════════════════════════════════════════════════════

const HealthProfile = {
  _meta: null,                        // all conditions, categories, age groups
  _selectedConditions: new Set(),
  _selectedAgeGroup: "adult",
  _searchTimer: null,
  _lastReport: null,                  // cache last fetched report for re-renders

  // ── Load the full health profile page ──────────────────────────────────────
  async load(cityId) {
    const target = el("health-body");
    if (!target) return;
    target.innerHTML = '<div class="skel" style="height:300px;border-radius:12px"></div>';

    // Load meta + profile + personal report in parallel
    const [meta, profile, report] = await Promise.all([
      api("/api/health/conditions/meta"),
      api("/api/health/profile/" + App.session),
      api("/api/health/report/" + App.session + "/" + cityId),
    ]);

    this._meta = meta;
    this._lastReport = report;

    // Restore saved selections from server-side profile
    if (profile && profile.conditions && profile.conditions.length) {
      this._selectedConditions = new Set(profile.conditions);
      this._selectedAgeGroup   = profile.age_group || "adult";
    }

    target.innerHTML = "";
    this._renderPage(target, report, cityId);
  },

  // ── Main page renderer ──────────────────────────────────────────────────────
  _renderPage(container, report, cityId) {
    container.innerHTML = "";

    // ─ Top: personal verdict card ─
    const verdictCard = document.createElement("div");
    verdictCard.className = "card";
    verdictCard.style.marginBottom = "16px";
    verdictCard.id = "health-verdict-card";

    if (!report || !report.has_profile) {
      verdictCard.innerHTML = [
        '<div style="text-align:center;padding:20px 0">',
        '<div style="font-size:3rem;margin-bottom:12px">🏥</div>',
        '<div style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;margin-bottom:8px">Set Up Your Health Profile</div>',
        '<div style="font-size:.9rem;color:var(--text-muted);max-width:400px;margin:0 auto">',
        "Tell us about your health conditions and age group. We'll give you personalised AQI advice — not generic numbers.",
        '</div></div>'
      ].join("");
    } else {
      this._renderVerdictCard(verdictCard, report);
    }
    container.appendChild(verdictCard);

    // ─ Two-column layout: setup left, reports right ─
    const grid = document.createElement("div");
    grid.className = "g2";
    grid.style.gap = "16px";
    container.appendChild(grid);

    // LEFT: Profile setup card
    const setupCard = document.createElement("div");
    setupCard.className = "card";
    setupCard.style.alignSelf = "start";
    grid.appendChild(setupCard);
    this._renderSetupCard(setupCard, cityId);

    // RIGHT: Condition reports
    const reportCol = document.createElement("div");
    reportCol.id = "health-report-col";
    grid.appendChild(reportCol);

    if (report && report.has_profile) {
      this._renderConditionReports(reportCol, report);
    } else {
      reportCol.innerHTML = [
        '<div class="card" style="text-align:center;padding:30px;color:var(--text-muted)">',
        '<div style="font-size:2.5rem;margin-bottom:10px">👈</div>',
        '<div style="font-size:.9rem">Select your conditions and age group,<br>then tap <strong>Save Profile</strong>.</div>',
        '</div>'
      ].join("");
    }
  },

  // ── Verdict card (top summary) ──────────────────────────────────────────────
  _renderVerdictCard(card, report) {
    const rcolor = report.overall_risk_color || "#00b050";
    const rbg    = report.overall_risk === "good"     ? "#e8f8ee"
                 : report.overall_risk === "moderate" ? "#fff9e0"
                 : report.overall_risk === "poor"     ? "#fff0e6" : "#ffe6e6";

    card.style.background   = "linear-gradient(135deg," + rbg + ",#fff 65%)";
    card.style.borderColor  = rcolor + "40";

    const condNames = (report.conditions || [])
      .map(id => {
        const c = ((this._meta && this._meta.conditions) || []).find(x => x.id === id);
        return c ? c.icon + " " + c.name : id;
      }).join("  ·  ");

    card.innerHTML = [
      '<div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap">',
        '<div style="flex:1;min-width:200px">',
          '<div style="font-size:.72rem;color:var(--text-muted);text-transform:uppercase;letter-spacing:.05em;margin-bottom:4px">Personal AQI Assessment</div>',
          '<div style="font-family:var(--font-display);font-size:1.3rem;font-weight:700;line-height:1.35;margin-bottom:8px">' + (report.verdict || "") + '</div>',
          '<div style="font-size:.82rem;color:var(--text-muted);margin-bottom:10px">' + condNames + '</div>',
          '<div style="display:flex;gap:8px;flex-wrap:wrap">',
            '<span style="background:' + rcolor + ';color:#fff;padding:3px 10px;border-radius:4px;font-size:.75rem;font-weight:700">' + (report.overall_risk_label || "") + '</span>',
            '<span style="background:var(--bg);border:1px solid var(--border);color:var(--text-muted);padding:3px 10px;border-radius:4px;font-size:.75rem">Your safe limit: AQI ' + (report.personal_threshold || "—") + '</span>',
          '</div>',
        '</div>',
        '<div style="text-align:center;flex-shrink:0">',
          '<div style="font-family:var(--font-display);font-size:4rem;font-weight:900;color:' + rcolor + ';line-height:1">' + (report.aqi || "—") + '</div>',
          '<div style="font-size:.72rem;color:var(--text-muted)">Current AQI</div>',
          report.threshold_exceeded
            ? '<div style="font-size:.72rem;color:' + rcolor + ';font-weight:700;margin-top:4px">⚠️ Above your safe limit</div>'
            : '<div style="font-size:.72rem;color:var(--good);font-weight:700;margin-top:4px">✅ Within your safe limit</div>',
        '</div>',
      '</div>',
      // Age modifier note
      report.age_modifier
        ? '<div style="margin-top:12px;padding:8px 12px;background:rgba(0,0,0,.04);border-radius:8px;font-size:.78rem;color:var(--text-muted)">'
          + '<strong>' + (report.age_group ? report.age_group.charAt(0).toUpperCase() + report.age_group.slice(1) : "") + ' group:</strong> '
          + (report.age_modifier.note || "") + '</div>'
        : "",
      // General message banner
      report.general_message
        ? '<div style="margin-top:10px;padding:9px 14px;background:' + rcolor + '18;border-radius:8px;font-size:.82rem;color:var(--text)">'
          + report.general_message + '</div>'
        : "",
    ].join("");
  },

  // ── Setup card (left column) ────────────────────────────────────────────────
  _renderSetupCard(card, cityId) {
    card.innerHTML = "";

    // Title
    const title = document.createElement("div");
    title.className = "card-title";
    title.textContent = "🏥 Your Health Profile";
    card.appendChild(title);

    // ── Age group selector ──
    const ageLabel = document.createElement("div");
    ageLabel.style.cssText = "font-size:.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px";
    ageLabel.textContent = "Age Group";
    card.appendChild(ageLabel);

    const ageGrid = document.createElement("div");
    ageGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px";
    const ageGroups = (this._meta && this._meta.age_groups) || [
      { id: "infant", label: "Infant (0-2)", icon: "👶" },
      { id: "child",  label: "Child (3-12)", icon: "🧒" },
      { id: "teen",   label: "Teen (13-17)", icon: "🧑" },
      { id: "adult",  label: "Adult (18-59)", icon: "🧑‍💼" },
      { id: "senior", label: "Senior (60+)", icon: "👴" },
    ];
    ageGroups.forEach(ag => {
      const active = ag.id === this._selectedAgeGroup;
      const btn = document.createElement("button");
      btn.style.cssText = [
        "padding:5px 11px",
        "border-radius:16px",
        "border:1px solid " + (active ? "var(--accent)" : "var(--border)"),
        "background:" + (active ? "var(--accent)" : "var(--bg-card)"),
        "color:" + (active ? "#fff" : "var(--text-muted)"),
        "cursor:pointer",
        "font-size:.78rem",
        "transition:all .15s",
      ].join(";");
      btn.textContent = ag.icon + " " + ag.label;
      btn.addEventListener("click", () => {
        this._selectedAgeGroup = ag.id;
        this._renderSetupCard(card, cityId);   // re-render just the left card
      });
      ageGrid.appendChild(btn);
    });
    card.appendChild(ageGrid);

    // ── Condition search ──
    const searchLabel = document.createElement("div");
    searchLabel.style.cssText = "font-size:.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:8px";
    searchLabel.textContent = "Health Conditions";
    card.appendChild(searchLabel);

    const searchWrap = document.createElement("div");
    searchWrap.style.cssText = "position:relative;margin-bottom:10px";

    const searchInput = document.createElement("input");
    searchInput.id          = "health-search-input";
    searchInput.type        = "text";
    searchInput.placeholder = "Search: asthma, diabetes, elderly, runner…";
    searchInput.autocomplete = "off";
    searchInput.style.cssText = "width:100%;box-sizing:border-box;padding:9px 12px;border:1px solid var(--border);border-radius:8px;font-family:var(--font-body);font-size:.875rem;outline:none;transition:border-color .15s";
    searchInput.addEventListener("focus",  function() { this.style.borderColor = "var(--accent)"; });
    searchInput.addEventListener("blur",   function() { setTimeout(() => { this.style.borderColor = "var(--border)"; }, 150); });
    searchInput.addEventListener("input",  (e) => this._onSearchInput(e.target.value, card, cityId));
    searchWrap.appendChild(searchInput);

    const dropdown = document.createElement("div");
    dropdown.id = "health-search-results";
    dropdown.style.cssText = "display:none;position:absolute;top:calc(100% + 4px);left:0;right:0;background:#fff;border:1px solid var(--border);border-radius:10px;box-shadow:var(--shadow-md);z-index:200;overflow:hidden;max-height:240px;overflow-y:auto";
    searchWrap.appendChild(dropdown);
    card.appendChild(searchWrap);

    // ── Selected conditions chips ──
    const chipsWrap = document.createElement("div");
    chipsWrap.id = "health-chips";
    chipsWrap.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:14px;min-height:28px";
    card.appendChild(chipsWrap);
    this._renderChips(chipsWrap);   // pass element directly — no el() lookup needed

    // ── Browse by category ──
    const browseLabel = document.createElement("div");
    browseLabel.style.cssText = "font-size:.72rem;color:var(--text-muted);margin-bottom:8px";
    browseLabel.textContent = "Or browse by category:";
    card.appendChild(browseLabel);

    const catGrid = document.createElement("div");
    catGrid.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;margin-bottom:18px";
    const cats = (this._meta && this._meta.categories) || [];
    cats.forEach(cat => {
      const btn = document.createElement("button");
      btn.style.cssText = "padding:4px 10px;border-radius:14px;border:1px solid var(--border);background:var(--bg);font-size:.72rem;cursor:pointer;transition:all .15s;color:var(--text-muted)";
      btn.textContent = cat.icon + " " + cat.label;
      btn.addEventListener("mouseover", function() { this.style.background = "var(--accent-light)"; });
      btn.addEventListener("mouseout",  function() { this.style.background = "var(--bg)"; });
      btn.addEventListener("click",     () => this._browseCategory(cat.label, dropdown));
      catGrid.appendChild(btn);
    });
    card.appendChild(catGrid);

    // ── Save button ──
    const saveBtn = document.createElement("button");
    saveBtn.id = "health-save-btn";
    saveBtn.style.cssText = "width:100%;padding:11px;background:var(--accent);color:#fff;border:none;border-radius:8px;font-size:.9rem;font-weight:700;cursor:pointer;transition:background .15s";
    saveBtn.textContent = "💾 Save Profile & Get My Report";
    saveBtn.addEventListener("click", () => this._saveAndReload(cityId));
    card.appendChild(saveBtn);

    const note = document.createElement("div");
    note.style.cssText = "margin-top:10px;font-size:.72rem;color:var(--text-muted);text-align:center";
    note.textContent = "Saved in your browser session. No account needed.";
    card.appendChild(note);
  },

  // ── Search input handler ────────────────────────────────────────────────────
  _onSearchInput(val, card, cityId) {
    clearTimeout(this._searchTimer);
    const dropdown = el("health-search-results");
    if (!dropdown) return;
    if (!val || val.length < 2) { dropdown.style.display = "none"; return; }
    this._searchTimer = setTimeout(async () => {
      const results = await api("/api/health/conditions/search?q=" + encodeURIComponent(val));
      this._renderSearchDropdown(dropdown, results || [], card, cityId);
    }, 200);
  },

  _renderSearchDropdown(dropdown, results, card, cityId) {
    dropdown.innerHTML = "";
    if (!results.length) {
      dropdown.innerHTML = '<div style="padding:12px;font-size:.85rem;color:var(--text-muted);text-align:center">No conditions found. Try: asthma, diabetes, heart disease…</div>';
      dropdown.style.display = "block";
      return;
    }
    results.forEach(r => {
      const already = this._selectedConditions.has(r.id);
      const item = document.createElement("div");
      item.style.cssText = "padding:10px 14px;cursor:pointer;border-bottom:1px solid var(--border);display:flex;align-items:center;gap:10px;transition:background .1s";
      item.innerHTML = [
        '<span style="font-size:1.2rem">' + r.icon + '</span>',
        '<div style="flex:1">',
          '<div style="font-size:.875rem;font-weight:600">' + r.name + '</div>',
          '<div style="font-size:.72rem;color:var(--text-muted)">' + r.category + '</div>',
        '</div>',
        already ? '<span style="color:var(--good);font-size:.8rem;font-weight:700">✓ Added</span>' : '<span style="font-size:.8rem;color:var(--accent)">+ Add</span>',
      ].join("");
      item.addEventListener("mouseover", function() { this.style.background = "var(--accent-light,#eef2ff)"; });
      item.addEventListener("mouseout",  function() { this.style.background = ""; });
      item.addEventListener("click", () => {
        this._toggleCondition(r.id);
        dropdown.style.display = "none";
        const inp = el("health-search-input");
        if (inp) inp.value = "";
        // Re-render chips using the stored element reference
        const chips = el("health-chips");
        if (chips) this._renderChips(chips);
      });
      dropdown.appendChild(item);
    });
    dropdown.style.display = "block";
  },

  _browseCategory(categoryLabel, dropdown) {
    const all      = (this._meta && this._meta.conditions) || [];
    const filtered = all.filter(c => c.category === categoryLabel);
    this._renderSearchDropdown(dropdown, filtered, null, null);
    dropdown.style.display = "block";
  },

  _toggleCondition(condId) {
    if (this._selectedConditions.has(condId)) {
      this._selectedConditions.delete(condId);
    } else {
      this._selectedConditions.add(condId);
    }
  },

  // ── Chips: accepts element directly (no el() lookup) ──────────────────────
  _renderChips(container) {
    if (!container) return;
    container.innerHTML = "";
    if (this._selectedConditions.size === 0) {
      container.innerHTML = '<span style="font-size:.78rem;color:var(--text-muted)">No conditions selected yet.</span>';
      return;
    }
    const allConds = (this._meta && this._meta.conditions) || [];
    this._selectedConditions.forEach(id => {
      const cond = allConds.find(c => c.id === id) || { name: id, icon: "🏥", color: "#9e9e9e" };
      const chip = document.createElement("div");
      chip.style.cssText = [
        "display:inline-flex",
        "align-items:center",
        "gap:5px",
        "padding:4px 10px",
        "border-radius:16px",
        "border:1px solid " + cond.color + "60",
        "background:" + cond.color + "18",
        "font-size:.78rem",
        "font-weight:600",
        "color:var(--text)",
      ].join(";");
      const label = document.createElement("span");
      label.textContent = cond.icon + " " + cond.name;
      const removeBtn = document.createElement("button");
      removeBtn.style.cssText = "background:none;border:none;cursor:pointer;color:var(--text-muted);font-size:.9rem;padding:0 0 0 3px;line-height:1";
      removeBtn.textContent = "✕";
      removeBtn.addEventListener("click", (e) => {
        e.stopPropagation();
        this._toggleCondition(id);
        this._renderChips(container);   // re-render chips in same container
      });
      chip.appendChild(label);
      chip.appendChild(removeBtn);
      container.appendChild(chip);
    });
  },

  // ── Save profile and reload ─────────────────────────────────────────────────
  async _saveAndReload(cityId) {
    const btn = el("health-save-btn");
    if (btn) { btn.textContent = "Saving…"; btn.disabled = true; }

    try {
      const res = await fetch("/api/health/profile", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          session_id: App.session,
          age_group:  this._selectedAgeGroup,
          conditions: Array.from(this._selectedConditions),
        }),
      });
      if (!res.ok) throw new Error("Save failed: " + res.status);
    } catch (err) {
      console.error("[HealthProfile] save error", err);
      if (btn) { btn.textContent = "❌ Save failed — retry"; btn.disabled = false; }
      return;
    }

    if (btn) { btn.textContent = "✅ Saved!"; btn.style.background = "var(--good,#00b050)"; }

    // Reload the full page after short delay so user sees the confirmation
    setTimeout(() => this.load(cityId), 700);
  },

  // ── Condition report cards (right column) ──────────────────────────────────
  _renderConditionReports(container, report) {
    container.innerHTML = "";

    if (!report.condition_reports || !report.condition_reports.length) {
      container.innerHTML = [
        '<div class="card" style="text-align:center;padding:30px;color:var(--text-muted)">',
        '<div style="font-size:2rem;margin-bottom:10px">🔍</div>',
        '<div>Add health conditions in the panel on the left, then save your profile.</div>',
        '</div>'
      ].join("");
      return;
    }

    report.condition_reports.forEach(cr => {
      const card = document.createElement("div");
      card.className = "card";
      card.style.cssText = "margin-bottom:14px;border-left:4px solid " + cr.risk_color;

      // ── Header ──
      const header = document.createElement("div");
      header.style.cssText = "display:flex;align-items:center;gap:10px;margin-bottom:12px";
      header.innerHTML = [
        '<span style="font-size:1.6rem">' + cr.icon + '</span>',
        '<div style="flex:1">',
          '<div style="font-weight:700;font-size:.95rem">' + cr.name + '</div>',
          '<div style="font-size:.72rem;color:var(--text-muted)">' + cr.category + '</div>',
        '</div>',
        '<span style="padding:4px 10px;border-radius:6px;background:' + cr.risk_color + ';color:#fff;font-size:.72rem;font-weight:700">' + cr.risk_label + '</span>',
      ].join("");
      card.appendChild(header);

      // ── "How today's AQI affects this condition" ──
      const howBox = document.createElement("div");
      howBox.style.cssText = "padding:9px 12px;background:var(--bg);border-radius:8px;font-size:.82rem;color:var(--text-muted);margin-bottom:12px;line-height:1.5";
      howBox.innerHTML = "<strong>How today's air affects you:</strong> " + cr.how_aqi_affects;
      card.appendChild(howBox);

      // ── AQI threshold bar ──
      const currentAqi = this._getAqi(report);
      const pct        = Math.min(100, Math.round((currentAqi / 500) * 100));
      const safePct    = Math.round((cr.safe_aqi / 500) * 100);
      const thrWrap    = document.createElement("div");
      thrWrap.style.marginBottom = "16px";
      thrWrap.innerHTML = [
        '<div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-bottom:6px">',
          '<span>AQI 0</span>',
          '<span style="color:' + cr.risk_color + ';font-weight:700">Your safe limit: ' + cr.safe_aqi + '</span>',
          '<span>500</span>',
        '</div>',
        '<div style="position:relative;height:10px;background:linear-gradient(to right,#00b050 0%,#7ab648 10%,#e8a000 40%,#e05a00 60%,#cc0000 80%,#660000 100%);border-radius:5px">',
          // Current AQI dot
          '<div title="Current AQI: ' + currentAqi + '" style="position:absolute;top:50%;left:' + pct + '%;transform:translate(-50%,-50%);width:16px;height:16px;background:#fff;border:2px solid #333;border-radius:50%;box-shadow:0 1px 4px rgba(0,0,0,.25)"></div>',
          // Safe limit tick
          '<div style="position:absolute;top:12px;left:' + safePct + '%;transform:translateX(-50%);font-size:.6rem;color:' + cr.risk_color + ';white-space:nowrap;font-weight:700">Safe limit</div>',
        '</div>',
        '<div style="display:flex;justify-content:space-between;font-size:.7rem;color:var(--text-muted);margin-top:20px">',
          '<span>Current AQI: <strong style="color:' + cr.risk_color + '">' + currentAqi + '</strong></span>',
          cr.threshold_exceeded
            ? '<span style="color:' + cr.risk_color + ';font-weight:700">⚠️ ' + (currentAqi - cr.safe_aqi) + ' above your safe limit</span>'
            : '<span style="color:var(--good);font-weight:700">✅ Within safe range</span>',
        '</div>',
      ].join("");
      card.appendChild(thrWrap);

      // ── Today's Precautions ──
      if (cr.precautions && cr.precautions.length) {
        const precDiv = document.createElement("div");
        precDiv.style.marginBottom = "12px";
        precDiv.innerHTML = '<div style="font-size:.72rem;font-weight:700;text-transform:uppercase;color:var(--text-muted);letter-spacing:.04em;margin-bottom:6px">Today\'s Precautions</div>';
        cr.precautions.forEach(p => {
          const row = document.createElement("div");
          row.style.cssText = "font-size:.83rem;padding:6px 0;border-bottom:1px solid var(--border);line-height:1.5";
          row.textContent = p;
          precDiv.appendChild(row);
        });
        card.appendChild(precDiv);
      }

      // ── Medication reminders ──
      if (cr.medications && cr.medications.length) {
        const medDiv = document.createElement("div");
        medDiv.style.cssText = "padding:10px 12px;background:#e8f5e9;border-radius:8px;margin-bottom:10px";
        medDiv.innerHTML = '<div style="font-size:.72rem;font-weight:700;color:#2e7d32;margin-bottom:5px">💊 Medication Reminders</div>';
        cr.medications.forEach(m => {
          const row = document.createElement("div");
          row.style.cssText = "font-size:.8rem;color:#1b5e20;padding:2px 0;line-height:1.4";
          row.textContent = "• " + m;
          medDiv.appendChild(row);
        });
        card.appendChild(medDiv);
      }

      // ── Things to Avoid ──
      if (cr.avoid && cr.avoid.length) {
        const avoidDiv = document.createElement("div");
        avoidDiv.style.cssText = "padding:10px 12px;background:#fff3e0;border-radius:8px;margin-bottom:10px";
        avoidDiv.innerHTML = '<div style="font-size:.72rem;font-weight:700;color:#e65100;margin-bottom:5px">🚫 Avoid Today</div>';
        cr.avoid.forEach(a => {
          const row = document.createElement("div");
          row.style.cssText = "font-size:.8rem;color:#bf360c;padding:2px 0;line-height:1.4";
          row.textContent = "• " + a;
          avoidDiv.appendChild(row);
        });
        card.appendChild(avoidDiv);
      }

      // ── Indoor Tips ──
      if (cr.indoor_tips && cr.indoor_tips.length) {
        const tipDiv = document.createElement("div");
        tipDiv.style.cssText = "padding:10px 12px;background:#e3f2fd;border-radius:8px;margin-bottom:10px";
        tipDiv.innerHTML = '<div style="font-size:.72rem;font-weight:700;color:#1565c0;margin-bottom:5px">🏠 Indoor Tips</div>';
        cr.indoor_tips.forEach(t => {
          const row = document.createElement("div");
          row.style.cssText = "font-size:.8rem;color:#0d47a1;padding:2px 0;line-height:1.4";
          row.textContent = "• " + t;
          tipDiv.appendChild(row);
        });
        card.appendChild(tipDiv);
      }

      // ── Emergency Signs ──
      if (cr.emergency_signs && cr.emergency_signs.length) {
        const emDiv = document.createElement("div");
        emDiv.style.cssText = "padding:10px 12px;background:#ffebee;border-radius:8px;border-left:3px solid #c62828";
        emDiv.innerHTML = '<div style="font-size:.72rem;font-weight:700;color:#c62828;margin-bottom:5px">🚨 Seek Medical Help If</div>';
        cr.emergency_signs.forEach(s => {
          const row = document.createElement("div");
          row.style.cssText = "font-size:.8rem;color:#b71c1c;padding:2px 0;line-height:1.4";
          row.textContent = "• " + s;
          emDiv.appendChild(row);
        });
        card.appendChild(emDiv);
      }

      container.appendChild(card);
    });

    // ── Disclaimer ──
    const disc = document.createElement("div");
    disc.style.cssText = "font-size:.72rem;color:var(--text-muted);text-align:center;padding:10px;border-top:1px solid var(--border);margin-top:6px";
    disc.textContent = "ℹ️ This is general health information, not medical advice. Always follow your doctor's guidance.";
    container.appendChild(disc);
  },

  _getAqi(report) {
    return (report && report.aqi) ? report.aqi : 100;
  },
};

// ── Close health search dropdown on outside click ──────────────────────────
document.addEventListener("click", (e) => {
  const d   = el("health-search-results");
  const inp = el("health-search-input");
  if (d && inp && !inp.contains(e.target) && !d.contains(e.target)) {
    d.style.display = "none";
  }
});