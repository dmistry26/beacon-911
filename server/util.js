export const rad = (d) => (d * Math.PI) / 180;

export function hav(a, b) {
  const R = 6371000;
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const s = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
export function gauss() {
  let u = 0, v = 0;
  while (u === 0) u = Math.random();
  while (v === 0) v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
export function offsetLL(lat, lng, dxMeters, dyMeters) {
  return {
    lat: lat + dyMeters / 111320,
    lng: lng + dxMeters / (111320 * Math.cos(rad(lat))),
  };
}
export const round = (n, d = 0) => { const k = 10 ** d; return Math.round(n * k) / k; };
