// Stations, units, road routing (OSRM), and nearest-unit recommendation.
// Real fire and police station addresses in California's 19th district (southwest San Jose,
// Santa Cruz + Santa Cruz Mountains, Monterey Peninsula, Paso Robles / Atascadero), geocoded with
// OpenStreetMap. Which units each station houses, and ambulance posting, are SIMULATED for the demo.
import { hav } from './util.js';

const st = (id, code, name, address, lat, lng, kinds, note) => ({ id, code, name, address, lat, lng, kinds, note });
export const STATIONS = [
  // San José Fire Department (southwest San José)
  st('SJ9', 'SJ9', 'San José Fire Station 9', '3410 Ross Ave', 37.26391, -121.9156, ['E', 'T']),
  st('SJ10', 'SJ10', 'San José Fire Station 10', '511 S Monroe St', 37.31817, -121.94372, ['E']),
  st('SJ12', 'SJ12', 'San José Fire Station 12', '5912 Cahalan Ave', 37.24295, -121.84895, ['E', 'M']),
  st('SJ15', 'SJ15', 'San José Fire Station 15', '1248 S Blaney Ave', 37.3014, -122.02339, ['E']),
  st('SJ17', 'SJ17', 'San José Fire Station 17', '5170 Coniston Way', 37.24722, -121.8853, ['E']),
  st('SJ18', 'SJ18', 'San José Fire Station 18', '4430 Monterey Rd', 37.27299, -121.82896, ['E', 'M']),
  st('SJ22', 'SJ22', 'San José Fire Station 22', '6461 Bose Ln', 37.22205, -121.86767, ['E']),
  st('SJ27', 'SJ27', 'San José Fire Station 27', '6027 San Ignacio Ave', 37.23295, -121.77302, ['E', 'R', 'M']),
  st('SJ28', 'SJ28', 'San José Fire Station 28', '19911 McKean Rd', 37.19952, -121.82473, ['E']),
  // Santa Cruz Fire Department (stations renumbered 61–64)
  st('SC61', 'SC61', 'Santa Cruz Fire Station 61', '711 Center St', 36.97324, -122.02853, ['E', 'T', 'M']),
  st('SC62', 'SC62', 'Santa Cruz Fire Station 62', '1103 Soquel Ave', 36.97905, -122.01219, ['E']),
  st('SC63', 'SC63', 'Santa Cruz Fire Station 63', '335 Younglove Ave', 36.96175, -122.0425, ['E']),
  st('SC64', 'SC64', 'Santa Cruz Fire Station 64 (UCSC)', '701 Chinquapin Rd', 37.00185, -122.05563, ['E']),
  // Central Fire Protection District (Live Oak, Soquel, Capitola)
  st('CFD17', 'CFD1', 'Central Fire · 17th Ave', '930 17th Ave, Santa Cruz', 36.9679, -121.98485, ['E', 'M']),
  st('CFDTH', 'CFD2', 'Central Fire · Thurber Ln', '3445 Thurber Ln, Santa Cruz', 36.99227, -121.97822, ['E']),
  st('CFDSQ', 'CFD3', 'Central Fire · Soquel', '4747 Soquel Dr, Soquel', 36.98846, -121.95664, ['E']),
  st('CFDCP', 'CFD4', 'Central Fire · Capitola', '405 Capitola Ave, Capitola', 36.97429, -121.95361, ['E', 'M']),
  // Santa Cruz Mountains / San Lorenzo Valley
  st('SV', 'SV', 'Scotts Valley Fire District', '7 Erba Ln, Scotts Valley', 37.04801, -122.01929, ['E', 'R', 'M']),
  st('FEL', 'FEL', 'Felton Fire Protection District', '131 Kirby St, Felton', 37.05084, -122.07388, ['E']),
  st('BL', 'BL', 'Ben Lomond Fire District', '9430 Highway 9, Ben Lomond', 37.08962, -122.0908, ['E'], 'map point approximate'),
  st('BC', 'BC', 'Boulder Creek Fire Protection District', '13230 Central Ave, Boulder Creek', 37.12584, -122.12218, ['E', 'M']),
  // Monterey Peninsula
  st('MRY11', 'MRY11', 'Monterey Fire Station 11', '600 Pacific St, Monterey', 36.59673, -121.89723, ['E', 'T', 'M', 'R']),
  st('MRY12', 'MRY12', 'Monterey Fire Station 12', '582 Hawthorne St, Monterey', 36.61288, -121.90231, ['E']),
  st('MRY13', 'MRY13', 'Monterey Fire Station 13', '401 Dela Vina Ave, Monterey', 36.59925, -121.86146, ['E']),
  st('MRY14', 'MRY14', 'Monterey Fire Station 14 (Pacific Grove)', '600 Pine Ave, Pacific Grove', 36.61909, -121.91941, ['E']),
  st('MRY15', 'MRY15', 'Monterey Fire Station 15 (Carmel)', '6th Ave between Mission & San Carlos, Carmel-by-the-Sea', 36.55485, -121.92195, ['E'], 'map point approximate'),
  st('SEA', 'SEA', 'Seaside Fire Department', '1635 Broadway Ave, Seaside', 36.60928, -121.82903, ['E', 'M']),
  // North San Luis Obispo County
  st('PR1', 'PR1', 'Paso Robles Fire Station 1', '900 Park St, Paso Robles', 35.62392, -120.68934, ['E', 'T', 'M']),
  st('PR3', 'PR3', 'Paso Robles Fire Station 3', '2924 Union Rd, Paso Robles', 35.64245, -120.65375, ['E']),
  st('CAL30', 'CAL30', 'CAL FIRE / SLO County Station 30', '2510 Ramada Dr, Paso Robles', 35.58142, -120.69548, ['E']),
  st('ATA1', 'ATA1', 'Atascadero Fire Station 1', '6005 Lewis Ave, Atascadero', 35.49143, -120.66845, ['E', 'M']),
  st('ATA2', 'ATA2', 'Atascadero Fire Station 2', '9801 W Front Rd, Atascadero', 35.46391, -120.65063, ['E']),
  // Law enforcement
  st('SJPD', 'SJPD', 'San José Police · South Substation', '6087 Great Oaks Pkwy', 37.24557, -121.7885, ['P', 'P']),
  st('SCPD', 'SCPD', 'Santa Cruz Police Department', '155 Center St, Santa Cruz', 36.96777, -122.02739, ['P', 'P']),
  st('SVPD', 'SVPD', 'Scotts Valley Police Department', '1 Civic Center Dr, Scotts Valley', 37.04837, -122.017, ['P']),
  st('SCSO', 'SCSO', "Santa Cruz County Sheriff's Office", '5200 Soquel Ave, Santa Cruz', 36.98451, -121.97863, ['P', 'P']),
  st('MPD', 'MPD', 'Monterey Police Department', '351 Madison St, Monterey', 36.59701, -121.89755, ['P', 'P']),
  st('SPD', 'SPD', 'Seaside Police Department', '440 Harcourt Ave, Seaside', 36.60356, -121.85355, ['P']),
  st('PRPD', 'PRPD', 'Paso Robles Police Department', '900 Park St, Paso Robles', 35.62392, -120.68934, ['P']),
  st('APD', 'APD', 'Atascadero Police Department', '5505 El Camino Real, Atascadero', 35.49104, -120.67248, ['P']),
];

export const TYPE_META = {
  E: { name: 'Engine', prefix: 'E', color: '#ff5a4f' },
  T: { name: 'Truck', prefix: 'T', color: '#ff9f1c' },
  M: { name: 'ALS Ambulance', prefix: 'M', color: '#35d6a3' },
  R: { name: 'Rescue', prefix: 'R', color: '#c46bff' },
  P: { name: 'Police', prefix: 'P', color: '#4da3ff' },
};

export function buildFleet() {
  const units = [];
  for (const stn of STATIONS) {
    const seen = {};
    for (const k of stn.kinds) {
      seen[k] = (seen[k] || 0) + 1;
      const label = `${TYPE_META[k].prefix}-${stn.code}${k === 'P' || seen[k] > 1 ? seen[k] : ''}`;
      units.push({
        id: label.replace(/-/g, ''), label, type: k, station: stn.id, stationName: stn.name,
        home: { lat: stn.lat, lng: stn.lng }, lat: stn.lat, lng: stn.lng,
        status: 'avail', incidentId: null, route: null, routeId: 0, prog: 0,
      });
    }
  }
  return units;
}

// ---- routing ---------------------------------------------------------------
const routeCache = new Map();
const EMERGENCY_FACTOR = 0.75; // lights & sirens

function cumulative(coords) {
  const cum = [0];
  for (let i = 1; i < coords.length; i++) {
    cum.push(cum[i - 1] + hav({ lat: coords[i - 1][1], lng: coords[i - 1][0] }, { lat: coords[i][1], lng: coords[i][0] }));
  }
  return cum;
}

export async function route(a, b) {
  const key = `${a.lat.toFixed(4)},${a.lng.toFixed(4)}>${b.lat.toFixed(4)},${b.lng.toFixed(4)}`;
  if (routeCache.has(key)) return { ...routeCache.get(key), ms: 0, cached: true };
  const t0 = performance.now();
  let out;
  try {
    const c = new AbortController();
    const to = setTimeout(() => c.abort(), 3500);
    const r = await fetch(`https://router.project-osrm.org/route/v1/driving/${a.lng},${a.lat};${b.lng},${b.lat}?overview=full&geometries=geojson`, { signal: c.signal });
    clearTimeout(to);
    const j = await r.json();
    const rt = j.routes?.[0];
    if (!rt) throw new Error('no route');
    let coords = rt.geometry.coordinates;
    if (coords.length > 500) { const step = Math.ceil(coords.length / 500); coords = coords.filter((_, i) => i % step === 0 || i === coords.length - 1); }
    out = { coords, dist: rt.distance, dur: rt.duration * EMERGENCY_FACTOR, approx: false };
  } catch {
    const d = hav(a, b) * 1.35;
    const pts = 14;
    const coords = Array.from({ length: pts + 1 }, (_, i) => [a.lng + ((b.lng - a.lng) * i) / pts, a.lat + ((b.lat - a.lat) * i) / pts]);
    out = { coords, dist: d, dur: d / 14, approx: true };
  }
  out.cum = cumulative(out.coords);
  out.dist = out.cum[out.cum.length - 1] || out.dist;
  routeCache.set(key, out);
  return { ...out, ms: Math.round(performance.now() - t0), cached: false };
}

export function pointAlong(r, meters) {
  const m = Math.max(0, Math.min(r.dist, meters));
  let lo = 0, hi = r.cum.length - 1;
  while (lo < hi - 1) { const mid = (lo + hi) >> 1; if (r.cum[mid] <= m) lo = mid; else hi = mid; }
  const seg = r.cum[hi] - r.cum[lo] || 1;
  const f = (m - r.cum[lo]) / seg;
  const p = r.coords[lo], q = r.coords[hi];
  return { lat: p[1] + (q[1] - p[1]) * f, lng: p[0] + (q[0] - p[0]) * f };
}

// ---- recommendation --------------------------------------------------------
export function needsFor(inc) {
  const tags = new Set(inc.tags || []);
  const sev = inc.severity;
  let needs = [];
  switch (inc.category) {
    case 'fire':
      if (/wildland|brush/i.test(inc.type)) needs = ['E', 'E', 'E', 'R'];
      else if (/vehicle/i.test(inc.type)) needs = ['E', 'M', 'P'];
      else needs = ['E', 'E', 'T', 'M'];
      break;
    case 'medical': needs = sev <= 1 ? ['M', 'E'] : ['M']; break;
    case 'crash': needs = ['M', 'E', 'P']; break;
    case 'police': needs = tags.has('weapon') ? ['P', 'P'] : ['P']; break;
    case 'gas': needs = ['E', 'P']; break;
    case 'quake': needs = ['R', 'E', 'M']; break;
    case 'flood': needs = ['R', 'E']; break;
    default: needs = ['P'];
  }
  if (tags.has('trapped') && !needs.includes('R')) needs.push('R');
  if (tags.has('injured') && !needs.includes('M')) needs.push('M');
  if (inc.callIds && inc.callIds.length >= 12 && inc.category === 'fire') needs.push('E', 'M'); // large multi-call event
  return needs;
}

export async function recommend(inc, units) {
  if (!inc.center) return { slots: [], ms: 0 };
  const t0 = performance.now();
  const taken = new Set(inc.units || []);
  const avail = units.filter((u) => u.status === 'avail' && !taken.has(u.id));
  const needs = needsFor(inc);
  // account for units already on the way
  const have = {};
  for (const id of inc.units || []) { const u = units.find((x) => x.id === id); if (u) have[u.type] = (have[u.type] || 0) + 1; }
  const picked = new Set();
  const slots = [];
  for (const type of needs) {
    if (have[type] > 0) { have[type]--; continue; }
    const cands = avail.filter((u) => u.type === type && !picked.has(u.id)).sort((a, b) => hav(a, inc.center) - hav(b, inc.center));
    if (cands[0]) { picked.add(cands[0].id); slots.push({ type, unitId: cands[0].id, label: cands[0].label, station: cands[0].stationName }); }
    else slots.push({ type, unitId: null, label: TYPE_META[type].name, shortage: true });
  }
  await Promise.all(slots.filter((s) => s.unitId).map(async (s) => {
    const u = units.find((x) => x.id === s.unitId);
    const r = await route(u, inc.center);
    s.etaSec = Math.round(r.dur); s.distM = Math.round(r.dist); s.approx = r.approx;
  }));
  return { slots, ms: Math.round(performance.now() - t0) };
}
