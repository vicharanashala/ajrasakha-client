const INDIA = { latMin: 6, latMax: 38, lngMin: 68, lngMax: 98 };
const BLANK = new Set([
  '',
  'other',
  'others',
  'na',
  'n/a',
  'none',
  'null',
  'undefined',
  '-',
  '--',
  'select',
  'not available',
]);

// Lowercase, collapse spaces, and treat placeholders as empty
const cleanPart = (v) => {
  const s = String(v ?? '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase();
  return BLANK.has(s) ? '' : s;
};

const normState = (s) =>
  String(s)
    .toLowerCase()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]/g, '');
const statesMatch = (a, b) => {
  const x = normState(a);
  const y = normState(b);
  return !!x && !!y && (x === y || x.includes(y) || y.includes(x));
};

const inIndia = (lat, lng) =>
  lat >= INDIA.latMin && lat <= INDIA.latMax && lng >= INDIA.lngMin && lng <= INDIA.lngMax;

// Most specific address first. Blank fields are dropped, and identical attempts are merged.
const buildAttempts = ({ villageName, blockName, district, state }) => {
  const fields = [
    ['village', villageName],
    ['block', blockName],
    ['district', district],
    ['state', state],
  ];
  const seen = new Set();
  const attempts = [];
  for (let i = 0; i < fields.length; i++) {
    const present = fields.slice(i).filter(([, v]) => v);
    if (!present.length) continue;
    const parts = present.map(([, v]) => v);
    const id = parts.join('|');
    if (seen.has(id)) continue;
    seen.add(id);
    attempts.push({ level: present[0][0], parts });
  }
  return attempts;
};

/**
 * Returns { latitude, longitude, level, address, partialMatch, stateMismatch } or null.
 * Throws (with .status) on API-level errors such as REQUEST_DENIED or OVER_QUERY_LIMIT.
 */
const geocodeWithMeta = async (input) => {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) {
    throw Object.assign(new Error('GOOGLE_MAPS_API_KEY is not set'), { status: 'NO_KEY' });
  }

  const place = {
    villageName: cleanPart(input.villageName),
    blockName: cleanPart(input.blockName),
    district: cleanPart(input.district),
    state: cleanPart(input.state),
  };

  for (const { level, parts } of buildAttempts(place)) {
    const address = [...parts, 'India'].join(', ');
    const params = new URLSearchParams({ address, components: 'country:IN', key });
    const res = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?${params}`);
    const data = await res.json();

    if (data.status === 'ZERO_RESULTS') continue; // try a coarser address
    if (data.status !== 'OK') {
      throw Object.assign(new Error(`${data.status} ${data.error_message ?? ''}`), {
        status: data.status,
      });
    }

    const top = data.results?.[0];
    if (!top) continue;
    const { lat, lng } = top.geometry.location;
    if (!inIndia(lat, lng)) continue;

    // A finer result in a different state is a wrong village: reject it and fall back
    let stateMismatch = false;
    const stateComp = top.address_components?.find((c) =>
      c.types.includes('administrative_area_level_1'),
    );
    if (place.state && stateComp && !statesMatch(place.state, stateComp.long_name)) {
      if (level !== 'state') continue;
      stateMismatch = true; // state-level result: accept, but flag (could be an alias like Orissa/Odisha)
    }

    return {
      latitude: lat,
      longitude: lng,
      level,
      address,
      partialMatch: !!top.partial_match,
      stateMismatch,
    };
  }
  return null;
};

// Used by the controller: same shape as before, never throws
const geocoding = async (place) => {
  try {
    const r = await geocodeWithMeta(place);
    return r ? { latitude: r.latitude, longitude: r.longitude } : null;
  } catch (e) {
    console.warn(`Geocoding failed: ${e.message}`);
    return null;
  }
};

module.exports = { geocoding, geocodeWithMeta, cleanPart };
