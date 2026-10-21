import { COMPONENTS } from '../data/components.js';

/** DOM bindings: mission list, crew, timeline, transport, telemetry, inspector. */

const $ = (s) => document.querySelector(s);
const PHASE_COLORS = ['#5ce1e6', '#7c8cff', '#a78bfa', '#f472b6', '#ffb547', '#4ade80'];
const ICONS = { irosa: '☀', battery: '⚡', nauka: '☄', orbit: '◎' };

export function fmtHMS(sec, withHours = true) {
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
  const p = (n) => String(n).padStart(2, '0');
  return withHours ? `${p(h)}:${p(m)}:${p(x)}` : `${h}:${p(m)}`;
}
const fmtMS = (sec) => { const s = Math.max(0, Math.round(sec)); return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };

export class UI {
  constructor(handlers) {
    this.h = handlers;
    this.duration = 1;
    this.phaseEls = [];
    this.lastPhase = -1;
    this.scrubbing = false;
    this._bind();
  }

  _bind() {
    const h = this.h;
    $('#play').addEventListener('click', () => h.onTogglePlay());
    const scrub = $('#scrub');
    scrub.addEventListener('input', () => { this.scrubbing = true; h.onSeek((scrub.value / 1000) * this.duration); });
    scrub.addEventListener('change', () => { this.scrubbing = false; });
    $('#speeds').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-speed]');
      if (b) h.onSpeed(+b.dataset.speed);
    });
    $('#views').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-view]');
      if (b && !b.disabled) h.onView(b.dataset.view);
    });
    document.querySelectorAll('[data-toggle]').forEach((b) => b.addEventListener('click', () => h.onToggle(b.dataset.toggle)));
    $('#btn-help').addEventListener('click', () => this.toggleHelp(true));
    $('#help-close').addEventListener('click', () => this.toggleHelp(false));
    $('#help').addEventListener('click', (e) => { if (e.target.id === 'help') this.toggleHelp(false); });
    $('#btn-full').addEventListener('click', () => this.toggleFullscreen());
    $('#insp-close').addEventListener('click', () => h.onSelect(null));
    $('#insp-focus').addEventListener('click', () => h.onFocusSelected());
    $('#btn-left').addEventListener('click', () => this.togglePanel('left'));
    $('#btn-right').addEventListener('click', () => this.togglePanel('right'));
  }

  togglePanel(which, force) {
    const el = $(`#${which}`);
    const open = force ?? !el.classList.contains('open');
    el.classList.toggle('open', open);
    if (open) $(`#${which === 'left' ? 'right' : 'left'}`).classList.remove('open');
  }

  toggleHelp(show) { $('#help').hidden = !(show ?? $('#help').hidden); }

  toggleFullscreen() {
    if (!document.fullscreenElement) document.documentElement.requestFullscreen?.();
    else document.exitFullscreen?.();
  }

  setMissions(missions, activeId) {
    const box = $('#missions');
    box.innerHTML = '';
    for (const m of missions) {
      const b = document.createElement('button');
      b.className = `mission${m.id === activeId ? ' active' : ''}`;
      b.innerHTML = `<span class="m-ico">${ICONS[m.id] || '•'}</span><span class="m-title">${m.title}</span><span class="m-sub">${m.subtitle}</span>`;
      b.addEventListener('click', () => this.h.onMission(m.id));
      box.appendChild(b);
    }
  }

  setMission(mission, player) {
    this.duration = player.duration || 1;
    $('#mission-sub').textContent = `${mission.title} — ${mission.subtitle}`;
    $('#inspiration').textContent = mission.inspiration;
    $('#t-end').textContent = fmtMS(this.duration / 60);
    document.querySelectorAll('.mission').forEach((el, i) => el.classList.toggle('active', this.h.missions[i].id === mission.id));

    // Crew
    const crew = $('#crew');
    crew.innerHTML = '';
    $('#crew-section').hidden = !mission.crew.length;
    for (const c of mission.crew) {
      const d = document.createElement('div');
      d.className = 'crew-card';
      d.innerHTML = `<span class="suit-chip ${c.stripes}"></span><div><div class="c-role">${c.role} · ${c.suit === 'emu' ? 'EMU' : 'Orlan-MKS'}</div><div class="c-note">${c.note}</div></div><span class="c-status" data-crew="${c.id}">inside</span>`;
      d.addEventListener('click', () => this.h.onView(c.id));
      crew.appendChild(d);
    }

    // Phases
    const list = $('#phases');
    list.innerHTML = '';
    this.phaseEls = player.phases.map((p) => {
      const li = document.createElement('li');
      li.className = 'phase';
      li.innerHTML = `<div><span class="p-time">${fmtMS(p.t / 60)}</span><span class="p-title">${p.title}</span></div><div class="p-detail">${p.detail}</div>`;
      li.addEventListener('click', () => this.h.onSeek(p.t + 1));
      list.appendChild(li);
      return li;
    });
    this.lastPhase = -1;

    // Timeline segments
    const seg = $('#segments');
    seg.innerHTML = '';
    player.phases.forEach((p, i) => {
      const next = player.phases[i + 1]?.t ?? this.duration;
      const el = document.createElement('i');
      el.style.width = `${((next - p.t) / this.duration) * 100}%`;
      el.style.background = PHASE_COLORS[i % PHASE_COLORS.length] + '33';
      el.title = p.title;
      seg.appendChild(el);
    });

    // Views available for this mission
    document.querySelectorAll('#views button').forEach((b) => {
      const v = b.dataset.view;
      b.disabled = !mission.crew.length && ['ev1', 'ev2', 'helmet'].includes(v);
    });
    this.renderSuits(mission);
  }

  renderSuits(mission) {
    const box = $('#suits');
    $('#suits-section').hidden = !mission.crew.length;
    box.innerHTML = mission.crew.map((c) => `
      <div class="suit" data-suit="${c.id}">
        <div class="suit-head"><span class="suit-chip ${c.stripes}"></span>${c.role} · ${c.suit === 'emu' ? 'EMU' : 'Orlan'}<span class="hr" data-k="hr">— bpm</span></div>
        ${['O₂', 'Battery', 'CO₂', 'Pressure'].map((k, i) => `<div class="meter"><span>${k}</span><span class="bar"><i data-k="b${i}"></i></span><span class="val" data-k="v${i}">—</span></div>`).join('')}
      </div>`).join('');
  }

  setPlaying(p) { $('#play').classList.toggle('playing', p); }

  setSpeed(s) {
    document.querySelectorAll('#speeds button').forEach((b) => b.classList.toggle('active', +b.dataset.speed === s));
  }

  setView(v) { document.querySelectorAll('#views button').forEach((b) => b.classList.toggle('active', b.dataset.view === v)); }

  setToggle(name, on) { document.querySelector(`[data-toggle="${name}"]`)?.classList.toggle('active', on); }

  setTime(t, player) {
    if (!this.scrubbing) $('#scrub').value = Math.round((t / this.duration) * 1000);
    $('#fill').style.width = `${(t / this.duration) * 100}%`;
    $('#t-now').textContent = fmtMS(t / 60);
    $('#pet').textContent = fmtHMS(t);
    const idx = player.phaseIndex(t);
    if (idx !== this.lastPhase) {
      this.phaseEls.forEach((el, i) => {
        el.classList.toggle('current', i === idx);
        el.classList.toggle('done', i < idx);
      });
      const ph = player.phases[idx];
      if (ph) {
        $('#phase-now').textContent = ph.title;
        if (this.lastPhase !== -1) this.toast(ph.title, ph.detail);
        this.phaseEls[idx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
      this.lastPhase = idx;
    }
  }

  toast(title, detail) {
    const el = $('#toast');
    el.innerHTML = `<b>${title}</b>${detail.split('. ')[0]}.`;
    el.classList.add('show');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => el.classList.remove('show'), 4200);
  }

  setOrbit(s, orbit, arrays) {
    $('#utc').textContent = s.date.toISOString().slice(0, 19).replace('T', ' ');
    const dn = $('#daynight');
    dn.classList.toggle('night', s.inShadow);
    $('#dn-text').textContent = s.inShadow ? 'Night · sunrise in' : 'Day · sunset in';
    $('#dn-count').textContent = s.next ? fmtMS(s.next.in) : '∞';
    $('#t-alt').textContent = `${orbit.altitude.toFixed(0)} km`;
    $('#t-vel').textContent = `${orbit.speed.toFixed(2)} km/s`;
    $('#t-latlon').textContent = `${s.lat.toFixed(1)}° ${s.lon.toFixed(1)}°`;
    $('#t-orbit').textContent = `#${s.orbitNumber} · ${(orbit.period / 60).toFixed(1)} min`;
    $('#t-beta').textContent = `${s.betaDeg.toFixed(1)}°`;
    $('#t-sunel').textContent = `${s.sunElevation.toFixed(1)}°`;
    $('#t-alpha').textContent = `${arrays.alphaDeg.toFixed(0)}°${arrays.parked ? ' · locked' : ''}`;
    $('#t-bga').textContent = `${arrays.betaDeg.toFixed(0)}°`;
  }

  setCrewStatus(id, outside) {
    const el = document.querySelector(`[data-crew="${id}"]`);
    if (el) { el.textContent = outside ? 'EVA' : 'inside'; el.classList.toggle('out', outside); }
  }

  setSuit(id, d) {
    const box = document.querySelector(`[data-suit="${id}"]`);
    if (!box) return;
    const set = (k, v) => { const e = box.querySelector(`[data-k="${k}"]`); if (e) e.textContent = v; };
    const bar = (k, f) => { const e = box.querySelector(`[data-k="${k}"]`); if (e) e.style.width = `${Math.max(0, Math.min(1, f)) * 100}%`; };
    set('hr', `${Math.round(d.hr)} bpm`);
    bar('b0', d.o2 / 100); set('v0', `${d.o2.toFixed(0)}%`);
    bar('b1', d.batt / 100); set('v1', `${d.batt.toFixed(0)}%`);
    bar('b2', d.co2 / 8); set('v2', `${d.co2.toFixed(1)}`);
    bar('b3', d.p / 6); set('v3', `${d.p.toFixed(2)} psi`);
  }

  showInspector(cid) {
    const box = $('#inspector');
    if (!cid || !COMPONENTS[cid]) { box.hidden = true; return; }
    const c = COMPONENTS[cid];
    $('#insp-name').textContent = c.name;
    $('#insp-agency').textContent = c.agency;
    $('#insp-kv').innerHTML = `<dt>Launched</dt><dd>${c.launched}</dd><dt>Dimensions</dt><dd>${c.dims}</dd><dt>Mass</dt><dd>${c.mass}</dd>`;
    $('#insp-info').textContent = c.info;
    box.hidden = false;
    $('#right').scrollTop = 0;
    if (window.innerWidth <= 1000) this.togglePanel('right', true);
  }

  tooltip(text, x, y) {
    const el = $('#tooltip');
    if (!text) { el.classList.remove('show'); return; }
    el.textContent = text;
    el.style.left = `${x + 14}px`;
    el.style.top = `${y + 14}px`;
    el.classList.add('show');
  }

  doneLoading() { $('#loader').classList.add('done'); }
}

/** Equirectangular ground-track map with day/night shading. */
export class GroundTrack {
  constructor(canvas) {
    this.c = canvas;
    this.g = canvas.getContext('2d');
    this.img = null;
    this.shade = document.createElement('canvas');
    this.shade.width = 128;
    this.shade.height = 64;
    this.lastShade = -1;
  }

  setImage(img) { this.img = img; }

  draw(orbit, s, sunEci, gmstRad) {
    const { g, c } = this;
    const W = c.width, H = c.height;
    const t0 = s.t, lat0 = s.lat, lon0 = s.lon; // orbit.state() reuses one object
    g.clearRect(0, 0, W, H);
    if (this.img) g.drawImage(this.img, 0, 0, W, H);
    else { g.fillStyle = '#0c1a33'; g.fillRect(0, 0, W, H); }

    // Night shading (recomputed every ~2 s of sim time)
    const key = Math.round(t0 / 120);
    if (key !== this.lastShade) {
      this.lastShade = key;
      const sg = this.shade.getContext('2d');
      const img = sg.createImageData(128, 64);
      const cg = Math.cos(gmstRad), sn = Math.sin(gmstRad);
      const sx = sunEci.x * cg + sunEci.y * sn, sy = -sunEci.x * sn + sunEci.y * cg, sz = sunEci.z;
      for (let j = 0; j < 64; j++) {
        const lat = (0.5 - (j + 0.5) / 64) * Math.PI;
        for (let i = 0; i < 128; i++) {
          const lon = ((i + 0.5) / 128 - 0.5) * 2 * Math.PI;
          const d = Math.cos(lat) * Math.cos(lon) * sx + Math.cos(lat) * Math.sin(lon) * sy + Math.sin(lat) * sz;
          const a = d < -0.08 ? 150 : d < 0.08 ? 150 * (0.08 - d) / 0.16 : 0;
          const k = (j * 128 + i) * 4;
          img.data[k] = 2; img.data[k + 1] = 6; img.data[k + 2] = 20; img.data[k + 3] = a;
        }
      }
      sg.putImageData(img, 0, 0);
    }
    g.imageSmoothingEnabled = true;
    g.drawImage(this.shade, 0, 0, W, H);

    // Ground track: ±1 orbit
    const toXY = (lat, lon) => [((lon + 180) / 360) * W, ((90 - lat) / 180) * H];
    g.lineWidth = 2;
    const T = orbit.period;
    for (const [from, to, col] of [[-T, 0, 'rgba(92,225,230,0.35)'], [0, T, 'rgba(255,255,255,0.75)']]) {
      g.strokeStyle = col;
      g.setLineDash(from < 0 ? [] : [6, 5]);
      g.beginPath();
      let prev = null;
      for (let k = 0; k <= 120; k++) {
        const st = orbit.state(t0 + from + ((to - from) * k) / 120);
        const [x, y] = toXY(st.lat, st.lon);
        if (prev && Math.abs(x - prev[0]) > W / 2) g.moveTo(x, y);
        else if (k === 0) g.moveTo(x, y);
        else g.lineTo(x, y);
        prev = [x, y];
      }
      g.stroke();
    }
    g.setLineDash([]);
    orbit.state(t0); // restore the shared state object
    const [x, y] = toXY(lat0, lon0);
    g.fillStyle = '#5ce1e6';
    g.beginPath(); g.arc(x, y, 6, 0, Math.PI * 2); g.fill();
    g.strokeStyle = 'rgba(92,225,230,0.35)';
    g.lineWidth = 6;
    g.beginPath(); g.arc(x, y, 11, 0, Math.PI * 2); g.stroke();
  }
}
