// frontend/components/nav.js
// Global navigation, city switching, and app state management

const App = {
  currentCity: 'bengaluru',
  sessionId: null,
  pageLoaders: {},

  init() {
    this.sessionId = localStorage.getItem('aqi_session') || this._genSession();
    localStorage.setItem('aqi_session', this.sessionId);

    const citySelect = document.getElementById('citySelect');
    citySelect.value = this.currentCity;
    citySelect.addEventListener('change', (e) => {
      this.currentCity = e.target.value;
      this.reloadCurrentPage();
    });

    // Initial load
    navigateTo('dashboard');
    this._updateTimestamp();
    setInterval(() => this._updateTimestamp(), 60000);
  },

  _genSession() {
    return 'sess_' + Math.random().toString(36).slice(2, 11);
  },

  _updateTimestamp() {
    const el = document.getElementById('lastUpdated');
    if (el) el.textContent = 'Updated ' + new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
  },

  reloadCurrentPage() {
    const active = document.querySelector('.page.active');
    if (active) {
      const pageId = active.id.replace('page-', '');
      const loader = this.pageLoaders[pageId];
      if (loader) loader(this.currentCity);
    }
  },

  registerLoader(pageId, fn) {
    this.pageLoaders[pageId] = fn;
  }
};

function navigateTo(pageId) {
  // Hide all pages
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));

  // Show target
  const page = document.getElementById('page-' + pageId);
  if (page) page.classList.add('active');

  const navItem = document.querySelector(`[data-page="${pageId}"]`);
  if (navItem) navItem.classList.add('active');

  // Load page data
  const loader = App.pageLoaders[pageId];
  if (loader) loader(App.currentCity);
}

// ── Utility helpers shared across all page scripts ──

function aqiColor(aqi) {
  if (aqi <= 50)  return '#00b050';
  if (aqi <= 100) return '#7ab648';
  if (aqi <= 200) return '#e8a000';
  if (aqi <= 300) return '#e05a00';
  if (aqi <= 400) return '#cc0000';
  return '#660000';
}

function aqiCategory(aqi) {
  if (aqi <= 50)  return 'Good';
  if (aqi <= 100) return 'Satisfactory';
  if (aqi <= 200) return 'Moderate';
  if (aqi <= 300) return 'Poor';
  if (aqi <= 400) return 'Very Poor';
  return 'Severe';
}

function aqiEmoji(aqi) {
  if (aqi <= 50)  return '😊';
  if (aqi <= 100) return '🙂';
  if (aqi <= 200) return '😐';
  if (aqi <= 300) return '😷';
  if (aqi <= 400) return '🚨';
  return '☠️';
}

function aqiBg(aqi) {
  if (aqi <= 50)  return '#e8f8ee';
  if (aqi <= 100) return '#f2fae8';
  if (aqi <= 200) return '#fff9e0';
  if (aqi <= 300) return '#fff0e6';
  if (aqi <= 400) return '#ffe6e6';
  return '#ffd6d6';
}

async function apiFetch(path) {
  try {
    const res = await fetch(path);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('[apiFetch]', path, e);
    return null;
  }
}

function skeleton(h = 80) {
  return `<div class="skeleton" style="height:${h}px;border-radius:8px;"></div>`;
}

function cityLabel(cityId) {
  const map = {
    delhi: 'Delhi', mumbai: 'Mumbai', bengaluru: 'Bengaluru',
    kolkata: 'Kolkata', hyderabad: 'Hyderabad', chennai: 'Chennai',
    pune: 'Pune', ahmedabad: 'Ahmedabad'
  };
  return map[cityId] || cityId;
}

// Boot the app
document.addEventListener('DOMContentLoaded', () => App.init());