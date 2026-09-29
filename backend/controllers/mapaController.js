const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RESULTS = 150;
const cache = new Map();
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const parseBbox = (value) => {
  if (typeof value !== 'string') return null;
  const numbers = value.split(',').map(Number);
  if (numbers.length !== 4 || numbers.some((number) => !Number.isFinite(number))) return null;

  const [south, west, north, east] = numbers;
  if (south < -90 || north > 90 || west < -180 || east > 180 || south >= north || west >= east) return null;
  if ((north - south) * (east - west) > 20) return null;

  return { south, west, north, east };
};

const normalizeCampsite = (element) => {
  const tags = element.tags || {};
  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  return {
    id: `${element.type}-${element.id}`,
    osm_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    nombre: tags.name || tags['name:es'] || 'Sitio para acampar sin nombre',
    tipo: tags.tourism || 'camp_site',
    latitud: latitude,
    longitud: longitude,
    operador: tags.operator || null,
    telefono: tags.phone || tags['contact:phone'] || null,
    sitio_web: tags.website || tags['contact:website'] || null,
    acceso: tags.access || null,
  };
};

exports.getCampsites = async (req, res) => {
  const bbox = parseBbox(req.query.bbox);
  if (!bbox) {
    return res.status(400).json({
      success: false,
      error: 'Área del mapa inválida o demasiado grande. Acércate para consultar puntos de acampada.'
    });
  }

  const roundedBbox = [bbox.south, bbox.west, bbox.north, bbox.east].map((value) => value.toFixed(2));
  const cacheKey = roundedBbox.join(',');
  const cached = cache.get(cacheKey);
  if (req.query.actualizar !== 'true' && cached && cached.expiresAt > Date.now()) {
    return res.json({ ...cached.data, cached: true });
  }

  const query = `[out:json][timeout:12];(node["tourism"~"^(camp_site|caravan_site)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});way["tourism"~"^(camp_site|caravan_site)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east});relation["tourism"~"^(camp_site|caravan_site)$"](${bbox.south},${bbox.west},${bbox.north},${bbox.east}););out center tags ${MAX_RESULTS};`;
  const configuredEndpoints = process.env.OVERPASS_URLS
    ? process.env.OVERPASS_URLS.split(',').map((url) => url.trim()).filter(Boolean)
    : process.env.OVERPASS_URL
      ? [process.env.OVERPASS_URL, ...OVERPASS_ENDPOINTS.filter((url) => url !== process.env.OVERPASS_URL)]
      : OVERPASS_ENDPOINTS;

  try {
    let payload;
    for (const endpoint of configuredEndpoints) {
      try {
        const response = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
            'User-Agent': 'ACJ-Camp/1.0 (OpenStreetMap camping map)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(15000),
        });
        if (!response.ok) continue;
        payload = await response.json();
        break;
      } catch (error) {
        if (error.name === 'AbortError' || error.name === 'TimeoutError') continue;
        throw error;
      }
    }

    if (!payload) {
      if (cached) {
        return res.json({ ...cached.data, cached: true, desactualizado: true });
      }
      return res.status(502).json({ success: false, error: 'OpenStreetMap no está respondiendo ahora. Intenta actualizar en un momento.' });
    }

    const campings = (payload.elements || []).map(normalizeCampsite).filter(Boolean);
    const data = {
      success: true,
      source: 'OpenStreetMap',
      fetched_at: new Date().toISOString(),
      count: campings.length,
      campings,
    };
    cache.set(cacheKey, { data, expiresAt: Date.now() + CACHE_TTL_MS });
    if (cache.size > 100) {
      const now = Date.now();
      for (const [key, entry] of cache) {
        if (entry.expiresAt <= now || cache.size > 100) cache.delete(key);
      }
    }
    res.json(data);
  } catch (error) {
    if (cached) return res.json({ ...cached.data, cached: true, desactualizado: true });
    const status = error.name === 'TimeoutError' || error.name === 'AbortError' ? 504 : 502;
    res.status(status).json({ success: false, error: 'No se pudieron actualizar los puntos de acampada de OpenStreetMap.' });
  }
};