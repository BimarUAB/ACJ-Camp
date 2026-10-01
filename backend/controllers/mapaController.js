const CACHE_TTL_MS = 10 * 60 * 1000;
const MAX_RESULTS = 150;
const MAX_ADVENTIST_CHURCHES = 250;
const cache = new Map();
const churchCache = { candidates: null, expiresAt: 0 };
const pool = require('../config/database');
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

const normalizeAdventistChurch = (element) => {
  const tags = element.tags || {};
  const name = tags.name || tags['name:es'] || '';
  if (!/iglesia.*adventista.*(?:séptimo|septimo).*d[ií]a/i.test(name)) return null;

  const latitude = element.lat ?? element.center?.lat;
  const longitude = element.lon ?? element.center?.lon;
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;

  const street = tags['addr:street'];
  const houseNumber = tags['addr:housenumber'];
  return {
    id: `${element.type}/${element.id}`,
    osm_url: `https://www.openstreetmap.org/${element.type}/${element.id}`,
    nombre: name,
    direccion: tags['addr:full'] || [street, houseNumber].filter(Boolean).join(' '),
    zona: tags['addr:suburb'] || tags['addr:neighbourhood'] || tags['addr:district'] || '',
    latitud: latitude,
    longitud: longitude,
  };
};

const getAdventistChurchCandidates = async () => {
  if (churchCache.candidates && churchCache.expiresAt > Date.now()) return churchCache.candidates;

  const query = `[out:json][timeout:12];area["name"="La Paz"]["boundary"="administrative"]["admin_level"="4"]->.la_paz;nwr(area.la_paz)["name"~"Adventista",i];out center tags ${MAX_ADVENTIST_CHURCHES};`;
  const configuredEndpoints = process.env.OVERPASS_URLS
    ? process.env.OVERPASS_URLS.split(',').map((url) => url.trim()).filter(Boolean)
    : process.env.OVERPASS_URL
      ? [process.env.OVERPASS_URL, ...OVERPASS_ENDPOINTS.filter((url) => url !== process.env.OVERPASS_URL)]
      : OVERPASS_ENDPOINTS;
  let lastError;

  for (const endpoint of configuredEndpoints) {
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8',
          'User-Agent': 'ACJ-Camp/1.0 (OpenStreetMap church directory)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(15000),
      });
      if (!response.ok) {
        lastError = new Error(`Overpass respondió ${response.status}`);
        continue;
      }

      const payload = await response.json();
      const normalized = (payload.elements || []).map(normalizeAdventistChurch).filter(Boolean);
      const unique = normalized.filter((candidate, index) => normalized.findIndex((other) => (
        Math.abs(other.latitud - candidate.latitud) < 0.00025
        && Math.abs(other.longitud - candidate.longitud) < 0.00025
      )) === index);
      churchCache.candidates = unique;
      churchCache.expiresAt = Date.now() + CACHE_TTL_MS;
      return unique;
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError || new Error('OpenStreetMap no está respondiendo');
};

const findExistingChurches = async (candidates, client = pool) => {
  if (!candidates.length) return new Map();

  const result = await client.query(
    `WITH incoming AS (
       SELECT *
       FROM UNNEST($1::text[], $2::text[], $3::double precision[], $4::double precision[])
         AS candidate(osm_id, nombre, latitud, longitud)
     )
     SELECT DISTINCT ON (incoming.osm_id)
            incoming.osm_id, iglesia.id, iglesia.nombre
     FROM incoming
     JOIN iglesias iglesia
       ON lower(trim(iglesia.nombre)) = lower(trim(incoming.nombre))
       OR (
         iglesia.latitud IS NOT NULL AND iglesia.longitud IS NOT NULL
         AND abs(iglesia.latitud::double precision - incoming.latitud) < 0.00025
         AND abs(iglesia.longitud::double precision - incoming.longitud) < 0.00025
       )
     ORDER BY incoming.osm_id, iglesia.id`,
    [
      candidates.map((candidate) => candidate.id),
      candidates.map((candidate) => candidate.nombre),
      candidates.map((candidate) => candidate.latitud),
      candidates.map((candidate) => candidate.longitud),
    ]
  );

  return new Map(result.rows.map((row) => [row.osm_id, { id: row.id, nombre: row.nombre }]));
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

exports.getAdventistChurches = async (req, res) => {
  try {
    const candidates = await getAdventistChurchCandidates();
    const existing = await findExistingChurches(candidates);
    res.json({
      success: true,
      source: 'OpenStreetMap',
      count: candidates.length,
      candidates: candidates.map((candidate) => ({
        ...candidate,
        duplicate: existing.has(candidate.id),
        duplicate_id: existing.get(candidate.id)?.id || null,
      })),
    });
  } catch (error) {
    console.error('Error buscando iglesias adventistas en OpenStreetMap:', error.message);
    res.status(502).json({ success: false, error: 'OpenStreetMap no respondió. No se guardó ningún registro; intenta de nuevo más tarde.' });
  }
};

exports.importAdventistChurches = async (req, res) => {
  const requestedIds = [...new Set(req.body.osm_ids)];
  let client;
  try {
    const candidates = await getAdventistChurchCandidates();
    const candidatesById = new Map(candidates.map((candidate) => [candidate.id, candidate]));
    const selected = requestedIds.map((id) => candidatesById.get(id)).filter(Boolean);
    if (selected.length !== requestedIds.length) {
      return res.status(409).json({ success: false, error: 'La lista de OpenStreetMap cambió. Vuelve a buscar antes de importar.' });
    }

    client = await pool.connect();
    await client.query('BEGIN');
    const existing = await findExistingChurches(selected, client);
    const imported = [];
    let skipped = 0;

    for (const church of selected) {
      if (existing.has(church.id)) {
        skipped += 1;
        continue;
      }
      const result = await client.query(
        `INSERT INTO iglesias (nombre, direccion, zona, distrito, latitud, longitud, creado_por)
         VALUES ($1, $2, $3, 'La Paz', $4, $5, $6)
         RETURNING id, nombre`,
        [church.nombre, church.direccion || null, church.zona || null, church.latitud, church.longitud, req.user.id]
      );
      imported.push(result.rows[0]);
    }

    await client.query('COMMIT');
    res.status(201).json({ success: true, imported, skipped, count: imported.length });
  } catch (error) {
    if (client) await client.query('ROLLBACK').catch(() => {});
    console.error('Error importando iglesias adventistas:', error.message);
    res.status(500).json({ success: false, error: 'No se pudieron guardar las iglesias seleccionadas.' });
  } finally {
    client?.release();
  }
};