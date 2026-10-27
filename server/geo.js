// Free geocoding via OpenStreetMap Nominatim (reverse + forward), with caching and timeouts.
const UA = 'BeaconDemo/1.0 (Congressional App Challenge student project)';
const cache = new Map();

async function jfetch(url, ms = 3000) {
  const c = new AbortController();
  const t = setTimeout(() => c.abort(), ms);
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'en' }, signal: c.signal });
    if (!r.ok) throw new Error(String(r.status));
    return await r.json();
  } finally { clearTimeout(t); }
}

export async function reverse(lat, lng) {
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (cache.has(key)) return cache.get(key);
  const t0 = performance.now();
  let out;
  try {
    const j = await jfetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`);
    const a = j.address || {};
    const street = [a.house_number, a.road].filter(Boolean).join(' ');
    const city = a.city || a.town || a.village || a.hamlet || a.suburb || '';
    out = {
      address: [street || j.name, city].filter(Boolean).join(', ') || j.display_name,
      city,
      civic: { A3: 'US', A1: a.state || 'CA', A2: a.county || '', A3_city: city, RD: a.road || '', HNO: a.house_number || '', PC: a.postcode || '' },
    };
  } catch {
    out = { address: `${lat.toFixed(5)}, ${lng.toFixed(5)}`, city: '', civic: {} };
  }
  out.ms = Math.round(performance.now() - t0);
  cache.set(key, out);
  return out;
}

// Forward geocode a spoken address, biased to the Central Coast / Silicon Valley district area.
export async function forward(q) {
  try {
    const j = await jfetch(`https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&bounded=1&viewbox=-122.45,37.4,-120.4,35.4&q=${encodeURIComponent(q)}`);
    if (!j.length) return null;
    return { lat: +j[0].lat, lng: +j[0].lon, address: j[0].display_name.split(',').slice(0, 3).join(',') };
  } catch { return null; }
}
