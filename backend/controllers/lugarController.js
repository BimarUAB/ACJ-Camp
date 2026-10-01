const pool = require('../config/database');
const { calcularDistanciaKm } = require('../utils/geolocation');
const CLIMA_CACHE_TTL_MS = 15 * 60 * 1000;
const climaCache = new Map();

const parseJsonArray = (value) => {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isAdmin = (req) => req.user?.rol === 'admin';
const isOwnerOrAdmin = async (req, lugarId) => {
  if (isAdmin(req)) return true;
  const result = await pool.query('SELECT creado_por FROM lugares_camping WHERE id = $1', [lugarId]);
  return result.rows.length > 0 && result.rows[0].creado_por === req.user.id;
};

exports.getAllLugares = async (req, res) => {
  try {
    const {
      lat,
      lng,
      radio = 50,
      servicios,
      capacidad_min,
      calificacion_min,
      estado = 'activo',
      busqueda
    } = req.query;

    let conditions = [];
    let params = [];
    let paramCount = 0;
    let puntoBusqueda = null;
    let radioKm = Number(radio) || 50;
    let filtroEspacialAplicado = false;

    if (lat != null && lng != null) {
      puntoBusqueda = { lat: Number(lat), lng: Number(lng) };
    } else if (req.user?.id && req.user.rol !== 'admin') {
      const iglesia = await pool.query(
        `SELECT i.latitud, i.longitud FROM usuarios u
         JOIN iglesias i ON i.id = u.iglesia_id WHERE u.id = $1`,
        [req.user.id]
      );
      if (iglesia.rows[0]?.latitud != null && iglesia.rows[0]?.longitud != null) {
        puntoBusqueda = { lat: Number(iglesia.rows[0].latitud), lng: Number(iglesia.rows[0].longitud) };
      }
    }

    let distanceExpression = 'NULL::numeric AS distancia_km';
    if (puntoBusqueda && Number.isFinite(puntoBusqueda.lat) && Number.isFinite(puntoBusqueda.lng)) {
      const lngParam = ++paramCount;
      params.push(puntoBusqueda.lng);
      const latParam = ++paramCount;
      params.push(puntoBusqueda.lat);
      const radioParam = ++paramCount;
      radioKm = Math.max(0.1, radioKm);
      const radioMetros = radioKm * 1000;
      params.push(radioMetros);
      const lugarGeography = 'ST_SetSRID(ST_MakePoint(l.longitud::double precision, l.latitud::double precision), 4326)::geography';
      const origenGeography = `ST_SetSRID(ST_MakePoint($${lngParam}::double precision, $${latParam}::double precision), 4326)::geography`;
      conditions.push(`ST_DWithin(${lugarGeography}, ${origenGeography}, $${radioParam})`);
      distanceExpression = `ROUND((ST_Distance(${lugarGeography}, ${origenGeography}, false) / 1000)::numeric, 2) AS distancia_km`;
      filtroEspacialAplicado = true;
    }

    if (!isAdmin(req)) {
      if (estado === 'pendiente' && req.user?.id) {
        conditions.push(`l.estado = 'pendiente' AND l.creado_por = $${++paramCount}`);
        params.push(req.user.id);
      } else {
        conditions.push(`l.estado = 'activo'`);
      }
    } else if (estado && estado !== 'todos') {
      conditions.push(`l.estado = $${++paramCount}`);
      params.push(estado);
    }

    if (busqueda) {
      conditions.push(`(l.nombre ILIKE $${++paramCount} OR l.descripcion ILIKE $${paramCount} OR l.direccion ILIKE $${paramCount})`);
      params.push(`%${busqueda}%`);
    }

    if (capacidad_min) {
      conditions.push(`l.capacidad_maxima >= $${++paramCount}`);
      params.push(Number(capacidad_min));
    }

    if (calificacion_min) {
      conditions.push(`COALESCE((SELECT AVG(calificacion) FROM resenas WHERE lugar_id = l.id), 0) >= $${++paramCount}`);
      params.push(Number(calificacion_min));
    }

    let serviciosArray = [];
    if (servicios) {
      serviciosArray = Array.isArray(servicios) ? servicios : servicios.split(',').map(s => s.trim());
    }

    if (serviciosArray.length > 0) {
      const placeholders = serviciosArray.map(() => `$${++paramCount}`).join(',');
      conditions.push(`l.servicios ?| ARRAY[${placeholders}]`);
      params.push(...serviciosArray);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const query = `
      SELECT l.*, u.nombre AS creador_nombre, ${distanceExpression},
             COALESCE((SELECT AVG(calificacion) FROM resenas WHERE lugar_id = l.id), 0)::numeric(3,2) AS promedio_calificacion,
             (SELECT COUNT(*) FROM resenas WHERE lugar_id = l.id) AS total_resenas
      FROM lugares_camping l
      LEFT JOIN usuarios u ON l.creado_por = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
    `;

    let result;
    let usarHaversine = false;
    try {
      result = await pool.query(query, params);
    } catch (error) {
      if (!filtroEspacialAplicado || !['42704', '42883'].includes(error.code)) throw error;

      const fallbackConditions = conditions.slice(1).map((condition) =>
        condition.replace(/\$(\d+)/g, (_, index) => `$${Number(index) - 3}`)
      );
      const fallbackWhereClause = fallbackConditions.length ? `WHERE ${fallbackConditions.join(' AND ')}` : '';
      const fallbackQuery = `
        SELECT l.*, u.nombre AS creador_nombre, NULL::numeric AS distancia_km,
               COALESCE((SELECT AVG(calificacion) FROM resenas WHERE lugar_id = l.id), 0)::numeric(3,2) AS promedio_calificacion,
               (SELECT COUNT(*) FROM resenas WHERE lugar_id = l.id) AS total_resenas
        FROM lugares_camping l
        LEFT JOIN usuarios u ON l.creado_por = u.id
        ${fallbackWhereClause}
        ORDER BY l.created_at DESC
      `;
      result = await pool.query(fallbackQuery, params.slice(3));
      usarHaversine = true;
    }

    let lugares = result.rows;
    if (usarHaversine) {
      lugares = lugares.flatMap((lugar) => {
        const distancia = calcularDistanciaKm(
          puntoBusqueda.lat,
          puntoBusqueda.lng,
          Number(lugar.latitud),
          Number(lugar.longitud)
        );
        if (distancia > radioKm) return [];
        return [{ ...lugar, distancia_km: Number(distancia.toFixed(2)) }];
      }).sort((a, b) => a.distancia_km - b.distancia_km);
    }

    res.json({ success: true, count: lugares.length, lugares });
  } catch (error) {
    if (['57P03', '08006', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code)) {
      return res.status(503).json({
        success: false,
        error: 'La base de datos está recuperándose o no está disponible. Los lugares de ACJ Camp aparecerán cuando PostgreSQL vuelva a aceptar conexiones.'
      });
    }
    console.error('Error listando lugares:', error);
    res.status(500).json({ success: false, error: 'Error al listar lugares' });
  }
};

exports.getLugarById = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT l.*, u.nombre AS creador_nombre,
             COALESCE((SELECT AVG(calificacion) FROM resenas WHERE lugar_id = l.id), 0)::numeric(3,2) AS promedio_calificacion,
             (SELECT COUNT(*) FROM resenas WHERE lugar_id = l.id) AS total_resenas
      FROM lugares_camping l
      LEFT JOIN usuarios u ON l.creado_por = u.id
      WHERE l.id = $1
    `, [id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lugar no encontrado' });
    }

    const lugar = result.rows[0];
    if (lugar.estado !== 'activo' && !isAdmin(req) && lugar.creado_por !== req.user?.id) {
      return res.status(403).json({ success: false, error: 'No tiene permisos para ver este lugar' });
    }

    res.json({ success: true, lugar });
  } catch (error) {
    console.error('Error obteniendo lugar:', error);
    res.status(500).json({ success: false, error: 'Error al obtener lugar' });
  }
};

exports.getClimaLugar = async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, latitud, longitud, estado, creado_por FROM lugares_camping WHERE id = $1',
      [req.params.id]
    );
    if (!result.rows.length) return res.status(404).json({ success: false, error: 'Lugar no encontrado' });

    const lugar = result.rows[0];
    if (lugar.estado !== 'activo' && !isAdmin(req) && Number(lugar.creado_por) !== Number(req.user?.id)) {
      return res.status(403).json({ success: false, error: 'No tiene permisos para ver este lugar' });
    }

    const latitud = Number(lugar.latitud);
    const longitud = Number(lugar.longitud);
    if (!Number.isFinite(latitud) || !Number.isFinite(longitud)) {
      return res.status(422).json({ success: false, error: 'Este lugar no tiene coordenadas válidas para consultar el clima' });
    }

    const cacheKey = `${latitud.toFixed(2)},${longitud.toFixed(2)}`;
    const cached = climaCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return res.json({ success: true, source: 'Open-Meteo', cached: true, ...cached.data });
    }

    const url = new URL('https://api.open-meteo.com/v1/forecast');
    url.search = new URLSearchParams({
      latitude: String(latitud),
      longitude: String(longitud),
      current: 'temperature_2m,relative_humidity_2m,apparent_temperature,is_day,precipitation,weather_code,wind_speed_10m',
      daily: 'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
      forecast_days: '3',
      timezone: 'auto',
    }).toString();

    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(10000) });
      if (!response.ok) throw new Error(`Open-Meteo respondió ${response.status}`);
      const payload = await response.json();
      if (!payload.current || !payload.daily) throw new Error('Respuesta de clima incompleta');

      const data = {
        timezone: payload.timezone,
        current: payload.current,
        current_units: payload.current_units,
        daily: payload.daily,
        daily_units: payload.daily_units,
        updated_at: new Date().toISOString(),
      };
      climaCache.set(cacheKey, { data, expiresAt: Date.now() + CLIMA_CACHE_TTL_MS });
      if (climaCache.size > 500) {
        for (const [key, entry] of climaCache) {
          if (entry.expiresAt <= Date.now() || climaCache.size > 500) climaCache.delete(key);
        }
      }
      res.json({ success: true, source: 'Open-Meteo', cached: false, ...data });
    } catch (error) {
      if (cached) return res.json({ success: true, source: 'Open-Meteo', cached: true, stale: true, ...cached.data });
      throw error;
    }
  } catch (error) {
    console.error('Error consultando clima del lugar:', error.message);
    res.status(502).json({ success: false, error: 'No se pudo consultar el clima ahora. Intenta de nuevo más tarde.' });
  }
};

exports.createLugar = async (req, res) => {
  try {
    const {
      nombre,
      descripcion,
      direccion,
      latitud,
      longitud,
      propietario,
      contacto,
      telefono,
      servicios,
      capacidad_maxima,
      precio_aprox,
      fotos
    } = req.body;

    if (!nombre || latitud == null || longitud == null) {
      return res.status(400).json({ success: false, error: 'Nombre, latitud y longitud son obligatorios' });
    }

    const serviciosArray = parseJsonArray(servicios);

    const result = await pool.query(`
      INSERT INTO lugares_camping (nombre, descripcion, direccion, latitud, longitud, propietario, contacto, telefono, servicios, capacidad_maxima, precio_aprox, fotos, creado_por, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12::jsonb, $13, 'pendiente')
      RETURNING *
    `, [
      nombre,
      descripcion,
      direccion,
      latitud,
      longitud,
      propietario,
      contacto,
      telefono,
      JSON.stringify(serviciosArray),
      capacidad_maxima,
      precio_aprox,
      JSON.stringify(parseJsonArray(fotos)),
      req.user.id
    ]);

    res.status(201).json({
      success: true,
      message: 'Lugar registrado exitosamente. Pendiente de aprobación del administrador.',
      lugar: result.rows[0]
    });
  } catch (error) {
    if (['57P03', '08006', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code)) {
      return res.status(503).json({ success: false, error: 'No se pudo guardar: PostgreSQL está recuperándose o no está disponible. Intenta de nuevo cuando la base vuelva a aceptar conexiones.' });
    }
    console.error('Error creando lugar:', error);
    res.status(500).json({ success: false, error: 'Error al crear lugar' });
  }
};

exports.updateLugar = async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await isOwnerOrAdmin(req, id))) {
      return res.status(403).json({ success: false, error: 'No tiene permisos para modificar este lugar' });
    }

    const {
      nombre,
      descripcion,
      direccion,
      latitud,
      longitud,
      propietario,
      contacto,
      telefono,
      servicios,
      capacidad_maxima,
      precio_aprox,
      fotos,
      estado
    } = req.body;

    const existing = await pool.query('SELECT estado FROM lugares_camping WHERE id = $1', [id]);
    if (existing.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lugar no encontrado' });
    }

    let newEstado = estado;
    if (estado && !isAdmin(req)) {
      newEstado = existing.rows[0].estado;
    }

    const serviciosArray = parseJsonArray(servicios);

    const result = await pool.query(`
      UPDATE lugares_camping
      SET nombre = COALESCE($1, nombre),
          descripcion = COALESCE($2, descripcion),
          direccion = COALESCE($3, direccion),
          latitud = COALESCE($4, latitud),
          longitud = COALESCE($5, longitud),
          propietario = COALESCE($6, propietario),
          contacto = COALESCE($7, contacto),
          telefono = COALESCE($8, telefono),
          servicios = COALESCE($9::jsonb, servicios),
          capacidad_maxima = COALESCE($10, capacidad_maxima),
          precio_aprox = COALESCE($11, precio_aprox),
            fotos = COALESCE($12::jsonb, fotos),
            estado = COALESCE($13, estado)
          WHERE id = $14
      RETURNING *
    `, [
      nombre,
      descripcion,
      direccion,
      latitud,
      longitud,
      propietario,
      contacto,
      telefono,
      servicios ? JSON.stringify(serviciosArray) : null,
      capacidad_maxima,
      precio_aprox,
      fotos != null ? JSON.stringify(parseJsonArray(fotos)) : null,
      newEstado,
      id
    ]);

    res.json({ success: true, message: 'Lugar actualizado exitosamente', lugar: result.rows[0] });
  } catch (error) {
    if (['57P03', '08006', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code)) {
      return res.status(503).json({ success: false, error: 'No se pudo actualizar: PostgreSQL está recuperándose o no está disponible. Tus cambios aún no se guardaron.' });
    }
    console.error('Error actualizando lugar:', error);
    res.status(500).json({ success: false, error: 'Error al actualizar lugar' });
  }
};

exports.deleteLugar = async (req, res) => {
  try {
    const { id } = req.params;

    if (!(await isOwnerOrAdmin(req, id))) {
      return res.status(403).json({ success: false, error: 'No tiene permisos para eliminar este lugar' });
    }

    await pool.query('DELETE FROM lugares_camping WHERE id = $1', [id]);
    res.json({ success: true, message: 'Lugar eliminado exitosamente' });
  } catch (error) {
    console.error('Error eliminando lugar:', error);
    res.status(500).json({ success: false, error: 'Error al eliminar lugar' });
  }
};

exports.getLugaresPendientes = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*, u.nombre AS creador_nombre
      FROM lugares_camping l
      LEFT JOIN usuarios u ON l.creado_por = u.id
      WHERE l.estado = 'pendiente'
      ORDER BY l.created_at DESC
    `);
    res.json({ success: true, lugares: result.rows });
  } catch (error) {
    console.error('Error listando lugares pendientes:', error);
    res.status(500).json({ success: false, error: 'Error al listar lugares pendientes' });
  }
};

exports.getMisLugares = async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT l.*,
             COALESCE((SELECT AVG(calificacion) FROM resenas WHERE lugar_id = l.id), 0)::numeric(3,2) AS promedio_calificacion,
             (SELECT COUNT(*) FROM resenas WHERE lugar_id = l.id) AS total_resenas
      FROM lugares_camping l
      WHERE l.creado_por = $1
      ORDER BY l.created_at DESC
    `, [req.user.id]);
    res.json({ success: true, count: result.rows.length, lugares: result.rows });
  } catch (error) {
    if (['57P03', '08006', 'ECONNRESET', 'ECONNREFUSED', 'ETIMEDOUT'].includes(error.code)) {
      return res.status(503).json({ success: false, error: 'La base de datos está recuperándose o no está disponible. Tus lugares aparecerán cuando PostgreSQL vuelva a aceptar conexiones.' });
    }
    console.error('Error listando mis lugares:', error);
    res.status(500).json({ success: false, error: 'Error al listar tus lugares' });
  }
};

exports.aprobarLugar = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE lugares_camping SET estado = 'activo' WHERE id = $1 RETURNING *",
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: 'Lugar no encontrado' });
    }
    res.json({ success: true, message: 'Lugar aprobado exitosamente', lugar: result.rows[0] });
  } catch (error) {
    console.error('Error aprobando lugar:', error);
    res.status(500).json({ success: false, error: 'Error al aprobar lugar' });
  }
};

exports.rechazarLugar = async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(
      "UPDATE lugares_camping SET estado = 'inactivo' WHERE id = $1 AND estado = 'pendiente' RETURNING *",
      [id]
    );
    if (!result.rows.length) {
      return res.status(404).json({ success: false, error: 'Lugar pendiente no encontrado' });
    }
    res.json({ success: true, message: 'Lugar rechazado', lugar: result.rows[0] });
  } catch (error) {
    console.error('Error rechazando lugar:', error);
    res.status(500).json({ success: false, error: 'Error al rechazar lugar' });
  }
};
