const pool = require('../config/database');
const { calcularDistanciaKm } = require('../utils/geolocation');

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

    if (estado && estado !== 'todos') {
      conditions.push(`l.estado = $${++paramCount}`);
      params.push(estado);
    } else if (!isAdmin(req)) {
      conditions.push(`l.estado = 'activo'`);
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
      SELECT l.*, u.nombre AS creador_nombre,
             COALESCE((SELECT AVG(calificacion) FROM resenas WHERE lugar_id = l.id), 0)::numeric(3,2) AS promedio_calificacion,
             (SELECT COUNT(*) FROM resenas WHERE lugar_id = l.id) AS total_resenas
      FROM lugares_camping l
      LEFT JOIN usuarios u ON l.creado_por = u.id
      ${whereClause}
      ORDER BY l.created_at DESC
    `;

    const result = await pool.query(query, params);
    let lugares = result.rows;

    if (lat && lng) {
      const radiusKm = Number(radio) || 50;
      const latNum = Number(lat);
      const lngNum = Number(lng);
      lugares = lugares.filter(lugar => {
        if (!lugar.latitud || !lugar.longitud) return false;
        const distancia = calcularDistanciaKm(latNum, lngNum, lugar.latitud, lugar.longitud);
        lugar.distancia_km = Number(distancia.toFixed(2));
        return distancia <= radiusKm;
      }).sort((a, b) => (a.distancia_km || Infinity) - (b.distancia_km || Infinity));
    }

    res.json({ success: true, count: lugares.length, lugares });
  } catch (error) {
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
      precio_aprox
    } = req.body;

    if (!nombre || latitud == null || longitud == null) {
      return res.status(400).json({ success: false, error: 'Nombre, latitud y longitud son obligatorios' });
    }

    const serviciosArray = parseJsonArray(servicios);

    const result = await pool.query(`
      INSERT INTO lugares_camping (nombre, descripcion, direccion, latitud, longitud, propietario, contacto, telefono, servicios, capacidad_maxima, precio_aprox, creado_por, estado)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11, $12, 'pendiente')
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
      req.user.id
    ]);

    res.status(201).json({
      success: true,
      message: 'Lugar registrado exitosamente. Pendiente de aprobación del administrador.',
      lugar: result.rows[0]
    });
  } catch (error) {
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
          estado = COALESCE($12, estado)
      WHERE id = $13
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
      newEstado,
      id
    ]);

    res.json({ success: true, message: 'Lugar actualizado exitosamente', lugar: result.rows[0] });
  } catch (error) {
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
