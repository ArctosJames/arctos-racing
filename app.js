'use strict';
/* Arctos Racing workshop: parts, service life, checklists, run log.
   Data lives in this browser (localStorage) and can sync to a JSON file in a GitHub repo. */

const KEY = 'arctos-racing-data-v1', SYNC_KEY = 'arctos-racing-sync-v1';
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const uid = () => Math.random().toString(36).slice(2, 10) + Date.now().toString(36).slice(-4);
const today = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const fmtDate = s => s ? new Date(s + 'T12:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '';

const CATS = { CHS: 'Chassis', ENG: 'Engine', DRV: 'Drivetrain', SUS: 'Suspension and steering', BRK: 'Brakes', WHL: 'Wheels and tyres', AER: 'Aero and bodywork', ELE: 'Electrical and data', FUE: 'Fuel system', COO: 'Cooling', SAF: 'Safety', FAS: 'Fasteners and hardware', CON: 'Fluids and consumables' };
const SOURCES = { standard: 'Off the shelf', manufacturer: 'Manufacturer specific', custom: 'Team made' };
const UNIT_SHORT = { hours: 'h', sessions: 'sessions', months: 'months' };
const ROUTES = [['overview', 'Overview'], ['life', 'Service life'], ['parts', 'Parts'], ['checks', 'Session checks'], ['packing', 'Packing'], ['log', 'Run log'], ['settings', 'Settings']];

/* ---------- sample data ---------- */
function parseList(text, old) {
  const ids = new Map(); old?.sections.forEach(s => s.items.forEach(i => ids.set(i.text, i.id)));
  const sections = []; let cur = null;
  text.split('\n').map(l => l.trim()).filter(Boolean).forEach(l => {
    if (l.startsWith('#')) { cur = { id: uid(), name: l.replace(/^#+\s*/, ''), items: [] }; sections.push(cur); return; }
    if (!cur) { cur = { id: uid(), name: 'General', items: [] }; sections.push(cur); }
    const t = l.replace(/^[-*]\s*/, ''); cur.items.push({ id: ids.get(t) || uid(), text: t });
  });
  return sections;
}
const listText = l => l.sections.map(s => `# ${s.name}\n${s.items.map(i => i.text).join('\n')}`).join('\n\n');

const SAMPLE_LISTS = [
  ['session', 'Pre-session check', `# Wheels and tyres
Tyre pressures set and recorded
Wheel nuts torqued
Tyres checked for cuts, flat spots and debris
# Brakes
Pedal firm with no long travel
Fluid level between marks
Pad thickness checked
No leaks at calipers or lines
# Fluids
Engine oil level
Coolant level
Fuel load set and recorded
Catch tank empty
# Drivetrain
Chain tension and lube
Sprocket bolts tight
Chain joining link checked
# Suspension and steering
Spanner check on wishbone and pushrod fixings
Rod ends free of play
Steering free lock to lock
# Bodywork and aero
Wing fixings and endplates secure
Bodywork fasteners all in
Mirrors secure and adjusted
# Safety
Harness undamaged and in date
Extinguisher armed, pin out
Kill switch tested
Rain light working
Transponder charged and fitted
# Electrics and data
Battery charged
Dash on, logger recording
Camera charged and card fitted`],
  ['session', 'Post-session check', `# Straight after the session
Tyre pressures and temperatures recorded
Fuel remaining recorded
Driver comments noted
# Before the next run
Look over for fluid leaks
Check for contact damage
Download data
Log session time in the run log`],
  ['packing', 'Race weekend', `# Car and spares
Car loaded and strapped
Spare wheels and tyres
Wet tyres
Spare wishbones and pushrods
Spare nose and wing elements
Spare chain and sprockets
Brake pads and fluid
Spark plugs
# Tools
Main toolbox
Torque wrenches
Jack and stands
Tyre pressure gauge and pyrometer
Tyre pump or air bottle
Chain tools
Fuel churn and funnel
Cable ties, tank tape, lockwire
# Fluids and consumables
Fuel
Engine oil
Coolant
Brake cleaner
Chain lube
Rags and blue roll
Gloves
# Paddock
Awning and weights
Generator and fuel
Extension leads and lights
Battery charger
Fire extinguisher for the awning
Chairs and table
# Driver kit
Helmet
FHR device
Race suit, gloves and boots
Fireproof underwear and balaclava
# Paperwork
Race licence
Entry confirmation and final instructions
Scrutineering card
Club membership card
Transponder and charger`],
];

function seed() {
  const P = (cat, n, name, source, manufacturer, spec, lifeLimit, lifeUnit, stock) => ({ id: uid(), pn: `AR-${cat}-${String(n).padStart(3, '0')}`, name, category: cat, source, manufacturer, supplier: '', supplierPn: '', spec, lifeLimit, lifeUnit: lifeUnit || '', stock, location: '', cost: null, notes: '' });
  const parts = [
    P('ENG', 1, 'Engine, full rebuild', 'manufacturer', '', '1000cc', 30, 'hours', null),
    P('ENG', 2, 'Oil and filter change', 'standard', '', '', 5, 'hours', 3),
    P('ENG', 3, 'Spark plug set', 'standard', '', 'Set of 4', 15, 'hours', 1),
    P('DRV', 1, 'Drive chain', 'standard', '', 'Pitch and length to suit gearing', 10, 'hours', 1),
    P('DRV', 2, 'Front sprocket', 'standard', '', '', 10, 'hours', 2),
    P('DRV', 3, 'Rear sprocket', 'standard', '', '', 20, 'hours', 3),
    P('DRV', 4, 'Clutch pack', 'manufacturer', '', 'Plates and springs', 15, 'hours', 0),
    P('SUS', 1, 'Rod end', 'standard', '', 'Size and thread to suit', 40, 'hours', 6),
    P('SUS', 2, 'Damper service', 'standard', '', 'Per corner', 30, 'hours', null),
    P('SUS', 3, 'Front upper wishbone', 'manufacturer', 'Jedi', 'Crack check at life', 20, 'hours', 2),
    P('BRK', 1, 'Front brake pads', 'standard', '', 'Axle set', 12, 'sessions', 2),
    P('BRK', 2, 'Brake disc', 'standard', '', '', 40, 'sessions', 1),
    P('BRK', 3, 'Brake fluid change', 'standard', '', '', 3, 'months', 2),
    P('WHL', 1, 'Front wheel bearing', 'standard', '', '', 30, 'hours', 2),
    P('ELE', 1, 'Battery', 'standard', '', '12 V lithium', 36, 'months', 0),
    P('COO', 1, 'Coolant hose set', 'standard', '', 'Silicone', 24, 'months', 0),
    P('SAF', 1, 'Harness', 'standard', '', '6 point, FIA homologated', 60, 'months', 0),
    P('SAF', 2, 'Extinguisher service', 'standard', '', 'Plumbed-in system', 24, 'months', null),
    P('FAS', 1, 'M6 x 20 cap head bolt', 'standard', '', 'Grade 12.9', null, '', 40),
    P('FAS', 2, 'M8 all-metal lock nut', 'standard', '', '', null, '', 30),
    P('CON', 1, 'Engine oil', 'standard', '', 'Litres', null, '', 8),
    P('AER', 1, 'Front wing endplate', 'custom', 'Arctos Racing', '', null, '', 2),
  ];
  const cars = [1, 2].map(n => ({ id: uid(), name: `Car ${n}`, number: '', chassis: 'Jedi F1000', engine: '', notes: '' }));
  const now = Date.now(), frac = [0.35, 0.86, 0.1, 0.55, 1.04, 0.2, 0.7, 0.4];
  const comps = [];
  cars.forEach((car, ci) => parts.filter(p => p.lifeLimit).forEach((p, i) => {
    const f = frac[(i + ci * 3) % frac.length], months = p.lifeUnit === 'months';
    const since = new Date(now - (months ? p.lifeLimit * f * 2629800000 : 0)); since.setMinutes(since.getMinutes() - since.getTimezoneOffset());
    comps.push({ id: uid(), partId: p.id, carId: car.id, position: '', serial: '', lifeLimit: p.lifeLimit, lifeUnit: p.lifeUnit, base: months ? 0 : (p.lifeUnit === 'sessions' ? Math.round(p.lifeLimit * f) : Math.round(p.lifeLimit * f * 10) / 10), sinceTs: now, sinceDate: since.toISOString().slice(0, 10), history: [] });
  }));
  const lists = SAMPLE_LISTS.map(([kind, name, text]) => ({ id: uid(), kind, name, sections: parseList(text) }));
  return { v: 1, sample: true, updatedAt: 0, cars, parts, comps, logs: [], lists, checks: {}, checkLogs: [] };
}

/* ---------- state ---------- */
function load() { try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && Array.isArray(s.cars)) return s; } catch (e) { } return seed(); }
let state = load();
let sync = (() => { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (e) { return {}; } })();
const ui = { lifeCar: 'all', lifeStatus: 'all', partQ: '', partCat: '', partSrc: '', list: {}, checkCar: null };

function saveLocal() { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) { toast('Could not save on this device: storage is full or blocked.'); } }
function save() { state.updatedAt = Date.now(); saveLocal(); scheduleSync(); }
const car = id => state.cars.find(c => c.id === id);
const part = id => state.parts.find(p => p.id === id);

/* ---------- service life maths ---------- */
function used(c) {
  if (c.lifeUnit === 'months') return (c.base || 0) + Math.max(0, (Date.now() - new Date(c.sinceDate + 'T00:00').getTime()) / 2629800000);
  const logs = state.logs.filter(l => l.carId === c.carId && l.ts > c.sinceTs);
  return (c.base || 0) + (c.lifeUnit === 'hours' ? logs.reduce((a, l) => a + (l.minutes || 0), 0) / 60 : logs.length);
}
const fmtN = (v, unit) => unit === 'sessions' ? String(Math.round(v)) : (Math.round(v * 10) / 10).toFixed(1);
function life(c) {
  const u = used(c), pct = c.lifeLimit ? u / c.lifeLimit : 0, left = c.lifeLimit - u;
  return { u, pct, left, st: pct >= 1 ? 'over' : pct >= 0.8 ? 'soon' : 'ok' };
}
const ST_LABEL = { ok: 'In life', soon: 'Due soon', over: 'Overdue' };
function leftText(c, L) {
  const n = fmtN(Math.abs(L.left), c.lifeUnit), u = UNIT_SHORT[c.lifeUnit];
  return L.left < 0 ? `${n} ${u} over` : `${n} ${u} left`;
}
function lifeBar(L) {
  const w = Math.min(L.pct, 1.25) / 1.25 * 100;
  return `<div class="life" role="img" aria-label="${Math.round(L.pct * 100)} percent of life used"><div class="life-fill st-${L.st}" style="width:${w.toFixed(1)}%"></div><i style="left:64%"></i><i class="lim" style="left:80%"></i></div>`;
}
function carTotals(id) { const l = state.logs.filter(x => x.carId === id); return { h: l.reduce((a, x) => a + (x.minutes || 0), 0) / 60, n: l.length }; }
const compName = c => { const p = part(c.partId); return p ? p.name : 'Part removed from database'; };

/* ---------- small UI helpers ---------- */
let toastT;
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 3200); }
const seg = (k, opts, cur) => `<div class="seg" role="group">${opts.map(([v, l]) => `<button type="button" data-act="set" data-k="${k}" data-v="${esc(v)}" aria-pressed="${String(cur) === String(v)}">${esc(l)}</button>`).join('')}</div>`;
const carNum = c => `<span class="num">${esc(c.number || (state.cars.indexOf(c) + 1))}</span>`;
const carOpts = () => state.cars.map(c => [c.id, c.name + (c.number ? ` (#${c.number})` : '')]);

function form(title, fields, vals, onSave, opts = {}) {
  const d = $('#dlg');
  d.innerHTML = `<form class="form" novalidate><h2>${esc(title)}</h2>${opts.intro ? `<p class="muted">${esc(opts.intro)}</p>` : ''}<div class="fields">${fields.map(f => {
    const v = vals[f.k] ?? ''; let inp;
    if (f.type === 'select') inp = `<select name="${f.k}">${f.options.map(([val, lab]) => `<option value="${esc(val)}"${String(v) === String(val) ? ' selected' : ''}>${esc(lab)}</option>`).join('')}</select>`;
    else if (f.type === 'textarea') inp = `<textarea name="${f.k}" rows="${f.rows || 3}">${esc(v)}</textarea>`;
    else inp = `<input name="${f.k}" type="${f.type || 'text'}" value="${esc(v)}"${f.type === 'number' ? ' step="any" min="0" inputmode="decimal"' : ''} placeholder="${esc(f.ph || '')}">`;
    return `<label class="${f.wide ? 'wide' : ''}"><span>${esc(f.label)}</span>${inp}${f.hint ? `<small>${esc(f.hint)}</small>` : ''}</label>`;
  }).join('')}</div><p class="form-err" hidden></p><div class="form-actions"><button type="button" class="btn" data-act="closeDlg">Cancel</button><button class="btn primary">${esc(opts.saveLabel || 'Save')}</button></div></form>`;
  const fm = d.querySelector('form');
  fm.onsubmit = e => {
    e.preventDefault(); const fd = new FormData(fm), out = {};
    fields.forEach(f => { let v = fd.get(f.k); out[f.k] = f.type === 'number' ? (v === '' || v === null || isNaN(Number(v)) ? null : Number(v)) : String(v || '').trim(); });
    const missing = fields.find(f => f.required && (out[f.k] === '' || out[f.k] === null));
    const err = missing ? `Fill in "${missing.label}".` : onSave(out);
    if (typeof err === 'string') { const p = fm.querySelector('.form-err'); p.textContent = err; p.hidden = false; return; }
    d.close(); render();
  };
  opts.after?.(fm);
  d.showModal();
}
function info(title, html) { const d = $('#dlg'); d.innerHTML = `<div class="form"><h2>${esc(title)}</h2>${html}<div class="form-actions"><button type="button" class="btn primary" data-act="closeDlg">Close</button></div></div>`; d.showModal(); }

/* ---------- views ---------- */
function sampleBanner() { return state.sample ? `<p class="banner">These are example parts, lives and checklists for a typical F1000 car, not figures for yours. Edit them to match your cars, or <a href="#/settings">start from empty</a>. <button class="link" data-act="hideSample">Hide this note</button></p>` : ''; }

function vOverview() {
  const cols = state.cars.map(c => {
    const t = carTotals(c.id), all = state.comps.filter(x => x.carId === c.id).map(x => ({ c: x, L: life(x) })).sort((a, b) => b.L.pct - a.L.pct);
    const due = all.filter(x => x.L.st !== 'ok'), next = all.find(x => x.L.st === 'ok');
    const lists = state.lists.filter(l => l.kind === 'session').map(l => { const k = state.checks[`${l.id}|${c.id}`] || {}, tot = l.sections.reduce((a, s) => a + s.items.length, 0), done = l.sections.reduce((a, s) => a + s.items.filter(i => k[i.id]).length, 0); return `<li><a href="#/checks" data-act="openList" data-kind="session" data-id="${l.id}" data-car="${c.id}">${esc(l.name)}</a><span>${done} of ${tot}</span></li>`; }).join('');
    return `<section class="carcol">
      <header>${carNum(c)}<div><h2>${esc(c.name)}</h2><p class="muted">${esc([c.chassis, c.engine].filter(Boolean).join(', ') || 'No car details yet')}. ${t.h.toFixed(1)} h logged over ${t.n} ${t.n === 1 ? 'session' : 'sessions'}.</p></div></header>
      <h3>Jobs due</h3>
      ${due.length ? `<ul class="jobs">${due.map(({ c: x, L }) => `<li class="st-${L.st}"><div class="job-main"><strong>${esc(compName(x))}</strong>${x.position ? `<span class="muted"> ${esc(x.position)}</span>` : ''}<div class="job-sub"><span class="tag st-${L.st}">${ST_LABEL[L.st]}</span> ${leftText(x, L)} of ${fmtN(x.lifeLimit, x.lifeUnit)}</div>${lifeBar(L)}</div><button class="btn sm" data-act="serviceComp" data-id="${x.id}">Mark done</button></li>`).join('')}</ul>` : `<p class="empty">Nothing due.${next ? ` Next up is ${esc(compName(next.c).toLowerCase())}, ${leftText(next.c, next.L)}.` : ' Fit components on the Service life page to track them here.'}</p>`}
      ${lists ? `<h3>Session checks</h3><ul class="plain">${lists}</ul>` : ''}
      <div class="row"><button class="btn primary" data-act="addLog" data-car="${c.id}">Log a session</button><a class="btn" href="#/life" data-act="set" data-k="lifeCar" data-v="${c.id}">All components</a></div>
    </section>`;
  }).join('');
  const out = state.parts.filter(p => p.stock === 0);
  const packs = state.lists.filter(l => l.kind === 'packing').map(l => { const k = state.checks[`${l.id}|team`] || {}, tot = l.sections.reduce((a, s) => a + s.items.length, 0), done = l.sections.reduce((a, s) => a + s.items.filter(i => k[i.id]).length, 0); return `<li><a href="#/packing" data-act="openList" data-kind="packing" data-id="${l.id}">${esc(l.name)}</a><span>${done} of ${tot} packed</span></li>`; }).join('');
  return `<h1>Overview</h1>${sampleBanner()}
    <div class="cars">${cols || '<p class="empty">Add a car in Settings to get started.</p>'}</div>
    <div class="two">
      <section class="panel"><h3>Packing</h3>${packs ? `<ul class="plain">${packs}</ul>` : '<p class="empty">No packing lists yet.</p>'}</section>
      <section class="panel"><h3>Spares at zero</h3>${out.length ? `<ul class="plain">${out.map(p => `<li><a href="#/parts" data-act="editPart" data-id="${p.id}">${esc(p.name)}</a><span class="pn">${esc(p.pn)}</span></li>`).join('')}</ul>` : '<p class="empty">No tracked spare is at zero.</p>'}</section>
    </div>`;
}

function vLife() {
  let rows = state.comps.map(c => ({ c, L: life(c) }));
  if (ui.lifeCar !== 'all') rows = rows.filter(r => r.c.carId === ui.lifeCar);
  if (ui.lifeStatus !== 'all') rows = rows.filter(r => r.L.st === ui.lifeStatus);
  rows.sort((a, b) => b.L.pct - a.L.pct);
  return `<div class="head"><h1>Service life</h1><div class="row"><button class="btn" data-act="addLog">Log a session</button><button class="btn primary" data-act="fitComp">Fit a component</button></div></div>
    <p class="lede">Hours and sessions count up from the run log for the car each component is fitted to. Calendar lives count from the fitted date.</p>
    <div class="filters">${seg('lifeCar', [['all', 'All cars'], ...state.cars.map(c => [c.id, c.name])], ui.lifeCar)}${seg('lifeStatus', [['all', 'All'], ['over', 'Overdue'], ['soon', 'Due soon'], ['ok', 'In life']], ui.lifeStatus)}</div>
    ${rows.length ? `<table class="tbl"><thead><tr><th>Component</th><th>Car</th><th>Position / serial</th><th class="w-life">Life used</th><th>Remaining</th><th></th></tr></thead><tbody>${rows.map(({ c, L }) => { const p = part(c.partId); return `<tr>
      <td data-l="Component"><strong>${esc(compName(c))}</strong><br><span class="pn">${esc(p?.pn || '')}</span></td>
      <td data-l="Car">${esc(car(c.carId)?.name || '')}</td>
      <td data-l="Position / serial">${esc([c.position, c.serial].filter(Boolean).join(' / ') || '')}</td>
      <td data-l="Life used" class="w-life"><span class="nums">${fmtN(L.u, c.lifeUnit)} of ${fmtN(c.lifeLimit, c.lifeUnit)} ${UNIT_SHORT[c.lifeUnit]}</span>${lifeBar(L)}</td>
      <td data-l="Remaining"><span class="tag st-${L.st}">${ST_LABEL[L.st]}</span><br><span class="nums">${leftText(c, L)}</span></td>
      <td class="acts"><button class="btn sm" data-act="serviceComp" data-id="${c.id}">Mark done</button><button class="btn sm" data-act="history" data-id="${c.id}">History</button><button class="btn sm" data-act="editComp" data-id="${c.id}">Edit</button></td></tr>`; }).join('')}</tbody></table>` : `<p class="empty">No components match. Fit a component to start tracking its life.</p>`}`;
}

function partRows() {
  const q = ui.partQ.toLowerCase();
  const rows = state.parts.filter(p => (!ui.partCat || p.category === ui.partCat) && (!ui.partSrc || p.source === ui.partSrc) && (!q || [p.pn, p.name, p.manufacturer, p.supplier, p.supplierPn, p.spec, p.notes, p.location].join(' ').toLowerCase().includes(q))).sort((a, b) => a.pn.localeCompare(b.pn));
  if (!rows.length) return `<tr><td colspan="8" class="empty">No parts match. Clear the filters or add a part.</td></tr>`;
  return rows.map(p => `<tr>
    <td data-l="Part number"><span class="pn">${esc(p.pn)}</span></td>
    <td data-l="Part"><strong>${esc(p.name)}</strong>${p.spec ? `<br><span class="muted">${esc(p.spec)}</span>` : ''}</td>
    <td data-l="Category">${esc(CATS[p.category] || p.category)}</td>
    <td data-l="Type"><span class="tag src-${p.source}">${esc(SOURCES[p.source] || '')}</span>${p.manufacturer ? `<br><span class="muted">${esc(p.manufacturer)}</span>` : ''}</td>
    <td data-l="Supplier">${esc(p.supplier)}${p.supplierPn ? `<br><span class="pn">${esc(p.supplierPn)}</span>` : ''}</td>
    <td data-l="Service life" class="nums">${p.lifeLimit ? `${fmtN(p.lifeLimit, p.lifeUnit)} ${UNIT_SHORT[p.lifeUnit]}` : ''}</td>
    <td data-l="Spares" class="nums ${p.stock === 0 ? 'zero' : ''}">${p.stock ?? ''}${p.location ? `<br><span class="muted">${esc(p.location)}</span>` : ''}</td>
    <td class="acts"><button class="btn sm" data-act="editPart" data-id="${p.id}">Edit</button>${p.lifeLimit ? `<button class="btn sm" data-act="fitComp" data-part="${p.id}">Fit</button>` : ''}</td></tr>`).join('');
}
function vParts() {
  const sel = (k, opts, cur, all) => `<select data-chg="filter" data-k="${k}" aria-label="${all}"><option value="">${all}</option>${opts.map(([v, l]) => `<option value="${v}"${cur === v ? ' selected' : ''}>${esc(l)}</option>`).join('')}</select>`;
  return `<div class="head"><h1>Parts</h1><button class="btn primary" data-act="addPart">Add a part</button></div>${sampleBanner()}
    <div class="filters"><input type="search" data-inp="partQ" value="${esc(ui.partQ)}" placeholder="Search number, name, supplier" aria-label="Search parts">${sel('partCat', Object.entries(CATS), ui.partCat, 'All categories')}${sel('partSrc', Object.entries(SOURCES), ui.partSrc, 'All types')}</div>
    <table class="tbl"><thead><tr><th>Part number</th><th>Part</th><th>Category</th><th>Type</th><th>Supplier</th><th>Service life</th><th>Spares</th><th></th></tr></thead><tbody id="part-rows">${partRows()}</tbody></table>`;
}

const ckey = l => `${l.id}|${l.kind === 'session' ? ui.checkCar : 'team'}`;
function vList(kind) {
  const lists = state.lists.filter(l => l.kind === kind), isS = kind === 'session';
  if (!car(ui.checkCar)) ui.checkCar = state.cars[0]?.id || null;
  const l = lists.find(x => x.id === ui.list[kind]) || lists[0];
  const head = `<div class="head"><h1>${isS ? 'Session checks' : 'Packing'}</h1><button class="btn" data-act="newList" data-kind="${kind}">New list</button></div>`;
  if (!l) return head + `<p class="empty">No lists yet. Create one and type its items, one per line.</p>`;
  ui.list[kind] = l.id;
  const k = state.checks[ckey(l)] || {}, tot = l.sections.reduce((a, s) => a + s.items.length, 0), done = l.sections.reduce((a, s) => a + s.items.filter(i => k[i.id]).length, 0);
  return head + `<div class="filters">${lists.length > 1 ? seg('list.' + kind, lists.map(x => [x.id, x.name]), l.id) : ''}${isS && state.cars.length ? seg('checkCar', state.cars.map(c => [c.id, c.name]), ui.checkCar) : ''}</div>
    <div class="cl-head"><div><h2>${esc(l.name)}${isS && car(ui.checkCar) ? `, ${esc(car(ui.checkCar).name)}` : ''}</h2><p class="nums" id="cl-count">${done} of ${tot} ${isS ? 'checked' : 'packed'}</p></div><div class="row"><button class="btn sm" data-act="editList" data-id="${l.id}">Edit list</button><button class="btn sm" data-act="clearTicks" data-id="${l.id}">Clear ticks</button></div></div>
    <div class="progress"><div style="width:${tot ? done / tot * 100 : 0}%"></div></div>
    <div class="cl">${l.sections.map(s => `<section><h3>${esc(s.name)}<span>${s.items.filter(i => k[i.id]).length}/${s.items.length}</span></h3>${s.items.map(i => `<label class="cl-item${k[i.id] ? ' done' : ''}"><input type="checkbox" data-chg="check" data-list="${l.id}" data-item="${i.id}"${k[i.id] ? ' checked' : ''}><span>${esc(i.text)}</span></label>`).join('')}</section>`).join('')}</div>
    <div class="cl-foot"><button class="btn primary big" data-act="finishList" data-id="${l.id}">${isS ? 'Sign off and record' : 'Record as packed'}</button></div>`;
}

function vLog() {
  const logs = [...state.logs].sort((a, b) => (b.date || '').localeCompare(a.date || '') || b.ts - a.ts);
  const cl = [...state.checkLogs].sort((a, b) => b.ts - a.ts).slice(0, 40);
  return `<div class="head"><h1>Run log</h1><button class="btn primary" data-act="addLog">Log a session</button></div>
    <p class="lede">Every session logged here adds its running time and one session to each component fitted to that car.</p>
    ${logs.length ? `<table class="tbl"><thead><tr><th>Date</th><th>Car</th><th>Venue</th><th>Session</th><th>Time</th><th>Laps</th><th>Notes</th><th></th></tr></thead><tbody>${logs.map(l => `<tr>
      <td data-l="Date" class="nums">${fmtDate(l.date)}</td><td data-l="Car">${esc(car(l.carId)?.name || '')}</td><td data-l="Venue">${esc(l.venue)}</td><td data-l="Session">${esc(l.session)}</td>
      <td data-l="Time" class="nums">${l.minutes ?? ''} min</td><td data-l="Laps" class="nums">${l.laps ?? ''}</td><td data-l="Notes">${esc(l.notes)}</td>
      <td class="acts"><button class="btn sm" data-act="delLog" data-id="${l.id}">Delete</button></td></tr>`).join('')}</tbody></table>` : `<p class="empty">No sessions logged yet. Log one after each run so component hours stay right.</p>`}
    <h2 class="sub">Checklist records</h2>
    ${cl.length ? `<table class="tbl"><thead><tr><th>Date</th><th>List</th><th>Car</th><th>Result</th><th>Not ticked</th></tr></thead><tbody>${cl.map(r => `<tr><td data-l="Date" class="nums">${new Date(r.ts).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</td><td data-l="List">${esc(r.name)}</td><td data-l="Car">${esc(car(r.carId)?.name || '')}</td><td data-l="Result" class="nums">${r.done} of ${r.total}</td><td data-l="Not ticked">${esc((r.missed || []).join('; '))}</td></tr>`).join('')}</tbody></table>` : `<p class="empty">Signed-off checklists appear here.</p>`}`;
}

function vSettings() {
  const on = syncReady();
  return `<h1>Settings</h1>
    <section class="panel"><div class="head"><h2>Cars</h2><button class="btn sm" data-act="editCar">Add a car</button></div>
      <ul class="plain">${state.cars.map(c => `<li><span>${carNum(c)} <strong>${esc(c.name)}</strong> <span class="muted">${esc([c.chassis, c.engine].filter(Boolean).join(', '))}</span></span><button class="btn sm" data-act="editCar" data-id="${c.id}">Edit</button></li>`).join('')}</ul></section>
    <section class="panel"><h2>Sync between devices</h2>
      <p class="muted">Your data is saved in this browser. To share it between your laptop and phone, the site can keep a copy in a file in a GitHub repository you own. Use a private repository if you do not want the data public. Create a fine-grained personal access token limited to that one repository with "Contents: read and write", and enter it on each device. The token stays in this browser only.</p>
      <form id="sync-form" class="fields">
        <label><span>Repository owner</span><input name="owner" value="${esc(sync.owner || '')}" placeholder="your GitHub username" autocomplete="off"></label>
        <label><span>Repository name</span><input name="repo" value="${esc(sync.repo || '')}" placeholder="arctos-data" autocomplete="off"></label>
        <label><span>Branch</span><input name="branch" value="${esc(sync.branch || 'main')}"></label>
        <label><span>Data file</span><input name="path" value="${esc(sync.path || 'data/arctos-data.json')}"></label>
        <label class="wide"><span>Access token</span><input name="token" type="password" value="${esc(sync.token || '')}" autocomplete="off"></label>
      </form>
      <div class="row"><button class="btn primary" data-act="saveSync">${on ? 'Save and sync now' : 'Turn on sync'}</button>${on ? '<button class="btn" data-act="stopSync">Turn off sync on this device</button>' : ''}</div>
      <p class="muted" id="sync-msg">${esc(sync.msg || '')}</p></section>
    <section class="panel"><h2>Backup</h2><p class="muted">Download everything as one file, or load a file you saved earlier. Loading replaces what is on this device.</p>
      <div class="row"><button class="btn" data-act="exportData">Download backup</button><button class="btn" data-act="importData">Load backup</button></div></section>
    <section class="panel"><h2>Example data</h2><p class="muted">Starting from empty removes all parts, fitted components and logs but keeps your cars and checklists.</p>
      <div class="row"><button class="btn" data-act="clearSample">Start from empty</button><button class="btn" data-act="restoreSample">Restore the examples</button></div></section>`;
}

const VIEWS = { overview: vOverview, life: vLife, parts: vParts, checks: () => vList('session'), packing: () => vList('packing'), log: vLog, settings: vSettings };
const route = () => { const r = location.hash.replace(/^#\/?/, ''); return VIEWS[r] ? r : 'overview'; };
function render() {
  const r = route();
  $('#nav').innerHTML = ROUTES.map(([k, l]) => `<a href="#/${k}"${k === r ? ' aria-current="page"' : ''}>${l}</a>`).join('');
  $('#view').innerHTML = VIEWS[r]();
  $('#nav [aria-current]')?.scrollIntoView?.({ block: 'nearest', inline: 'center' });
  pill();
}
window.addEventListener('hashchange', () => { render(); window.scrollTo(0, 0); });

/* ---------- actions ---------- */
function nextPn(cat) { const pre = `AR-${cat}-`; const n = Math.max(0, ...state.parts.filter(p => p.pn.startsWith(pre)).map(p => parseInt(p.pn.slice(pre.length), 10) || 0)); return pre + String(n + 1).padStart(3, '0'); }
const unitOpts = [['', 'Not lifed'], ['hours', 'Running hours'], ['sessions', 'Sessions'], ['months', 'Calendar months']];

function partForm(p) {
  const isNew = !p; const v = p || { pn: nextPn('ENG'), category: 'ENG', source: 'standard' };
  form(isNew ? 'Add a part' : 'Edit part', [
    { k: 'name', label: 'Part name', required: true, wide: true },
    { k: 'category', label: 'Category', type: 'select', options: Object.entries(CATS) },
    { k: 'pn', label: 'Team part number', required: true, hint: 'Numbered automatically by category. Change it if you use your own scheme.' },
    { k: 'source', label: 'Type', type: 'select', options: Object.entries(SOURCES) },
    { k: 'manufacturer', label: 'Manufacturer' },
    { k: 'supplier', label: 'Supplier' },
    { k: 'supplierPn', label: 'Supplier part number' },
    { k: 'spec', label: 'Size or spec', wide: true },
    { k: 'lifeLimit', label: 'Service life', type: 'number', hint: 'Leave empty for parts with no life limit.' },
    { k: 'lifeUnit', label: 'Counted in', type: 'select', options: unitOpts },
    { k: 'stock', label: 'Spares in stock', type: 'number' },
    { k: 'location', label: 'Where kept', ph: 'Spares box, trailer' },
    { k: 'cost', label: 'Unit cost, £', type: 'number' },
    { k: 'notes', label: 'Notes', type: 'textarea', wide: true },
  ], v, o => {
    if (state.parts.some(x => x.pn.toLowerCase() === o.pn.toLowerCase() && x !== p)) return `Part number ${o.pn} is already used. Pick another.`;
    if (o.lifeLimit && !o.lifeUnit) return 'Choose what the service life is counted in.';
    if (!o.lifeLimit) { o.lifeLimit = null; o.lifeUnit = ''; }
    if (p) Object.assign(p, o); else state.parts.push({ id: uid(), ...o });
    save(); toast(isNew ? 'Part added' : 'Part saved');
  }, {
    saveLabel: isNew ? 'Add part' : 'Save part',
    after: fm => {
      if (isNew) fm.category.onchange = () => { if (/^AR-[A-Z]{3}-\d+$/.test(fm.pn.value)) fm.pn.value = nextPn(fm.category.value); };
      else { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn danger'; b.textContent = 'Delete part'; b.dataset.act = 'delPart'; b.dataset.id = p.id; fm.querySelector('.form-actions').prepend(b); }
    }
  });
}

function compForm(c, partId) {
  const lifed = state.parts.filter(p => p.lifeLimit || p.id === c?.partId);
  if (!state.cars.length) return toast('Add a car in Settings first.');
  if (!lifed.length) return toast('Add a part with a service life first.');
  const p0 = part(partId) || lifed[0];
  const v = c || { partId: p0.id, carId: ui.lifeCar !== 'all' ? ui.lifeCar : state.cars[0].id, lifeLimit: p0.lifeLimit, lifeUnit: p0.lifeUnit, base: 0, sinceDate: today() };
  form(c ? 'Edit component' : 'Fit a component', [
    { k: 'partId', label: 'Part', type: 'select', wide: true, options: lifed.map(p => [p.id, `${p.pn}  ${p.name}`]) },
    { k: 'carId', label: 'Car', type: 'select', options: carOpts() },
    { k: 'position', label: 'Position', ph: 'Front left' },
    { k: 'serial', label: 'Serial or batch number' },
    { k: 'sinceDate', label: 'Fitted or last serviced', type: 'date', required: true },
    { k: 'lifeLimit', label: 'Service life', type: 'number', required: true },
    { k: 'lifeUnit', label: 'Counted in', type: 'select', options: unitOpts.slice(1) },
    { k: 'base', label: 'Already used when fitted', type: 'number', hint: 'In the same unit. Use 0 for a new part.' },
  ], v, o => {
    if (!(o.lifeLimit > 0)) return 'Service life must be more than 0.';
    o.base = o.base || 0;
    if (c) Object.assign(c, o); else state.comps.push({ id: uid(), ...o, sinceTs: Date.now(), history: [] });
    save(); toast(c ? 'Component saved' : 'Component fitted');
  }, {
    saveLabel: c ? 'Save component' : 'Fit component',
    after: fm => {
      fm.partId.onchange = () => { const p = part(fm.partId.value); if (p?.lifeLimit) { fm.lifeLimit.value = p.lifeLimit; fm.lifeUnit.value = p.lifeUnit; } };
      if (c) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn danger'; b.textContent = 'Remove from car'; b.dataset.act = 'delComp'; b.dataset.id = c.id; fm.querySelector('.form-actions').prepend(b); }
    }
  });
}

const A = {
  closeDlg: () => $('#dlg').close(),
  hideSample: () => { state.sample = false; save(); render(); },
  set: d => { if (d.k.startsWith('list.')) ui.list[d.k.slice(5)] = d.v; else ui[d.k] = d.v; render(); },
  openList: d => { ui.list[d.kind] = d.id; if (d.car) ui.checkCar = d.car; },
  addPart: () => partForm(),
  editPart: d => partForm(part(d.id)),
  delPart: d => {
    if (state.comps.some(c => c.partId === d.id)) return toast('This part is fitted to a car. Remove it from the car first.');
    if (!confirm('Delete this part from the database?')) return;
    state.parts = state.parts.filter(p => p.id !== d.id); save(); $('#dlg').close(); render(); toast('Part deleted');
  },
  fitComp: d => compForm(null, d.part),
  editComp: d => compForm(state.comps.find(c => c.id === d.id)),
  delComp: d => { if (!confirm('Remove this component and its history?')) return; state.comps = state.comps.filter(c => c.id !== d.id); save(); $('#dlg').close(); render(); toast('Component removed'); },
  serviceComp: d => {
    const c = state.comps.find(x => x.id === d.id), L = life(c);
    form(`Mark done: ${compName(c)}`, [
      { k: 'action', label: 'What was done', type: 'select', options: ['Replaced with new', 'Serviced or rebuilt', 'Inspected and passed for another life'].map(x => [x, x]) },
      { k: 'date', label: 'Date', type: 'date', required: true },
      { k: 'serial', label: 'New serial or batch number', hint: 'Leave empty to keep the current one.' },
      { k: 'note', label: 'Note', type: 'textarea', wide: true },
    ], { action: 'Replaced with new', date: today() }, o => {
      (c.history ||= []).push({ date: o.date, action: o.action, used: `${fmtN(L.u, c.lifeUnit)} ${UNIT_SHORT[c.lifeUnit]}`, note: o.note });
      c.base = 0; c.sinceTs = Date.now(); c.sinceDate = o.date; if (o.serial) c.serial = o.serial;
      save(); toast('Marked done, life reset to zero');
    }, { intro: `${car(c.carId)?.name || ''}. Used ${fmtN(L.u, c.lifeUnit)} of ${fmtN(c.lifeLimit, c.lifeUnit)} ${UNIT_SHORT[c.lifeUnit]}. Saving records this in the history and restarts the count.`, saveLabel: 'Mark done' });
  },
  history: d => {
    const c = state.comps.find(x => x.id === d.id), h = c.history || [];
    info(`History: ${compName(c)}`, `<p class="muted">${esc(car(c.carId)?.name || '')}${c.position ? ', ' + esc(c.position) : ''}. Current count started ${fmtDate(c.sinceDate)}.</p>` + (h.length ? `<ul class="plain hist">${[...h].reverse().map(x => `<li><span><strong>${fmtDate(x.date)}</strong> ${esc(x.action)} at ${esc(x.used)}${x.note ? `<br><span class="muted">${esc(x.note)}</span>` : ''}</span></li>`).join('')}</ul>` : '<p class="empty">Nothing recorded yet. Each time you mark this component done it is listed here.</p>'));
  },
  addLog: d => {
    if (!state.cars.length) return toast('Add a car in Settings first.');
    form('Log a session', [
      { k: 'carId', label: 'Car', type: 'select', options: carOpts() },
      { k: 'date', label: 'Date', type: 'date', required: true },
      { k: 'venue', label: 'Venue', ph: 'Circuit' },
      { k: 'session', label: 'Session', type: 'select', options: ['Test', 'Practice', 'Qualifying', 'Race', 'Other'].map(x => [x, x]) },
      { k: 'minutes', label: 'Running time, minutes', type: 'number', required: true },
      { k: 'laps', label: 'Laps', type: 'number' },
      { k: 'notes', label: 'Notes', type: 'textarea', wide: true },
    ], { carId: d.car || (ui.lifeCar !== 'all' ? ui.lifeCar : state.cars[0].id), date: today(), venue: state.logs.at(-1)?.venue || '', session: 'Test' }, o => {
      state.logs.push({ id: uid(), ts: Date.now(), ...o }); save(); toast('Session logged');
    }, { saveLabel: 'Log session' });
  },
  delLog: d => { if (!confirm('Delete this session? Component hours will drop by its running time.')) return; state.logs = state.logs.filter(l => l.id !== d.id); save(); render(); toast('Session deleted'); },
  newList: d => listForm(null, d.kind),
  editList: d => listForm(state.lists.find(l => l.id === d.id)),
  delList: d => { if (!confirm('Delete this list?')) return; state.lists = state.lists.filter(l => l.id !== d.id); save(); $('#dlg').close(); render(); toast('List deleted'); },
  clearTicks: d => { const l = state.lists.find(x => x.id === d.id); delete state.checks[ckey(l)]; save(); render(); },
  finishList: d => {
    const l = state.lists.find(x => x.id === d.id), k = state.checks[ckey(l)] || {}, items = l.sections.flatMap(s => s.items), missed = items.filter(i => !k[i.id]);
    if (missed.length && !confirm(`${missed.length} ${missed.length === 1 ? 'item is' : 'items are'} not ticked. Record it anyway?`)) return;
    state.checkLogs.push({ id: uid(), ts: Date.now(), listId: l.id, name: l.name, carId: l.kind === 'session' ? ui.checkCar : null, done: items.length - missed.length, total: items.length, missed: missed.map(i => i.text) });
    delete state.checks[ckey(l)]; save(); render(); toast('Recorded. Ticks cleared for next time.');
  },
  editCar: d => {
    const c = car(d.id);
    form(c ? 'Edit car' : 'Add a car', [
      { k: 'name', label: 'Name', required: true }, { k: 'number', label: 'Race number' },
      { k: 'chassis', label: 'Chassis' }, { k: 'engine', label: 'Engine' }, { k: 'notes', label: 'Notes', type: 'textarea', wide: true },
    ], c || {}, o => { if (c) Object.assign(c, o); else state.cars.push({ id: uid(), ...o }); save(); toast('Car saved'); }, {
      saveLabel: c ? 'Save car' : 'Add car',
      after: fm => { if (c) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn danger'; b.textContent = 'Delete car'; b.dataset.act = 'delCar'; b.dataset.id = c.id; fm.querySelector('.form-actions').prepend(b); } }
    });
  },
  delCar: d => {
    if (state.comps.some(c => c.carId === d.id) || state.logs.some(l => l.carId === d.id)) return toast('This car has components or logged sessions. Remove those first.');
    if (!confirm('Delete this car?')) return; state.cars = state.cars.filter(c => c.id !== d.id); save(); $('#dlg').close(); render();
  },
  exportData: () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })); a.download = `arctos-racing-${today()}.json`; a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000); },
  importData: () => $('#import-file').click(),
  clearSample: () => { if (!confirm('Remove all parts, fitted components, sessions and checklist records? Cars and checklists stay.')) return; Object.assign(state, { parts: [], comps: [], logs: [], checkLogs: [], checks: {}, sample: false }); save(); render(); toast('Started from empty'); },
  restoreSample: () => { if (!confirm('Replace everything on this device with the example data?')) return; state = seed(); save(); render(); toast('Examples restored'); },
  saveSync: () => {
    const fd = new FormData($('#sync-form')); ['owner', 'repo', 'branch', 'path', 'token'].forEach(k => sync[k] = String(fd.get(k) || '').trim().replace(/^\/+|\/+$/g, ''));
    if (!syncReady()) { sync.msg = 'Fill in the owner, repository, data file and token to turn on sync.'; saveSync(); return render(); }
    sync.baseAt = null; sync.sha = null; saveSync(); syncNow(true);
  },
  stopSync: () => { sync = {}; saveSync(); render(); toast('Sync turned off on this device'); },
};

function listForm(l, kind) {
  form(l ? 'Edit list' : 'New list', [
    { k: 'name', label: 'List name', required: true, wide: true },
    { k: 'text', label: 'Items', type: 'textarea', rows: 16, wide: true, hint: 'One item per line. Start a line with # to begin a new section.' },
  ], l ? { name: l.name, text: listText(l) } : { text: '# Section\n' }, o => {
    const sections = parseList(o.text, l); if (!sections.some(s => s.items.length)) return 'Add at least one item.';
    if (l) { l.name = o.name; l.sections = sections; } else { const n = { id: uid(), kind, name: o.name, sections }; state.lists.push(n); ui.list[kind] = n.id; }
    save(); toast('List saved');
  }, { saveLabel: 'Save list', after: fm => { if (l) { const b = document.createElement('button'); b.type = 'button'; b.className = 'btn danger'; b.textContent = 'Delete list'; b.dataset.act = 'delList'; b.dataset.id = l.id; fm.querySelector('.form-actions').prepend(b); } } });
}

const C = {
  check: el => {
    const l = state.lists.find(x => x.id === el.dataset.list), key = ckey(l), k = (state.checks[key] ||= {});
    if (el.checked) k[el.dataset.item] = 1; else delete k[el.dataset.item];
    save(); render(); $(`[data-item="${el.dataset.item}"]`)?.focus();
  },
  filter: el => { ui[el.dataset.k] = el.value; $('#part-rows').innerHTML = partRows(); },
};
const I = { partQ: el => { ui.partQ = el.value; $('#part-rows').innerHTML = partRows(); } };

document.addEventListener('click', e => { const el = e.target.closest('[data-act]'); if (!el) return; const fn = A[el.dataset.act]; if (fn) fn(el.dataset, el); });
document.addEventListener('change', e => { const el = e.target.closest('[data-chg]'); if (el) C[el.dataset.chg]?.(el); });
document.addEventListener('input', e => { const el = e.target.closest('[data-inp]'); if (el) I[el.dataset.inp]?.(el); });
$('#import-file').addEventListener('change', async e => {
  const f = e.target.files[0]; e.target.value = ''; if (!f) return;
  try { const s = JSON.parse(await f.text()); if (!Array.isArray(s.cars) || !Array.isArray(s.parts)) throw 0; if (!confirm('Replace everything on this device with this backup?')) return; state = s; save(); render(); toast('Backup loaded'); }
  catch (err) { toast('That file is not an Arctos Racing backup.'); }
});

/* ---------- GitHub sync ---------- */
const syncReady = () => !!(sync.owner && sync.repo && sync.path && sync.token);
function saveSync() { localStorage.setItem(SYNC_KEY, JSON.stringify(sync)); }
let syncState = 'idle', syncT, syncing = false, again = false;
function pill() {
  const p = $('#sync-pill'); if (!p) return;
  const on = syncReady(), s = on ? syncState : 'off';
  p.className = 'pill ' + s;
  p.textContent = { off: 'This device only', idle: 'Synced', busy: 'Syncing', err: 'Sync failed' }[s];
}
const b64e = s => { const b = new TextEncoder().encode(s); let o = ''; for (let i = 0; i < b.length; i += 0x8000) o += String.fromCharCode(...b.subarray(i, i + 0x8000)); return btoa(o); };
const b64d = s => new TextDecoder().decode(Uint8Array.from(atob(s.replace(/\s/g, '')), c => c.charCodeAt(0)));
async function gh(method, body) {
  const url = `https://api.github.com/repos/${encodeURIComponent(sync.owner)}/${encodeURIComponent(sync.repo)}/contents/${sync.path.split('/').map(encodeURIComponent).join('/')}` + (method === 'GET' ? `?ref=${encodeURIComponent(sync.branch || 'main')}&t=${Date.now()}` : '');
  return fetch(url, { method, cache: 'no-store', headers: { Authorization: `Bearer ${sync.token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28' }, body: body ? JSON.stringify(body) : undefined });
}
function ghError(r) { return { 401: 'GitHub rejected the token. Check it has not expired.', 403: 'The token does not have "Contents: read and write" on this repository.', 404: 'Repository or branch not found. Check the names and that the token covers this repository.' }[r.status] || `GitHub returned an error (${r.status}).`; }
async function syncNow(manual) {
  if (!syncReady()) return;
  if (syncing) { again = true; return; }
  syncing = true; syncState = 'busy'; pill();
  try {
    const r = await gh('GET'); let remote = null;
    if (r.ok) { const j = await r.json(); sync.sha = j.sha; remote = JSON.parse(b64d(j.content)); }
    else if (r.status === 404) sync.sha = null; // no data file yet: the save below creates it (or reports a missing repository)
    else throw new Error(ghError(r));
    const dirty = state.updatedAt !== sync.baseAt;
    if (remote && remote.updatedAt !== sync.baseAt) {
      const keepLocal = dirty && sync.baseAt != null && confirm('Your data was changed on another device since this one last synced.\n\nOK keeps this device\'s version and overwrites the other.\nCancel loads the other device\'s version here.');
      if (!keepLocal) { state = remote; saveLocal(); sync.baseAt = remote.updatedAt; sync.msg = `Loaded the latest data from GitHub at ${new Date().toLocaleTimeString('en-GB')}.`; saveSync(); syncState = 'idle'; if (!$('#dlg').open) render(); else pill(); return; }
    }
    if (dirty || !remote) {
      if (!state.updatedAt) state.updatedAt = Date.now(), saveLocal();
      const w = await gh('PUT', { message: 'Update Arctos Racing data', content: b64e(JSON.stringify(state, null, 1)), branch: sync.branch || 'main', ...(sync.sha ? { sha: sync.sha } : {}) });
      if (!w.ok) throw new Error(w.status === 409 || w.status === 422 ? 'The file changed while saving. Sync again.' : ghError(w));
      sync.sha = (await w.json()).content.sha; sync.baseAt = state.updatedAt;
    }
    sync.msg = `Synced at ${new Date().toLocaleTimeString('en-GB')}.`; syncState = 'idle';
  } catch (e) {
    syncState = 'err'; sync.msg = e instanceof TypeError ? 'No connection. Changes are saved on this device and will sync when you are back online.' : e.message;
  } finally {
    syncing = false; saveSync(); pill(); const m = $('#sync-msg'); if (m) m.textContent = sync.msg || '';
    if (manual && route() === 'settings' && !$('#dlg').open) render();
    if (again) { again = false; scheduleSync(); }
  }
}
function scheduleSync() { if (!syncReady()) return; clearTimeout(syncT); syncT = setTimeout(syncNow, 2500); }
document.addEventListener('visibilitychange', () => { if (!document.hidden) syncNow(); });
window.addEventListener('online', () => syncNow());

/* ---------- start ---------- */
saveLocal(); render(); syncNow();
if ('serviceWorker' in navigator && location.protocol === 'https:') navigator.serviceWorker.register('sw.js').catch(() => { });
